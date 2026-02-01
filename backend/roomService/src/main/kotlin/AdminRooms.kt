package com.roomservice

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.request.header
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.delete
import io.ktor.server.routing.routing
import io.lettuce.core.ScanArgs
import io.lettuce.core.ScanCursor
import io.lettuce.core.api.async.RedisAsyncCommands
import kotlinx.coroutines.future.await

private const val ADMIN_SECRET_HEADER = "X-Admin-Secret"

fun Application.configureAdminRooms(redis: RedisAsyncCommands<String, String>) {
    routing {
        get("/admin/rooms") {
            val secret = call.request.header(ADMIN_SECRET_HEADER)
            if (secret.isNullOrBlank() || secret != System.getenv("ROOM_ADMIN_SECRET")) {
                return@get call.respond(HttpStatusCode.Unauthorized)
            }

            val rooms = mutableListOf<Map<String, Any?>>()
            var cursor: ScanCursor = ScanCursor.INITIAL
            do {
                val scan = redis.scan(cursor, ScanArgs().match("room:*:meta").limit(50)).await()
                cursor = scan
                for (key in scan.keys) {
                    val roomId = key.removePrefix("room:").removeSuffix(":meta")
                    val ttl = redis.ttl(key).await()
                    val lastActive = redis.hget(key, "lastActive").await()
                    val connectedCount = redis.hget(key, "connectedCount").await()
                    rooms.add(
                        mapOf(
                            "roomId" to roomId,
                            "ttl" to ttl,
                            "lastActive" to lastActive,
                            "connectedCount" to connectedCount
                        )
                    )
                }
            } while (!cursor.isFinished)

            call.respond(rooms)
        }

        delete("/admin/rooms/{roomId}") {
            val secret = call.request.header(ADMIN_SECRET_HEADER)
            if (secret.isNullOrBlank() || secret != System.getenv("ROOM_ADMIN_SECRET")) {
                return@delete call.respond(HttpStatusCode.Unauthorized)
            }
            val roomId = call.parameters["roomId"] ?: return@delete call.respond(HttpStatusCode.BadRequest)
            destroyRoom(redis, roomId, "admin_delete")
            call.respond(HttpStatusCode.OK)
        }
    }
}
