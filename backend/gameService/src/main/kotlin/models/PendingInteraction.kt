package com.gameservice.models

import kotlinx.serialization.Serializable

@Serializable
class Interactions {
    private val _pendingInteractions: MutableList<PendingInteraction> = mutableListOf()
    val pendingInteractions: List<PendingInteraction>
        get() = _pendingInteractions

    fun add(pendingInteraction: PendingInteraction) : Unit? {
        if (_pendingInteractions.any { it.toPlayer == pendingInteraction.toPlayer }) return null // Target already in interaction
        // New initiator implies previous interaction should be complete
        val initiator = _pendingInteractions.firstOrNull()?.fromPlayer
        if (initiator != null && initiator != pendingInteraction.fromPlayer) return null
        _pendingInteractions.add(pendingInteraction)
        return Unit
    }

    fun remove(pendingInteraction: PendingInteraction) {
        _pendingInteractions.remove(pendingInteraction)
    }

    fun getTargetedInteraction(targetedPlayer: String) : PendingInteraction? {
        return _pendingInteractions.firstOrNull { it.toPlayer == targetedPlayer }
    }

    fun isInitiator(playerId: String) = _pendingInteractions.any { it.fromPlayer == playerId }

    fun isEmpty() : Boolean = pendingInteractions.isEmpty()
    fun isNotEmpty() : Boolean = pendingInteractions.isNotEmpty()
}

@Serializable
data class PendingInteraction(
    val fromPlayer: String,
    val toPlayer: String,
    val action: MultiStepInitiator,
    val initial: List<Int>,
    var awaitingResponseFrom: String,
    val offense: MutableList<Int> = mutableListOf(),
    val defense: MutableList<Int> = mutableListOf(),
    var resolved: Boolean = false
)
