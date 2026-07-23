package com.gameservice

import com.gameservice.models.*
import com.gameservice.util.payRent
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PayTest {

    @Test
    fun `host receives rent payment in bank`() {
        val moneyCard = cardMapping.values.first { it is Card.Money && it.value == 2 } as Card.Money
        val hostId = "host"
        val payerId = "guest"
        val hostState = PlayerState(mutableListOf(), PropertyCollection(), mutableSetOf())
        val payerState = PlayerState(
            mutableListOf(),
            PropertyCollection(),
            mutableSetOf(moneyCard)
        )
        val gameState = GameState(
            playerAtTurn = hostId,
            winningPlayer = null,
            drawPile = mutableListOf(),
            discardPile = mutableListOf(),
            playerState = mutableMapOf(hostId to hostState, payerId to payerState),
            playerOrder = listOf(hostId, payerId),
            cardsLeftToPlay = MAX_CARDS_PER_TURN,
            pendingInteractions = Interactions(),
            turnStarted = true
        )

        val response = payRent(gameState, payerId, hostId, listOf(moneyCard.id), 2)

        assertTrue(response.success)
        assertFalse(payerState.bank.contains(moneyCard))
        assertTrue(hostState.bank.contains(moneyCard))
    }

    @Test
    fun `test payRent does not allow paying with a 10-color wildcard`() {
        // 1. Setup Game State
        val wildCard = cardMapping.values.first { it is Card.Property && it.colors == ALL_COLOR_SET } as Card.Property
        val moneyCard = cardMapping.values.first { it is Card.Money && it.value == 1 } as Card.Money

        val payerId = "player1"
        val receiverId = "player2"

        val payerState = PlayerState(
            hand = mutableListOf(),
            propertyCollection = PropertyCollection(),
            bank = mutableSetOf(moneyCard)
        )
        payerState.addProperty(wildCard, null)

        val receiverState = PlayerState(
            hand = mutableListOf(),
            propertyCollection = PropertyCollection(),
            bank = mutableSetOf()
        )

        val gameState = GameState(
            playerAtTurn = payerId,
            winningPlayer = null,
            drawPile = mutableListOf(),
            discardPile = mutableListOf(),
            playerState = mutableMapOf(
                payerId to payerState,
                receiverId to receiverState
            ),
            playerOrder = listOf(payerId, receiverId),
            cardsLeftToPlay = MAX_CARDS_PER_TURN,
            pendingInteractions = Interactions(),
            turnStarted = true
        )

        // 2. Attempt to pay with the wildcard
        val paymentWithWildcard = listOf(wildCard.id)
        val rentAmount = 2 // Request 2M

        val response = payRent(gameState, payerId, receiverId, paymentWithWildcard, rentAmount)

        // 3. Assert that the payment fails
        assertFalse(response.success, "Payment should fail when trying to use a 10-color wildcard")
    }
}
