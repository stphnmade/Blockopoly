package com.roomservice

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStarted
import io.ktor.server.application.ApplicationStopping
import io.ktor.server.application.log
import io.lettuce.core.ScanArgs
import io.lettuce.core.ScanCursor
import io.lettuce.core.api.async.RedisAsyncCommands
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.future.await
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

private const val ROOM_JANITOR_INTERVAL_SECONDS: Long = 30

private fun metaKey(roomId: String) = "room:$roomId:meta"

/**
 * Launch a background janitor that periodically scans for room:{roomId}:meta
 * keys and hard-deletes any rooms that have exceeded their TTL or whose
 * underlying lists no longer exist.
 *
 * This focuses on Redis state; in-memory game rooms are owned by gameService.
 */
fun Application.startRoomJanitor(redis: RedisAsyncCommands<String, String>) {
    val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    monitor.subscribe(ApplicationStarted) {
        scope.launch {
            while (isActive) {
                try {
                    runJanitor(redis)
                } catch (t: Throwable) {
                    log.error("room_cleanup_error", t)
                }
                delay(ROOM_JANITOR_INTERVAL_SECONDS.seconds)
            }
        }
    }

    monitor.subscribe(ApplicationStopping) {
        scope.cancel()
    }
}

private suspend fun runJanitor(redis: RedisAsyncCommands<String, String>) {
    // Scan for room meta keys
    var cursor: ScanCursor = ScanCursor.INITIAL
    val now = System.currentTimeMillis()
    do {
        val scan = redis.scan(cursor, ScanArgs().match("room:*:meta").limit(50)).await()
        cursor = scan
        for (key in scan.keys) {
            val roomId = key.removePrefix("room:").removeSuffix(":meta")
            val ttl = redis.ttl(key).await()
            val lastActive = redis.hget(key, "lastActive").await()?.toLongOrNull()

            // If TTL has already expired or metadata looks ancient, hard delete room keys.
            val expiredByTtl = ttl in 0..1
            val expiredByTime =
                lastActive != null && now - lastActive > ROOM_IDLE_TTL_SECONDS * 1000

            if (expiredByTtl || expiredByTime) {
                destroyRoom(redis, roomId, reason = if (expiredByTtl) "ttl_expired" else "idle_timeout")
            }
        }
    } while (!cursor.isFinished)
}

/**
 * destroyRoom
 *
 * Hard delete all known Redis keys for a room. Idempotent: safe if called
 * multiple times.
 */
suspend fun destroyRoom(
    redis: RedisAsyncCommands<String, String>,
    roomId: String,
    reason: String
) {
    val meta = metaKey(roomId)
    val keys = listOf(
        meta,
        ROOM_TO_PLAYERS_PREFIX + roomId,
        ROOM_TO_JOIN_CODE_PREFIX + roomId,
        ROOM_START_STATUS_PREFIX + roomId
    )
    redis.del(*keys.toTypedArray()).await()
}
