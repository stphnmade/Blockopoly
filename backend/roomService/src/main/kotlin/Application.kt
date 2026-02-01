package com.roomservice

import io.ktor.server.application.Application

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    configureHTTP()
    configureAdministration()
    configureRouting()

    // Wire admin + lifecycle helpers that need Redis commands
    val redis = attributes[LETTUCE_REDIS_COMMANDS_KEY]
    configureAdminRooms(redis)
}
