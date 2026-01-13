package com.roomservice

import io.github.cdimascio.dotenv.dotenv
import io.ktor.util.AttributeKey
import io.lettuce.core.RedisClient
import io.lettuce.core.api.StatefulRedisConnection
import io.lettuce.core.api.async.RedisAsyncCommands

// Load .env if present; don't crash if missing (Docker uses real env vars)
private val dot = dotenv {
    directory = "."
    ignoreIfMissing = true
    ignoreIfMalformed = true
}

// Prefer real env vars, then .env, then default; fail if truly required
private fun env(name: String, default: String? = null): String =
    System.getenv(name) ?: dot[name] ?: default
        ?: error("Missing required env var: $name")

// ---- Stable attribute keys (NOT env-based) ----
val LETTUCE_REDIS_CLIENT_KEY =
    AttributeKey<RedisClient>("REDIS_CLIENT")

val LETTUCE_REDIS_CONNECTION_KEY =
    AttributeKey<StatefulRedisConnection<String, String>>("REDIS_CONNECTION")

val LETTUCE_REDIS_COMMANDS_KEY =
    AttributeKey<RedisAsyncCommands<String, String>>("REDIS_ASYNC_COMMANDS")

val PUBSUB_MANAGER_KEY =
    AttributeKey<RedisPubSubManager>("PUBSUB_MANAGER_KEY")

// ---- Config from env/.env with sane defaults for Docker ----
val REDIS_HOST: String = env("KTOR_REDIS_HOST", "redis")
val REDIS_PORT: Int    = env("KTOR_REDIS_PORT", "6379").toInt()
val PORT: Int          = env("PORT", "8080").toInt()

// (your other consts unchanged)
const val JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz"
const val PLAYER_TO_NAME_PREFIX = "v1:p2n:"
const val PLAYER_TO_ROOM_PREFIX = "v1:p2r:"
const val ROOM_TO_PLAYERS_PREFIX = "v1:r2p:"
const val JOIN_CODE_TO_ROOM_PREFIX = "v1:j2r:"
const val ROOM_TO_JOIN_CODE_PREFIX = "v1:r2j:"
const val ROOM_START_STATUS_PREFIX = "v1:rss:"
const val ROOM_CLIENT_TO_PLAYER_PREFIX = "v1:rc2p:"
const val JOIN_CODE_SIZE = 6
const val MAX_PLAYERS = 5L
enum class RoomBroadcastType { INITIAL, JOIN, LEAVE, CLOSED, HOST, RECONNECT, ERROR }
enum class ErrorType { BAD_REQUEST, SERVICE_UNAVAILABLE, INTERNAL_SERVER_ERROR, ROOM_NOT_FOUND, ROOM_FULL, ROOM_ALREADY_STARTED }
const val ROOM_BROADCAST_TYPE_DELIMITER = "#"
const val ROOM_BROADCAST_MSG_DELIMITER = ":"
const val ROOM_START_CHANNEL = "START"
const val SECS_IN_HOUR = (60 * 60).toLong()
