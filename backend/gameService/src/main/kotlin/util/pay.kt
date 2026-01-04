package com.gameservice.util

import com.gameservice.DEVELOPMENT_ACTION_CARDS
import com.gameservice.cardMapping
import com.gameservice.models.ALL_COLOR_SET
import com.gameservice.models.Card
import com.gameservice.models.GameState

data class PayResponse(val success: Boolean = false, val propertyToDestinations: Map<Int, String> = emptyMap(), val bankCards: Set<Int> = emptySet())

fun pay(gameState: GameState, giver: String, receiver: String, payment: List<Int>, amountRequested: Int) : PayResponse {
    val paymentCards = payment.map { cardMapping[it] ?: return PayResponse() }
    val playerState = gameState.playerState[giver] ?: return PayResponse()
    val receiverPlayerState = gameState.playerState[receiver] ?: return PayResponse()

    if (playerState.totalValueExcludingWildcards() <= amountRequested) {
        if (playerState.getNumOfSellableCardsExcludingWildcards() != paymentCards.size) return PayResponse()
    } else {
        if (paymentCards.sumOf { cardValueForPayment(it) ?: return PayResponse() } < amountRequested) return PayResponse()
    }

    // Validate each card as belonging to paying player before starting payment
    paymentCards.forEach { card ->
        when (card) {
            is Card.Property -> {
                if (isTenColorWild(card)) return PayResponse()
                if (!playerState.isPropertyInCollection(card)) return PayResponse()
            }
            is Card.ActionCard -> {
                if (!playerState.bank.contains(card)) {
                    if (card.actionType in DEVELOPMENT_ACTION_CARDS) {
                        if (card !is Card.Action) return PayResponse()
                        if (!playerState.isDevelopmentInCollection(card)) return PayResponse()
                    } else return PayResponse()
                }
            }
            is Card.Money -> {
                if (!playerState.bank.contains(card)) return PayResponse()
            }
        }
    }
    // Complete payment
    val propertyToDestinations = mutableMapOf<Int, String>()
    val bankCards = mutableSetOf<Int>()
    paymentCards.forEach { card ->
        when (card) {
            is Card.Property -> {
                playerState.removeProperty(card)
                // Players can always Move property after they receive it since it's their turn so color isn't too important
                val destination = receiverPlayerState.addProperty(card, card.colors.first())!!
                propertyToDestinations[card.id] = destination
            }
            is Card.ActionCard -> {
                if (!playerState.bank.remove(card)) {
                    if (card.actionType in DEVELOPMENT_ACTION_CARDS) {
                        playerState.removeDevelopment(card as Card.Action)
                    }
                }
                receiverPlayerState.bank.add(card)
                bankCards.add(card.id)
            }
            is Card.Money -> {
                playerState.bank.remove(card)
                receiverPlayerState.bank.add(card)
                bankCards.add(card.id)
            }
        }
    }
    return PayResponse(true, propertyToDestinations, bankCards)
}

fun payRent(gameState: GameState, giver: String, receiver: String, payment: List<Int>, amountRequested: Int) : PayResponse {
    val paymentCards = payment.map { cardMapping[it] ?: return PayResponse() }
    val playerState = gameState.playerState[giver] ?: return PayResponse()
    val receiverPlayerState = gameState.playerState[receiver] ?: return PayResponse()

    val bankCardsInBank = playerState.bank.filter { it is Card.Money || it is Card.ActionCard }
    val bankById = bankCardsInBank.associateBy { it.id }
    val bankTotal = bankCardsInBank.sumOf { it.value ?: 0 }

    val propertyCards = playerState.propertyCollection.collection.values
        .flatMap { it.properties }
        .filterNot { isTenColorWild(it) }
    val propertyById = propertyCards.associateBy { it.id }
    val propertyTotal = propertyCards.sumOf { it.value ?: 0 }
    val totalValue = bankTotal + propertyTotal

    if (amountRequested <= 0) {
        return if (paymentCards.isEmpty()) PayResponse(true) else PayResponse()
    }

    val paymentMoney = mutableListOf<Card>()
    val paymentProperties = mutableListOf<Card.Property>()
    paymentCards.forEach { card ->
        when (card) {
            is Card.Money -> {
                if (!bankById.containsKey(card.id)) return PayResponse()
                paymentMoney.add(card)
            }
            is Card.ActionCard -> {
                if (!bankById.containsKey(card.id)) return PayResponse()
                paymentMoney.add(card)
            }
            is Card.Property -> {
                if (!propertyById.containsKey(card.id)) return PayResponse()
                paymentProperties.add(card)
            }
            else -> return PayResponse()
        }
    }

    val paymentMoneyTotal = paymentMoney.sumOf { it.value ?: 0 }
    val paymentPropertyTotal = paymentProperties.sumOf { it.value ?: 0 }
    val paymentTotal = paymentMoneyTotal + paymentPropertyTotal

    if (totalValue <= amountRequested) {
        if (paymentMoney.size != bankCardsInBank.size) return PayResponse()
        if (paymentProperties.size != propertyCards.size) return PayResponse()
    } else {
        if (paymentTotal < amountRequested) return PayResponse()
    }

    val propertyToDestinations = mutableMapOf<Int, String>()
    val bankCards = mutableSetOf<Int>()

    paymentMoney.forEach { card ->
        playerState.bank.remove(card)
        receiverPlayerState.bank.add(card)
        bankCards.add(card.id)
    }

    paymentProperties.forEach { card ->
        playerState.removeProperty(card)
        val destination = receiverPlayerState.addProperty(card, card.colors.first())!!
        propertyToDestinations[card.id] = destination
    }

    return PayResponse(true, propertyToDestinations, bankCards)
}

private fun cardValueForPayment(card: Card): Int? {
    return when (card) {
        is Card.Property -> card.value ?: 0
        else -> card.value
    }
}

private fun isTenColorWild(card: Card.Property): Boolean {
    return card.colors == ALL_COLOR_SET
}
