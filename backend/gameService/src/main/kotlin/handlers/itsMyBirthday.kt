package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.cardMapping
import com.gameservice.models.ActionType
import com.gameservice.models.Birthday
import com.gameservice.models.BirthdayMessage
import com.gameservice.models.Card
import com.gameservice.models.GameState
import com.gameservice.models.PendingInteraction
import com.gameservice.models.PlayUnstoppableActionMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun itsMyBirthday(room: DealGame, gameState: MutableStateFlow<GameState>, playerId: String, action: Birthday) : GameState {
    return gameState.updateAndGet { current ->
        if (current.pendingInteractions.isNotEmpty() || current.playerAtTurn != playerId) return current
        val playerState = current.playerState[playerId] ?: return current
        val card = cardMapping[action.id] ?: return current
        if (card !is Card.Action || card.actionType != ActionType.BIRTHDAY || !current.isCardInHand(playerId, card) || current.cardsLeftToPlay <= 0) return current
        val birthdayMessage = BirthdayMessage(playerId, card.id)
        room.sendBroadcast(PlayUnstoppableActionMessage(playerId, card))
        current.playerState.keys.forEach { id ->
            if (id == playerId) return@forEach
            current.pendingInteractions.add(
                PendingInteraction(
                    fromPlayer = playerId,
                    toPlayer = id,
                    action = birthdayMessage,
                    initial = listOf(card.id),
                    awaitingResponseFrom = id,
                )
            ) ?: return current
        }
        room.sendBroadcast(birthdayMessage)
        current.discardPile.add(card)
        playerState.hand.removeIf { it.id == card.id }
        return@updateAndGet current.copy(cardsLeftToPlay = current.cardsLeftToPlay - 1)
    }
}
