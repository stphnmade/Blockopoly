package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.cardMapping
import com.gameservice.colorToRent
import com.gameservice.models.ActionType
import com.gameservice.models.Card
import com.gameservice.models.Color
import com.gameservice.models.GameState
import com.gameservice.models.PendingInteraction
import com.gameservice.models.RentRequestMessage
import com.gameservice.models.RequestRent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun requestRent(room: DealGame, game: MutableStateFlow<GameState>, playerId: String, rentRequest: RequestRent) : GameState {
    return game.updateAndGet { current ->
        if (current.pendingInteractions.isNotEmpty()) return current
        val rentCard = cardMapping[rentRequest.rentCardId] ?: return current
        if (rentCard !is Card.Rent) return current
        val playerState = current.playerState[playerId] ?: return current
        val numCardsConsumed = 1 + rentRequest.rentDoublers.size
        val doublers = rentRequest.rentDoublers.map {
            val doubleRentCard = cardMapping[it]
            if (doubleRentCard !is Card.ActionCard || doubleRentCard.actionType != ActionType.DOUBLE_RENT) {
                return current
            }
            return@map doubleRentCard
        }
        if (doublers.any { !current.isCardInHand(playerId, it) }) return current
        if (current.playerAtTurn != playerId || current.cardsLeftToPlay < numCardsConsumed ||
            !current.isCardInHand(playerId, rentCard)) {
            return current
        }
        if (rentRequest.target != null) {
            if (rentRequest.target == playerId) return current
            if (current.playerState[rentRequest.target] == null) return current
        }
        if (rentCard.actionType == ActionType.RENT && rentRequest.target != null) {
            return current
        }

        val chosenColor = resolveRentColor(playerState.getPropertySet(rentRequest.rentingSetId)?.color, rentRequest.rentColor)
            ?: return current
        if (!rentCard.colors.contains(chosenColor)) return current
        val rentTiers = colorToRent[chosenColor] ?: return current
        val propertyCount = playerState.propertyCollection.collection.values
            .filter { it.color == chosenColor }
            .sumOf { it.properties.size }
        val cappedCount = propertyCount.coerceAtMost(rentTiers.size)
        val baseRent = if (cappedCount <= 0) 0 else rentTiers[cappedCount - 1]
        val developmentBonus = playerState.propertyCollection.collection.values
            .filter { it.color == chosenColor && it.isComplete }
            .maxOfOrNull { (it.house?.value ?: 0) + (it.hotel?.value ?: 0) } ?: 0
        val rentMultiplier = 1 shl rentRequest.rentDoublers.size
        val totalRent = (baseRent + developmentBonus) * rentMultiplier

        val targets = if (rentRequest.target == null) {
            current.playerState.keys.filter { it != playerId }
        } else {
            listOf(rentRequest.target)
        }
        if (targets.isEmpty()) return current

        val cardsUsed = listOf(rentCard.id) + rentRequest.rentDoublers
        val rentRequestMessage = RentRequestMessage(
            playerId,
            targets,
            cardsUsed,
            totalRent,
            baseRent + developmentBonus,
            rentMultiplier,
            chosenColor
        )

        if (rentRequest.target != null) {
            current.pendingInteractions.add(
                PendingInteraction(
                    playerId,
                    rentRequest.target,
                    rentRequestMessage,
                    listOf(rentCard.id),
                    rentRequest.target
                )
            ) ?: return current
        } else {
            current.playerState.keys.forEach { victim ->
                if (victim == playerId) return@forEach
                current.pendingInteractions.add(
                    PendingInteraction(
                        playerId,
                        victim,
                        rentRequestMessage,
                        listOf(rentCard.id),
                        victim,
                    )
                ) ?: return current
            }
        }
        room.sendBroadcast(rentRequestMessage)
        playerState.hand.removeIf { it.id in cardsUsed }
        current.discardPile.addAll(doublers + rentCard)
        return@updateAndGet current.copy(cardsLeftToPlay = current.cardsLeftToPlay - numCardsConsumed)
    }
}

private fun resolveRentColor(setColor: Color?, requestedColor: Color?): Color? {
    return requestedColor ?: setColor
}
