package com.roomservice.routes

import com.roomservice.LETTUCE_REDIS_COMMANDS_KEY
import com.roomservice.PLAYER_TO_NAME_PREFIX
import com.roomservice.PLAYER_TO_ROOM_PREFIX
import com.roomservice.ROOM_TO_PLAYERS_PREFIX
import com.roomservice.ROOM_EMPTY_TTL_SECONDS
import com.roomservice.RoomBroadcastType
import com.roomservice.models.Player
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.lettuce.core.api.async.RedisAsyncCommands
import kotlinx.coroutines.future.await
import com.roomservice.touchRoom


suspend fun leaveRoomHandler(call: ApplicationCall) {
    val playerID = call.parameters["playerId"]
        ?: return call.respond(HttpStatusCode.BadRequest)
    val redis = call.application.attributes[LETTUCE_REDIS_COMMANDS_KEY]
    call.respond(leaveRoomHelper(playerID, redis))
}

suspend fun leaveRoomHelper(playerId: String, redis: RedisAsyncCommands<String, String>) : HttpStatusCode {
    val roomId = redis.get(PLAYER_TO_ROOM_PREFIX + playerId).await()

    if (roomId == null) {
        return HttpStatusCode.NotFound
    }

    val hostLeaving = redis.lindex(ROOM_TO_PLAYERS_PREFIX + roomId, -1).await() == playerId
    val removedCount = redis.lrem(ROOM_TO_PLAYERS_PREFIX + roomId, 1, playerId).await()

    if (removedCount == 0L) {
        return HttpStatusCode.OK
    }
    val playerName = redis.get(PLAYER_TO_NAME_PREFIX + playerId)

    redis.del(
        PLAYER_TO_ROOM_PREFIX + playerId,
        PLAYER_TO_NAME_PREFIX + playerId
    ).await()


    if (playerName != null) {
        redis.publish(
            roomId,
            com.roomservice.models.RoomBroadcast(
                RoomBroadcastType.LEAVE,
                Player(playerId, playerName.await()).toString()
            ).toString()
        )
    }

    val numberRemaining = redis.llen(ROOM_TO_PLAYERS_PREFIX + roomId).await()
    if (numberRemaining == 0L) {
        // No players left: mark room as empty and start aggressive TTL.
        touchRoom(redis, roomId, ROOM_EMPTY_TTL_SECONDS)
        closeRoomHandler(roomId = roomId, redis = redis)
        return HttpStatusCode.OK
    }
    else if (hostLeaving) {
        val newHostID = redis.lindex(ROOM_TO_PLAYERS_PREFIX + roomId, -1).await()
        val newHostName = redis.get(PLAYER_TO_NAME_PREFIX + newHostID).await()
        redis.publish(roomId,
            com.roomservice.models.RoomBroadcast(
                RoomBroadcastType.HOST, Player(newHostID, newHostName).toString()
            ).toString()
        )
    }

    return HttpStatusCode.OK
}
