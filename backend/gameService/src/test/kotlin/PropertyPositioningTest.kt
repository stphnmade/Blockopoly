package com.gameservice

import com.gameservice.handlers.moveProperty
import com.gameservice.handlers.playProperty
import com.gameservice.models.ALL_COLOR_SET
import com.gameservice.models.Card
import com.gameservice.models.Color
import com.gameservice.models.GameState
import com.gameservice.models.Interactions
import com.gameservice.models.MoveProperty
import com.gameservice.models.PlayerState
import com.gameservice.models.PlayProperty
import com.gameservice.models.PropertyCollection
import com.gameservice.models.PropertySet
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class PropertyPositioningTest {
    @Test
    fun `dual-color property can join either compatible collection`() {
        val dual = property(1, Color.BLUE, Color.GREEN)
        val blueSet = PropertySet("blue", color = Color.BLUE)
        val greenSet = PropertySet("green", color = Color.GREEN)

        assertTrue(blueSet.addProperty(dual, Color.BLUE))
        assertTrue(greenSet.addProperty(property(2, Color.BLUE, Color.GREEN), Color.GREEN))
        assertEquals(Color.BLUE, blueSet.color)
        assertEquals(Color.GREEN, greenSet.color)
    }

    @Test
    fun `rainbow property can join any incomplete colored collection`() {
        val rainbow = Card.Property(10, ALL_COLOR_SET, 0)
        val blueSet = PropertySet("blue", color = Color.BLUE)
        val railroadSet = PropertySet("railroad", color = Color.RAILROAD)

        assertTrue(blueSet.addProperty(rainbow, Color.BLUE))
        assertTrue(railroadSet.addProperty(Card.Property(11, ALL_COLOR_SET, 0), Color.RAILROAD))
        assertEquals(Color.BLUE, blueSet.color)
        assertEquals(Color.RAILROAD, railroadSet.color)
    }

    @Test
    fun `complete collection rejects another compatible property`() {
        val blueSet = PropertySet("blue", color = Color.BLUE)
        assertTrue(blueSet.addProperty(property(20, Color.BLUE), Color.BLUE))
        assertTrue(blueSet.addProperty(property(21, Color.BLUE), Color.BLUE))
        assertTrue(blueSet.isComplete)

        assertFalse(blueSet.addProperty(property(22, Color.BLUE, Color.GREEN), Color.BLUE))
        assertEquals(listOf(20, 21), blueSet.properties.map { it.id })
    }

    @Test
    fun `rejected move to full collection preserves source card`() = runBlocking {
        val playerId = "player"
        val movingCard = property(30, Color.BLUE, Color.GREEN)
        val source = PropertySet("source", color = Color.GREEN)
        assertTrue(source.addProperty(movingCard, Color.GREEN))

        val fullTarget = PropertySet("target", color = Color.BLUE)
        assertTrue(fullTarget.addProperty(property(31, Color.BLUE), Color.BLUE))
        assertTrue(fullTarget.addProperty(property(32, Color.BLUE), Color.BLUE))
        // Exercise the explicit capacity check even if persisted completion metadata is stale.
        fullTarget.isComplete = false

        val collection = PropertyCollection().apply {
            addPropertySet(source)
            addPropertySet(fullTarget)
        }
        val player = PlayerState(mutableListOf(), collection, mutableSetOf())
        val state = GameState(
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

        moveProperty(
            DealGame("property-positioning-test", listOf(playerId)),
            MutableStateFlow(state),
            playerId,
            MoveProperty(movingCard.id, source.propertySetId, fullTarget.propertySetId)
        )

        val preservedSource = assertNotNull(collection.getPropertySet(source.propertySetId))
        assertEquals(listOf(movingCard.id), preservedSource.properties.map { it.id })
        assertEquals(source.propertySetId, collection.getSetOfProperty(movingCard.id)?.propertySetId)
        assertEquals(listOf(31, 32), collection.getPropertySet(fullTarget.propertySetId)?.properties?.map { it.id })
        assertTrue(state.discardPile.isEmpty())
    }

    @Test
    fun `playing a wild property into a full collection preserves the hand`() = runBlocking {
        val playerId = "player"
        val blueCards = cardMapping.values
            .filterIsInstance<Card.Property>()
            .filter { it.colors == setOf(Color.BLUE) }
        val rainbow = cardMapping.values
            .filterIsInstance<Card.Property>()
            .first { it.colors == ALL_COLOR_SET }
        val fullTarget = PropertySet("blue", color = Color.BLUE)
        blueCards.forEach { assertTrue(fullTarget.addProperty(it, Color.BLUE)) }
        fullTarget.isComplete = false
        val collection = PropertyCollection().apply { addPropertySet(fullTarget) }
        val player = PlayerState(mutableListOf(rainbow), collection, mutableSetOf())
        val state = GameState(
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

        val result = playProperty(
            DealGame("full-property-play-test", listOf(playerId)),
            MutableStateFlow(state),
            playerId,
            PlayProperty(rainbow.id, Color.BLUE)
        )

        assertTrue(result.playerState.getValue(playerId).hand.contains(rainbow))
        assertEquals(MAX_CARDS_PER_TURN, result.cardsLeftToPlay)
        assertEquals(blueCards.map { it.id }, fullTarget.properties.map { it.id })
    }

    private fun property(id: Int, vararg colors: Color) =
        Card.Property(id, colors.toSet(), 1)
}
