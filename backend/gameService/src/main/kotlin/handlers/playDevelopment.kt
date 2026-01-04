package com.gameservice.handlers

import com.gameservice.DEVELOPMENT_ACTION_CARDS
import com.gameservice.DealGame
import com.gameservice.cardMapping
import com.gameservice.models.Card
import com.gameservice.models.DevelopmentAddedMessage
import com.gameservice.models.GameState
import com.gameservice.models.PlayDevelopment
import com.gameservice.models.ActionInvalidMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun playDevelopment(room: DealGame, game: MutableStateFlow<GameState>, playerId: String, action : PlayDevelopment) : GameState {
    return game.updateAndGet { current ->
        if (current.pendingInteractions.isNotEmpty()) return current
        val card = cardMapping[action.id] ?: return current
        if (card !is Card.Action || card.actionType !in DEVELOPMENT_ACTION_CARDS) return current
        val playerState = current.playerState[playerId] ?: return current
        if (current.playerAtTurn != playerId || current.cardsLeftToPlay <= 0 ||
            !current.isCardInHand(playerId, card)) return current
        val targetSet = playerState.getPropertySet(action.propertySetId)
        val invalidReason = when {
            targetSet == null -> "Invalid development: select a valid property set."
            !targetSet.isComplete -> "Invalid development: set must be complete."
            card.actionType == com.gameservice.models.ActionType.HOUSE && targetSet.house != null ->
                "Invalid development: that set already has a house."
            card.actionType == com.gameservice.models.ActionType.HOTEL && targetSet.house == null ->
                "Invalid development: hotels require a house first."
            card.actionType == com.gameservice.models.ActionType.HOTEL && targetSet.hotel != null ->
                "Invalid development: that set already has a hotel."
            else -> null
        }
        if (invalidReason != null || playerState.addDevelopment(card, action.propertySetId) == null) {
            playerState.hand.removeIf { it.id == card.id }
            current.discardPile.add(card)
            room.sendBroadcast(ActionInvalidMessage(playerId, card.actionType.name, invalidReason ?: "Invalid development: no valid target."))
            return@updateAndGet current.copy(cardsLeftToPlay = current.cardsLeftToPlay - 1)
        }
        room.sendBroadcast(DevelopmentAddedMessage(card, action.propertySetId))
        playerState.hand.removeIf { it.id == card.id }
        return@updateAndGet current.copy(cardsLeftToPlay = current.cardsLeftToPlay - 1)
    }
}
