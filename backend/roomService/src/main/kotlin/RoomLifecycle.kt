package com.roomservice

import io.lettuce.core.api.async.RedisAsyncCommands
import kotlinx.coroutines.future.await

// TTL policy (seconds)
const val ROOM_IDLE_TTL_SECONDS: Long = 600  // 10 minutes
const val ROOM_EMPTY_TTL_SECONDS: Long = 60  // 1 minute

private fun roomMetaKey(roomId: String) = "room:$roomId:meta"

/**
 * touchRoom
 *
 * - Updates room:{roomId}:meta.lastActive (epoch ms)
 * - Ensures TTL is applied to all canonical room keys.
 *
 * NOTE: For now we explicitly EXPIRE the known v1:* keys alongside the
 * new meta key so existing deployments stay clean without migration.
 */
suspend fun touchRoom(
    redis: RedisAsyncCommands<String, String>,
    roomId: String,
    ttlSeconds: Long
) {
    val now = System.currentTimeMillis().toString()
    val metaKey = roomMetaKey(roomId)

    // Store basic metadata; keep simple string fields inside a hash.
    redis.hset(metaKey, mapOf("lastActive" to now)).await()

    // Apply TTL to the canonical meta key and all per-room keys we know.
    val keys = listOf(
        metaKey,
        ROOM_TO_PLAYERS_PREFIX + roomId,
        ROOM_TO_JOIN_CODE_PREFIX + roomId,
        ROOM_START_STATUS_PREFIX + roomId
    )
    keys.forEach { key ->
        redis.expire(key, ttlSeconds).await()
    }
}

