package com.gameservice

import com.gameservice.handlers.playForMoney
import com.gameservice.models.Card
import com.gameservice.models.GameState
import com.gameservice.models.Interactions
import com.gameservice.models.PlayMoney
import com.gameservice.models.PlayerState
import com.gameservice.models.PropertyCollection
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BankingTest {
    @Test
    fun `every money and action card can be liquidated from hand`() = runBlocking {
        val bankableCards = cardMapping.values.filter {
            it is Card.Money || it is Card.ActionCard
        }

        bankableCards.forEach { card ->
            val playerId = "host"
            val player = PlayerState(
                hand = mutableListOf(card),
                propertyCollection = PropertyCollection(),
                bank = mutableSetOf()
            )
            val initial = GameState(
                playerAtTurn = playerId,
                winningPlayer = null,
                drawPile = mutableListOf(),
                discardPile = mutableListOf(),
                playerState = mutableMapOf(playerId to player),
                playerOrder = listOf(playerId),
                cardsLeftToPlay = MAX_CARDS_PER_TURN,
                pendingInteractions = Interactions(),
                turnStarted = true
            )

            val result = playForMoney(
                DealGame("banking-${card.id}", listOf(playerId)),
                MutableStateFlow(initial),
                playerId,
                PlayMoney(card.id)
            )

            assertFalse(result.playerState.getValue(playerId).hand.any { it.id == card.id })
            assertTrue(result.playerState.getValue(playerId).bank.any { it.id == card.id })
            assertEquals(MAX_CARDS_PER_TURN - 1, result.cardsLeftToPlay)
        }
    }
}
