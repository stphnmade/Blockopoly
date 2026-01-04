package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.cardMapping
import com.gameservice.models.AcceptJsn
import com.gameservice.models.DevelopmentRequestMessage
import com.gameservice.models.GameState
import com.gameservice.models.PendingInteraction
import com.gameservice.models.Card
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

fun acceptJsn(room: DealGame, gameState: MutableStateFlow<GameState>, playerId: String, acceptJsn: AcceptJsn) : GameState{
    return gameState.updateAndGet { current ->
        val interaction = resolveInteraction(current, playerId, acceptJsn.respondingTo) ?: return current
        if (interaction.awaitingResponseFrom != playerId) return current
        if (interaction.offense.isEmpty() && interaction.defense.isEmpty()) {
            interaction.resolved = true
            if (interaction.action is DevelopmentRequestMessage) {
                current.pendingInteractions.remove(interaction)
            }
            return@updateAndGet current.copy()
        }
        if (isActionCancelled(interaction)) {
            if (interaction.action is DevelopmentRequestMessage) {
                rollbackDevelopmentIfNeeded(current, interaction)
                removeDevelopmentInteractions(current, interaction)
            } else {
                current.pendingInteractions.remove(interaction)
            }
        } else {
            interaction.resolved = true
            if (interaction.action is DevelopmentRequestMessage) {
                current.pendingInteractions.remove(interaction)
            }
        }
        return@updateAndGet current.copy()
    }
}

private fun resolveInteraction(current: GameState, playerId: String, respondingTo: String?) : PendingInteraction? {
    if (!respondingTo.isNullOrBlank()) {
        current.pendingInteractions.getTargetedInteraction(respondingTo)?.let { return it }
    }
    return current.pendingInteractions.getTargetedInteraction(playerId)
}

private fun rollbackDevelopmentIfNeeded(current: GameState, interaction: PendingInteraction) {
    val action = interaction.action
    if (action !is DevelopmentRequestMessage) return
    val card = cardMapping[action.cardId] ?: return
    if (card !is Card.Action) return
    val requester = current.playerState[action.requester] ?: return
    requester.removeDevelopment(card)
}

private fun removeDevelopmentInteractions(current: GameState, interaction: PendingInteraction) {
    val action = interaction.action
    if (action !is DevelopmentRequestMessage) return
    val toRemove = current.pendingInteractions.pendingInteractions.filter {
        val candidate = it.action
        candidate is DevelopmentRequestMessage &&
            candidate.cardId == action.cardId &&
            candidate.requester == action.requester
    }
    toRemove.forEach { current.pendingInteractions.remove(it) }
}

fun isActionCancelled(interaction: PendingInteraction) : Boolean {
    return (interaction.initial.size + interaction.offense.size) == interaction.defense.size
}
