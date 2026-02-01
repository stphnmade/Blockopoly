package com.roomservice.routes

import com.roomservice.ErrorType
import com.roomservice.JOIN_CODE_TO_ROOM_PREFIX
import com.roomservice.LETTUCE_REDIS_COMMANDS_KEY
import com.roomservice.MAX_PLAYERS
import com.roomservice.PLAYER_TO_NAME_PREFIX
import com.roomservice.PLAYER_TO_ROOM_PREFIX
import com.roomservice.PUBSUB_MANAGER_KEY
import com.roomservice.ROOM_BROADCAST_MSG_DELIMITER
import com.roomservice.ROOM_START_STATUS_PREFIX
import com.roomservice.ROOM_TO_PLAYERS_PREFIX
import com.roomservice.RoomBroadcastType
import com.roomservice.SECS_IN_HOUR
import com.roomservice.ROOM_CLIENT_TO_PLAYER_PREFIX
import com.roomservice.models.Player
import com.roomservice.models.RoomBroadcast
import com.roomservice.models.RoomSubChannel
import com.roomservice.util.format
import com.roomservice.util.forwardSSe
import com.roomservice.util.reconnect
import io.ktor.server.application.ApplicationCall
import io.ktor.server.sse.ServerSSESession
import io.lettuce.core.api.async.RedisAsyncCommands
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.future.asDeferred
import kotlinx.coroutines.future.await
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID
import com.roomservice.ROOM_IDLE_TTL_SECONDS
import com.roomservice.touchRoom

@Serializable
data class JoinRoomResponse(val playerId: String = "", val name: String = "", val roomId: String = "", val roomCode: String = "", val players: List<Player> = emptyList())

@Serializable
data class JoinRoomBroadcast(val playerID: String, val name: String) {
    override fun toString(): String {
        return "$playerID${ROOM_BROADCAST_MSG_DELIMITER}$name"
    }
}

suspend fun joinRoomHandler(call: ApplicationCall, session: ServerSSESession) {
    val roomCode = call.parameters["roomCode"]
    if (roomCode.isNullOrBlank()) {
        session.send(ErrorType.BAD_REQUEST.toString(), RoomBroadcastType.ERROR.toString())
        return session.close()
    }
    val userName = call.parameters["username"]
    if (userName.isNullOrBlank()) {
        session.send(ErrorType.BAD_REQUEST.toString(), RoomBroadcastType.ERROR.toString())
        return session.close()
    }
    val redis = call.application.attributes[LETTUCE_REDIS_COMMANDS_KEY]
    val pubSubManager = call.application.attributes[PUBSUB_MANAGER_KEY]
    val reconnectingPlayer = call.request.queryParameters["playerId"]
    val clientId = call.request.queryParameters["clientId"]

    if (reconnectingPlayer != null) {
        return reconnect(reconnectingPlayer, session)
    }

    val roomID = redis.get(JOIN_CODE_TO_ROOM_PREFIX + roomCode).await()
    if (roomID == null) {
        session.send(ErrorType.ROOM_NOT_FOUND.toString(), RoomBroadcastType.ERROR.toString())
        return session.close()
    }

    val maxRetry = 3
    repeat(maxRetry) { attempt ->
        redis.watch(ROOM_TO_PLAYERS_PREFIX + roomID).await()
        redis.watch(ROOM_START_STATUS_PREFIX + roomID).await()
        val numPlayers = redis.llen(ROOM_TO_PLAYERS_PREFIX + roomID)
        val roomStarted = redis.get(ROOM_START_STATUS_PREFIX + roomID).await()
        if (numPlayers.await() >= MAX_PLAYERS) {
            redis.unwatch().await()
            session.send(ErrorType.ROOM_FULL.toString(), RoomBroadcastType.ERROR.toString())
            return session.close()
        } else if (roomStarted == "true") {
            redis.unwatch().await()
            session.send(ErrorType.ROOM_ALREADY_STARTED.toString(), RoomBroadcastType.ERROR.toString())
            return session.close()
        }

        val playerID = UUID.randomUUID().format()
        val channel = pubSubManager.subscribe(roomID)
        val successfulUpdate = updateDatastore(playerID, userName, roomID, redis, session)
        if (successfulUpdate.first) {
            // Mark activity on the room.
            touchRoom(redis, roomID, ROOM_IDLE_TTL_SECONDS)
            // Persist clientId -> playerId mapping for reconnect if provided
            if (!clientId.isNullOrBlank()) {
                redis.setex(
                    ROOM_CLIENT_TO_PLAYER_PREFIX + roomID + ":" + clientId,
                    SECS_IN_HOUR,
                    playerID
                ).await()
            }
            redis.publish(roomID,
                    RoomBroadcast(
                        RoomBroadcastType.JOIN,
                        JoinRoomBroadcast(playerID, userName).toString()
                ).toString()
            )
            val playerNamesFuture = successfulUpdate.second.map {  redis.get(PLAYER_TO_NAME_PREFIX + it).asDeferred() }
            val players = playerNamesFuture.awaitAll().zip(successfulUpdate.second).map {
                (playerName, playerId) -> Player(playerId, playerName)
            }

            session.send(Json.encodeToString(
                JoinRoomResponse(playerId = playerID,
                    name = userName,
                    roomId = roomID,
                    roomCode = roomCode,
                    players = players)
            ), RoomBroadcastType.INITIAL.toString())

            session.send(Player(players.last().playerId, players.last().name).toString(), RoomBroadcastType.HOST.toString())
            return forwardSSe(RoomSubChannel(channel, roomID, UUID.randomUUID().toString(), playerID), session)
        }
        pubSubManager.unsubscribe(roomID, channel)
     }
    session.send(ErrorType.SERVICE_UNAVAILABLE.toString(), RoomBroadcastType.ERROR.toString())
    return session.close()
}

suspend fun updateDatastore(playerID: String, userName: String, roomID: String, redis: RedisAsyncCommands<String, String>, session: ServerSSESession) : Pair<Boolean, List<String>> {
    redis.multi().await()
    redis.lpush(ROOM_TO_PLAYERS_PREFIX + roomID, playerID)
    redis.lrange(ROOM_TO_PLAYERS_PREFIX + roomID, 0, -1)
    redis.setex(PLAYER_TO_ROOM_PREFIX + playerID, SECS_IN_HOUR, roomID)
    redis.setex(PLAYER_TO_NAME_PREFIX + playerID, SECS_IN_HOUR, userName)
    val transactionResult = redis.exec().await() ?: return false to emptyList()

    if ((transactionResult[1] as ArrayList<String>).firstOrNull() != playerID ||
        (transactionResult[2] as String?) == null) {
            session.send(ErrorType.INTERNAL_SERVER_ERROR.toString(), RoomBroadcastType.ERROR.toString())
            redis.lrem(ROOM_TO_PLAYERS_PREFIX + roomID, 1, playerID)
            redis.del(PLAYER_TO_ROOM_PREFIX + playerID, PLAYER_TO_NAME_PREFIX + userName)
        return false to emptyList()
    }
    return true to transactionResult[1]
}
