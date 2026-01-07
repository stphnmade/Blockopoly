package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.models.Card
import com.gameservice.models.Color
import com.gameservice.models.MoveProperty
import com.gameservice.models.PropertyMovedMessage
import com.gameservice.models.PropertySet
import com.gameservice.models.GameState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet
import java.util.UUID

suspend fun moveProperty(room: DealGame, game: MutableStateFlow<GameState>, playerId: String, action: MoveProperty): GameState {
    return game.updateAndGet { current ->
        // Validate it's the player's turn
        if (current.playerAtTurn != playerId) return current
        
        // Validate no pending interactions
        if (current.pendingInteractions.isNotEmpty()) return current
        
        val playerState = current.playerState[playerId] ?: return current
        
        // Find the property in the player's collection
        val propertyToMove = playerState.propertyCollection.collection.values
            .flatMap { it.properties }
            .find { it.id == action.cardId } ?: return current
        
        val isNewSet = action.toSetId == "NEW_SET"

        // Get the source set (if specified)
        val fromSet = if (action.fromSetId != null) {
            playerState.propertyCollection.getPropertySet(action.fromSetId) ?: return current
        } else {
            playerState.propertyCollection.getSetOfProperty(action.cardId) ?: return current
        }
        
        if (!isNewSet && fromSet.propertySetId == action.toSetId) return current

        // Get the target set when moving into an existing set
        val toSet = if (!isNewSet) {
            playerState.propertyCollection.getPropertySet(action.toSetId) ?: return current
        } else {
            null
        }

        // Validate both sets belong to the same player (already validated by getting from playerState)
        // Validate the move is legal according to game rules

        val propertyColors = propertyToMove.colors
        val isRainbow = propertyColors == com.gameservice.models.ALL_COLOR_SET
        val targetColor = if (isNewSet) action.toColor else toSet?.color

        if (isNewSet) {
            if (isRainbow) return current
            if (targetColor == null) return current
            if (!propertyColors.contains(targetColor)) return current
        } else {
            if (toSet == null) return current
            if (toSet.isComplete) return current
        }

        // Determine the effective color for wild cards
        val effectiveColor = when {
            isRainbow -> targetColor
            propertyColors.size > 1 -> if (targetColor != null && propertyColors.contains(targetColor)) targetColor else return current
            else -> if (targetColor != null && propertyColors.contains(targetColor)) targetColor else return current
        }
        
        // Remove property from source set
        val (wasRemoved, removedDevelopments) = fromSet.removeProperty(propertyToMove)
        if (!wasRemoved) return current
        
        // Discard removed developments when a set becomes incomplete
        removedDevelopments?.let { current.discardPile.addAll(it) }
        
        // If source set is now empty, remove it, otherwise refresh its mappings
        if (fromSet.isSetEmpty()) {
            playerState.propertyCollection.removePropertySet(fromSet.propertySetId)
        } else {
            val refreshedSet = playerState.propertyCollection.removePropertySet(fromSet.propertySetId)
            if (refreshedSet != null) {
                playerState.propertyCollection.addPropertySet(refreshedSet)
            }
        }

        val finalToSetId = if (isNewSet) {
            val newSetId = UUID.randomUUID().toString().replace("-", "")
            val newSet = PropertySet(newSetId, color = targetColor)
            newSet.addProperty(propertyToMove, effectiveColor)
            playerState.propertyCollection.addPropertySet(newSet)
            newSetId
        } else {
            val existingSet = toSet ?: return current
            // Add property to target set with effective color
            existingSet.addProperty(propertyToMove, effectiveColor)

            // Update property-to-set mapping by removing and re-adding the set
            // This ensures the internal mapping is updated correctly
            val tempSet = playerState.propertyCollection.removePropertySet(existingSet.propertySetId)
            if (tempSet != null) {
                playerState.propertyCollection.addPropertySet(tempSet)
            }
            existingSet.propertySetId
        }
        
        // Broadcast the move event
        room.sendBroadcast(PropertyMovedMessage(
            playerId = playerId,
            cardId = action.cardId,
            fromSetId = action.fromSetId,
            toSetId = finalToSetId,
            newIdentityIfWild = if (propertyColors.size > 1) effectiveColor else null
        ))
        
        return current
    }
}
