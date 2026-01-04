package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.NUM_COMPLETE_SETS_TO_WIN
import com.gameservice.cardMapping
import com.gameservice.models.AcceptDeal
import com.gameservice.models.Card
import com.gameservice.models.Color
import com.gameservice.models.DealbreakerAcceptedMessage
import com.gameservice.models.DealbreakerMessage
import com.gameservice.models.ForcedDealAcceptedMessage
import com.gameservice.models.ForcedDealMessage
import com.gameservice.models.GameState
import com.gameservice.models.PlayerState
import com.gameservice.models.SlyDealAcceptedMessage
import com.gameservice.models.SlyDealMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun acceptDeal(room: DealGame, game: MutableStateFlow<GameState>, playerId: String, action: AcceptDeal) : GameState {
    return game.updateAndGet { current ->
        val interaction = current.pendingInteractions.getTargetedInteraction(playerId) ?: return current
        if (interaction.awaitingResponseFrom != playerId) return current
        if (interaction.initial.size + interaction.offense.size == interaction.defense.size) return current
        val receiverState = current.playerState[interaction.fromPlayer] ?: return current
        val giverState = current.playerState[interaction.toPlayer] ?: return current
        val request = interaction.action
        when (request) {
            is SlyDealMessage -> {
                val targetCardInstance = cardMapping[request.targetCard] ?: return current
                if (targetCardInstance !is Card.Property) return current
                val destination = transferPropertyCard(current, receiverState, giverState, request.receivingAs, targetCardInstance) ?: return current
                current.pendingInteractions.remove(interaction)
                room.sendBroadcast(
                    SlyDealAcceptedMessage(
                        interaction.fromPlayer,
                        interaction.toPlayer,
                        request.targetCard,
                        destination
                    )
                )
            }
            is ForcedDealMessage -> {
                val targetCardInstance = cardMapping[request.targetCard] ?: return current
                if (targetCardInstance !is Card.Property) return current
                val cardToGiveInstance = cardMapping[request.requesterCard] ?: return current
                if (cardToGiveInstance !is Card.Property) return current

                val requesterDestinationSet = transferPropertyCard(current, receiverState, giverState, request.requesterReceivingAs, targetCardInstance) ?: return current
                val targetDestinationSet = transferPropertyCard(current, giverState, receiverState, action.receiveAsColor, cardToGiveInstance) ?: return current

                current.pendingInteractions.remove(interaction)
                room.sendBroadcast(
                    ForcedDealAcceptedMessage(
                        interaction.fromPlayer,
                        interaction.toPlayer,
                        request.targetCard,
                        requesterDestinationSet,
                        request.requesterCard,
                        targetDestinationSet
                    )
                )
            }
            is DealbreakerMessage -> {
                val takenSet = giverState.removePropertySet(request.targetSetId) ?: return current
                receiverState.addPropertySet(takenSet)
                current.pendingInteractions.remove(interaction)
                room.sendBroadcast(
                    DealbreakerAcceptedMessage(
                        interaction.fromPlayer,
                        interaction.toPlayer,
                        request.targetSetId
                    )
                )
            }
            else -> return current
        }
        var winner: String? = null
        if (receiverState.numCompleteSets() == NUM_COMPLETE_SETS_TO_WIN) {
            winner = interaction.fromPlayer
        } else if (giverState.numCompleteSets() == NUM_COMPLETE_SETS_TO_WIN) {
            winner = interaction.toPlayer
        }
        return@updateAndGet current.copy(winningPlayer = winner)
    }
}

fun transferPropertyCard(gameState: GameState, receiverState: PlayerState, giverState: PlayerState, receiveAs: Color?, card: Card.Property) : String? {
    val removedDevelopments = giverState.removeProperty(card) ?: return null
    gameState.discardPile.addAll(removedDevelopments)
    return receiverState.addProperty(card, receiveAs)
}
