package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.MAX_CARDS_PER_TURN
import com.gameservice.models.Card
import com.gameservice.models.CardDiscardedMessage
import com.gameservice.models.Discard
import com.gameservice.models.GameState
import com.gameservice.models.StartMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun discard(room: DealGame, game: MutableStateFlow<GameState>, playerId: String, action: Discard): GameState {
    return game.updateAndGet { current ->
        // Validate it's the player's turn
        if (current.playerAtTurn != playerId) return current
        
        // Validate no pending interactions
        if (current.pendingInteractions.isNotEmpty()) return current
        
        val playerState = current.playerState[playerId] ?: return current
        
        // Find the card in the player's hand
        val cardToDiscard = playerState.hand.find { it.id == action.cardId } ?: return current
        if (cardToDiscard is Card.Property) return current
        
        // Remove card from hand
        playerState.hand.removeIf { it.id == action.cardId }
        
        // Add to discard pile
        current.discardPile.add(cardToDiscard)
        
        // Broadcast the discard event
        room.sendBroadcast(CardDiscardedMessage(playerId, action.cardId, playerState.hand.size))
        
        // Discard action is complete - no automatic turn advancement
        // Turn advancement is handled by the EndTurn action
        return current
    }
}
