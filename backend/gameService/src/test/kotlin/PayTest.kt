package com.gameservice

import com.gameservice.models.*
import com.gameservice.util.payRent
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PayTest {

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
            playerState = mutableMapOf(
                payerId to payerState,
                receiverId to receiverState
            ),
            playerOrder = listOf(payerId, receiverId),
            playerAtTurn = payerId
        )

        // 2. Attempt to pay with the wildcard
        val paymentWithWildcard = listOf(wildCard.id)
        val rentAmount = 2 // Request 2M

        val response = payRent(gameState, payerId, receiverId, paymentWithWildcard, rentAmount)

        // 3. Assert that the payment fails
        assertFalse(response.success, "Payment should fail when trying to use a 10-color wildcard")
    }
}
