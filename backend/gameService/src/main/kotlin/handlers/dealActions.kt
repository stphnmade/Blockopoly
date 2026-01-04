package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.cardMapping
import com.gameservice.models.ActionType
import com.gameservice.models.Card
import com.gameservice.models.ForcedDeal
import com.gameservice.models.ForcedDealMessage
import com.gameservice.models.GameState
import com.gameservice.models.PendingInteraction
import com.gameservice.models.SlyDeal
import com.gameservice.models.SlyDealMessage
import com.gameservice.models.Dealbreaker
import com.gameservice.models.DealbreakerMessage
import com.gameservice.models.ActionInvalidMessage
import com.gameservice.util.playerToStealCardFrom
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun slyDeal(room: DealGame, gameState: MutableStateFlow<GameState>, playerId: String, action: SlyDeal) : GameState {
    return gameState.updateAndGet { current ->
        if (current.pendingInteractions.isNotEmpty() || current.playerAtTurn != playerId) return current
        val playerState = current.playerState[playerId] ?: return current
        val card = cardMapping[action.id] ?: return current
        if (card !is Card.Action || card.actionType != ActionType.SLY_DEAL || !current.isCardInHand(playerId, card) || current.cardsLeftToPlay <= 0) return current
        val targetCard = cardMapping[action.targetCard] ?: return current
        if (targetCard !is Card.Property) return current
        val targetPlayer = playerToStealCardFrom(playerId, targetCard, current.playerState) ?: return current
        val slyDealMessage = SlyDealMessage(playerId, targetPlayer, action.targetCard, action.colorToReceiveAs)
        current.pendingInteractions.add(
            PendingInteraction(
                fromPlayer = playerId,
                toPlayer = targetPlayer,
                action = slyDealMessage,
                initial = listOf(action.id),
                awaitingResponseFrom = targetPlayer,
            )
        )
        room.sendBroadcast(slyDealMessage)
        current.discardPile.add(card)
        playerState.hand.removeIf { it.id == card.id }
        return@updateAndGet current.copy(cardsLeftToPlay = current.cardsLeftToPlay - 1)
    }
}

suspend fun forcedDeal(room: DealGame, gameState: MutableStateFlow<GameState>, playerId: String, action: ForcedDeal) : GameState {
    return gameState.updateAndGet { current ->
        if (current.pendingInteractions.isNotEmpty() || current.playerAtTurn != playerId) return current
        val playerState = current.playerState[playerId] ?: return current
        val forcedDealCard = cardMapping[action.id] ?: return current
        if (forcedDealCard !is Card.Action || forcedDealCard.actionType != ActionType.FORCED_DEAL || !current.isCardInHand(playerId, forcedDealCard) || current.cardsLeftToPlay <= 0) return current
        val cardToGive = cardMapping[action.cardToGive]
            ?: return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: select a property to give.")
        if (cardToGive !is Card.Property) {
            return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: select a property to give.")
        }
        val givingSet = playerState.getSetOfProperty(cardToGive)
            ?: return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: you must give a property from your collection.")
        if (givingSet.isComplete) {
            return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: you must give a property from an incomplete set.")
        }
        val targetCard = cardMapping[action.targetCard]
            ?: return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: target property not found.")
        if (targetCard !is Card.Property) {
            return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: target property not found.")
        }
        val targetPlayer = playerToStealCardFrom(playerId, targetCard, current.playerState)
            ?: return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: no opponent owns that property.")
        val targetSet = current.playerState[targetPlayer]?.getSetOfProperty(targetCard)
            ?: return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: target property not found.")
        if (targetSet.isComplete) {
            return consumeInvalidAction(room, current, playerState, playerId, forcedDealCard, "Invalid Forced Deal: target property must be from an incomplete set.")
        }
        val forcedDealMessage = ForcedDealMessage(playerId, targetPlayer, action.cardToGive, action.colorToReceiveAs, action.targetCard)
        current.pendingInteractions.add(
            PendingInteraction(
                fromPlayer = playerId,
                toPlayer = targetPlayer,
                action = forcedDealMessage,
                initial = listOf(action.id),
                awaitingResponseFrom = targetPlayer,
            )
        )
        room.sendBroadcast(forcedDealMessage)
        current.discardPile.add(forcedDealCard)
        playerState.hand.removeIf { it.id == forcedDealCard.id }
        return@updateAndGet current.copy(cardsLeftToPlay = current.cardsLeftToPlay - 1)
    }
}

suspend fun dealbreaker(room: DealGame, gameState: MutableStateFlow<GameState>, playerId: String, action: Dealbreaker) : GameState {
    return gameState.updateAndGet { current ->
        if (current.pendingInteractions.isNotEmpty() || current.playerAtTurn != playerId) return current
        val playerState = current.playerState[playerId] ?: return current
        val card = cardMapping[action.id] ?: return current
        if (card !is Card.Action || card.actionType != ActionType.DEAL_BREAKER || !current.isCardInHand(playerId, card) || current.cardsLeftToPlay <= 0) return current

        val targetPlayerEntry = current.playerState.entries.find { entry ->
            entry.value.getPropertySet(action.targetSetId)?.isComplete == true
        } ?: return consumeInvalidAction(room, current, playerState, playerId, card, "Invalid Deal Breaker: no completed set available.")
        if (targetPlayerEntry.key == playerId) {
            return consumeInvalidAction(room, current, playerState, playerId, card, "Invalid Deal Breaker: you cannot target your own sets.")
        }

        val dealbreakerMessage = DealbreakerMessage(playerId, targetPlayerEntry.key, action.targetSetId)
        current.pendingInteractions.add(
            PendingInteraction(
                fromPlayer = playerId,
                toPlayer = targetPlayerEntry.key,
                action = dealbreakerMessage,
                initial = listOf(action.id),
                awaitingResponseFrom = targetPlayerEntry.key,
            )
        )
        room.sendBroadcast(dealbreakerMessage)
        current.discardPile.add(card)
        playerState.hand.removeIf { it.id == card.id }
        return@updateAndGet current.copy(cardsLeftToPlay = current.cardsLeftToPlay - 1)
    }
}

private suspend fun consumeInvalidAction(
    room: DealGame,
    current: GameState,
    playerState: com.gameservice.models.PlayerState,
    playerId: String,
    card: Card.Action,
    reason: String
): GameState {
    playerState.hand.removeIf { it.id == card.id }
    current.discardPile.add(card)
    room.sendBroadcast(ActionInvalidMessage(playerId, card.actionType.name, reason))
    return current.copy(cardsLeftToPlay = current.cardsLeftToPlay - 1)
}
