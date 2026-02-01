package com.roomservice

import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopping
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.origin
import io.ktor.server.plugins.ratelimit.RateLimit
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respondText
import io.ktor.server.sse.SSE
import io.lettuce.core.RedisClient
import io.lettuce.core.api.StatefulRedisConnection
import io.lettuce.core.api.async.RedisAsyncCommands
import org.koin.ktor.ext.inject
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger
import kotlin.time.Duration.Companion.seconds

fun Application.configureAdministration() {
    install(ContentNegotiation) {
        json()
    }

    install(SSE) {}

    install(RateLimit) {
        global {
            rateLimiter(limit = 5, refillPeriod = 10.seconds)
            requestKey { applicationCall -> applicationCall.request.origin.remoteAddress }
        }
    }

    install(StatusPages) {
        status(HttpStatusCode.TooManyRequests) { call, status ->
            val retryAfter = call.response.headers["Retry-After"]
            call.respondText(text = "429: Too many requests. Wait for $retryAfter seconds.", status = status)
        }
    }

    // Install Koin
    install(Koin) {
        slf4jLogger()
        modules(redisModule(environment))
    }

    val redisClient: RedisClient by inject()
    val connection: StatefulRedisConnection<String, String> by inject()
    val asyncCommands: RedisAsyncCommands<String, String> by inject()

    attributes.put(LETTUCE_REDIS_CLIENT_KEY, redisClient)
    attributes.put(LETTUCE_REDIS_CONNECTION_KEY, connection)
    attributes.put(LETTUCE_REDIS_COMMANDS_KEY,  asyncCommands)
    attributes.put(PUBSUB_MANAGER_KEY, inject<RedisPubSubManager>().value)

    // Start room janitor for Redis-backed room metadata/keys.
    startRoomJanitor(asyncCommands)

    monitor.subscribe(ApplicationStopping) {
        connection.close()
        redisClient.shutdown()
        monitor.unsubscribe(ApplicationStopping) {}
    }
}
