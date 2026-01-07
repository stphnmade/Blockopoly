package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.cardMapping
import com.gameservice.models.ActionInvalidMessage
import com.gameservice.models.ActionType
import com.gameservice.models.Card
import com.gameservice.models.GameState
import com.gameservice.models.PlayDoubleRent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun playDoubleRent(
    room: DealGame,
    game: MutableStateFlow<GameState>,
    playerId: String,
    action: PlayDoubleRent
): GameState {
    return game.updateAndGet { current ->
        if (current.pendingInteractions.isNotEmpty()) return current
        val playerState = current.playerState[playerId] ?: return current
        val card = cardMapping[action.id] ?: return current
        if (card !is Card.Action || card.actionType != ActionType.DOUBLE_RENT) return current
        if (current.playerAtTurn != playerId || current.cardsLeftToPlay <= 0 ||
            !current.isCardInHand(playerId, card)) return current

        playerState.hand.removeIf { it.id == card.id }
        current.discardPile.add(card)
        room.sendBroadcast(
            ActionInvalidMessage(
                playerId,
                card.actionType.name,
                "Double The Rent must be played with a Rent card."
            )
        )
        return@updateAndGet current.copy(cardsLeftToPlay = current.cardsLeftToPlay - 1)
    }
}
