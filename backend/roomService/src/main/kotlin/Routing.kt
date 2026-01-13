package com.roomservice

import com.roomservice.ROOM_CLIENT_TO_PLAYER_PREFIX
import com.roomservice.JOIN_CODE_TO_ROOM_PREFIX
import com.roomservice.LETTUCE_REDIS_COMMANDS_KEY
import com.roomservice.ROOM_START_STATUS_PREFIX
import com.roomservice.ROOM_TO_PLAYERS_PREFIX
import com.roomservice.PLAYER_TO_NAME_PREFIX
import com.roomservice.routes.closeRoomHandler
import com.roomservice.routes.createRoomHandler
import com.roomservice.routes.joinRoomHandler
import com.roomservice.routes.leaveRoomHandler
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.response.respond
import io.ktor.server.routing.post
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.sse.heartbeat
import io.ktor.server.sse.sse
import kotlinx.coroutines.future.await
import kotlinx.coroutines.future.asDeferred
import kotlinx.coroutines.awaitAll
import kotlinx.serialization.Serializable
import kotlin.time.Duration.Companion.seconds


fun Application.configureRouting() {
    routing {
        sse("/createRoom/{username}") {
            heartbeat { period = 20.seconds }
            call.application.environment.log.info("Room Create Begun")
            createRoomHandler(call, this)
        }
        sse("/joinRoom/{roomCode}/{username}") {
            heartbeat { period = 20.seconds }
            call.application.environment.log.info("Room Join Begun")
            joinRoomHandler(call, this)
        }
        post("/leaveRoom/{playerId}") {
            call.application.environment.log.info("Room Leave Begun")
            leaveRoomHandler(call)
        }
        post("/closeRoom/{roomId}") {
            call.application.environment.log.info("Room Close Begun")
            closeRoomHandler(call)
        }
        post("/start/{roomId}") {
            // TODO: Use JWT + playerId from request body to guarantee the user starting the room is part of the room
            // TODO: Address race condition(room marked as startable but player count then drops below 2) with Redis Multi and Exec
            call.application.environment.log.info("Starting game")
            val redis = call.application.attributes[LETTUCE_REDIS_COMMANDS_KEY]
            val roomId = call.parameters["roomId"] ?: return@post call.respond(HttpStatusCode.BadRequest)
            val roomStartable = redis.llen(ROOM_TO_PLAYERS_PREFIX + roomId).await()
            if (roomStartable < 2) {
                call.respond(HttpStatusCode.BadRequest)
            }
            val roomStarted = redis.setnx(ROOM_START_STATUS_PREFIX + roomId, "true").await()
            redis.expire(ROOM_START_STATUS_PREFIX + roomId, SECS_IN_HOUR * 24)
            if (!roomStarted) {
                return@post call.respond(HttpStatusCode.InternalServerError)
            }
            redis.publish(roomId, "START${ROOM_BROADCAST_TYPE_DELIMITER}")
            val players = redis.lrange(ROOM_TO_PLAYERS_PREFIX + roomId, 0, -1).await()
            val msg = (listOf(roomId) + players).toTypedArray().joinToString(separator = ROOM_BROADCAST_MSG_DELIMITER)
            redis.publish(ROOM_START_CHANNEL, msg)
            call.respond(HttpStatusCode.OK)
        }

        // Bootstrap endpoint: given roomCode + optional clientId, return lobby state snapshot
        get("/rooms/{roomCode}/state") {
            val roomCode = call.parameters["roomCode"]
            if (roomCode.isNullOrBlank()) {
                return@get call.respond(HttpStatusCode.BadRequest)
            }
            val clientId = call.request.queryParameters["clientId"]
            val redis = call.application.attributes[LETTUCE_REDIS_COMMANDS_KEY]

            val roomId = redis.get(JOIN_CODE_TO_ROOM_PREFIX + roomCode).await()
            if (roomId.isNullOrBlank()) {
                return@get call.respond(HttpStatusCode.NotFound)
            }

            val playerIds = redis.lrange(ROOM_TO_PLAYERS_PREFIX + roomId, 0, -1).await()
            val nameFutures = playerIds.map { pid ->
                redis.get(PLAYER_TO_NAME_PREFIX + pid).asDeferred()
            }
            val names = nameFutures.awaitAll()
            val players = playerIds.zip(names).mapNotNull { (pid, name) ->
                name?.let { PlayerSummary(pid, it) }
            }

            val hostId = players.firstOrNull()?.playerId
            val roomStarted = redis.get(ROOM_START_STATUS_PREFIX + roomId).await()
            val phase = if (roomStarted == "true") "in-game" else "lobby"

            val mappedPlayerId =
                if (!clientId.isNullOrBlank()) {
                    redis.get(ROOM_CLIENT_TO_PLAYER_PREFIX + roomId + ":" + clientId).await()
                } else null

            val response = RoomStateResponse(
                roomExists = true,
                roomId = roomId,
                roomCode = roomCode,
                players = players,
                hostId = hostId,
                phase = phase,
                playerId = mappedPlayerId
            )
            call.respond(response)
        }
    }
}

@Serializable
data class PlayerSummary(val playerId: String, val name: String)

@Serializable
data class RoomStateResponse(
    val roomExists: Boolean,
    val roomId: String,
    val roomCode: String,
    val players: List<PlayerSummary>,
    val hostId: String?,
    val phase: String,
    val playerId: String?
)
