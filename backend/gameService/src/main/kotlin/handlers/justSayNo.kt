package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.cardMapping
import com.gameservice.models.ActionType
import com.gameservice.models.Card
import com.gameservice.models.GameState
import com.gameservice.models.JustSayNo
import com.gameservice.models.JustSayNoMessage
import com.gameservice.models.DevelopmentRequestMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun justSayNo(room: DealGame, game: MutableStateFlow<GameState>, playerId: String, justSayNo: JustSayNo) : GameState {
    return game.updateAndGet { current ->
        val playerState = current.playerState[playerId] ?: return current
        val interaction =
            if (justSayNo.respondingTo != null) {
                current.pendingInteractions.getTargetedInteraction(justSayNo.respondingTo)
            } else {
                current.pendingInteractions.getTargetedInteraction(playerId)
            } ?: return current
        if (interaction.awaitingResponseFrom != playerId || interaction.resolved) return current
        if (interaction.action is DevelopmentRequestMessage) return current
        if (justSayNo.ids.isEmpty()) return current
        val jsnCards = justSayNo.ids.map { cardMapping[it] ?: return current }
        if (jsnCards.any {
                it !is Card.Action || it.actionType != ActionType.JUST_SAY_NO || !current.isCardInHand(playerId, it)
            }) return current

        val aggressor = interaction.fromPlayer == playerId
        if (aggressor) {
            if (interaction.offense.size + justSayNo.ids.size > interaction.defense.size) return current // Too many JSNs played
            interaction.offense.addAll(justSayNo.ids)
            interaction.awaitingResponseFrom = interaction.toPlayer
            room.sendBroadcast(JustSayNoMessage(playerId, interaction.toPlayer))
        } else {
            if (interaction.defense.isEmpty()) {
                if (justSayNo.ids.size > interaction.initial.size) return current
            } else {
                if (justSayNo.ids.size > interaction.offense.size) return current
            }
            interaction.defense.addAll(justSayNo.ids)
            interaction.awaitingResponseFrom = interaction.fromPlayer
            room.sendBroadcast(JustSayNoMessage(playerId, interaction.fromPlayer))
        }
        playerState.hand.removeIf { it.id in justSayNo.ids }
        current.discardPile.addAll(jsnCards)
        return@updateAndGet current.copy()
    }
}
