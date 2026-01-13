package com.gameservice.models

import com.gameservice.INITIAL_DRAW_COUNT
import com.gameservice.MAX_CARDS_PER_TURN
import com.gameservice.NUM_COMPLETE_SETS_TO_WIN
import com.gameservice.deck
import kotlinx.serialization.Serializable

@Serializable
class GameState(var playerAtTurn: String?,
                var winningPlayer: String?,
                val drawPile: MutableList<Card>,
                val discardPile: MutableList<Card>,
                val playerState: MutableMap<String, PlayerState>) {

    var playerOrder : List<String> = emptyList()
    var cardsLeftToPlay: Int = MAX_CARDS_PER_TURN
    var pendingInteractions: Interactions = Interactions()
    var turnStarted: Boolean = false

    constructor(players: List<String>) : this(
        null,
        null,
        deck.shuffled().toMutableList(),
        mutableListOf(),
        mutableMapOf()
    ) {
        playerOrder = players.shuffled()
        playerAtTurn = playerOrder.first()
        pendingInteractions = Interactions()
        players.forEach { id ->
            val hand = MutableList(INITIAL_DRAW_COUNT) { drawPile.removeFirst() }
            this.playerState[id] = PlayerState(hand, PropertyCollection(), mutableSetOf())
        }
    }

    constructor(
        playerAtTurn: String?,
        winningPlayer: String?,
        drawPile: MutableList<Card>,
        discardPile: MutableList<Card>,
        playerState: MutableMap<String, PlayerState>,
        playerOrder : List<String>,
        cardsLeftToPlay : Int,
        pendingInteractions: Interactions,
        turnStarted: Boolean
    ) : this(playerAtTurn, winningPlayer, drawPile, discardPile, playerState) {
        this.playerOrder = playerOrder
        this.cardsLeftToPlay = cardsLeftToPlay
        this.pendingInteractions = pendingInteractions
        this.turnStarted = turnStarted
    }

    fun draw(passGo: Boolean = false) : List<Card> {
        if (playerAtTurn == null) return emptyList()
        var numToDraw = 2
        if (!passGo) {
            playerState[playerAtTurn]?.hand?.size?.let { handSize ->
                if (handSize <= 0) {
                    numToDraw = 5
                }
            }
        }
        var cardsDrawn = 0
        val cards : MutableList<Card> = mutableListOf()
        while (cardsDrawn < numToDraw) {
            if (drawPile.isEmpty()) {
                drawPile.addAll(discardPile.shuffled())
                discardPile.clear()
            }
            cards.add(drawPile.removeFirst())
            cardsDrawn++
        }
        playerState[playerAtTurn]?.hand?.addAll(cards)
        return cards
    }

    fun copy(
        playerAtTurn: String? = this.playerAtTurn,
        winningPlayer: String? = this.winningPlayer,
        drawPile: MutableList<Card> = this.drawPile,
        discardPile: MutableList<Card> = this.discardPile,
        playerState: MutableMap<String, PlayerState> = this.playerState,
        playerOrder: List<String> = this.playerOrder,
        cardsLeftToPlay: Int = this.cardsLeftToPlay,
        pendingInteractions: Interactions = this.pendingInteractions,
        turnStarted: Boolean = this.turnStarted
    ): GameState {
        // If no winner has been recorded yet, derive one from the current board
        var effectiveWinner = winningPlayer ?: this.winningPlayer
        if (effectiveWinner == null) {
            effectiveWinner = playerState.entries
                .firstOrNull { (_, state) -> state.numCompleteSets() >= NUM_COMPLETE_SETS_TO_WIN }
                ?.key
        }
        return GameState(
            playerAtTurn,
            effectiveWinner,
            drawPile,
            discardPile,
            playerState,
            playerOrder,
            cardsLeftToPlay,
            pendingInteractions,
            turnStarted
        )
    }

    fun isCardInHand(player: String, card: Card): Boolean {
        return playerState[player]?.hand?.find { it.id == card.id } != null
    }

    fun getVisibleGameState(playerId: String) : VisibleGameState {
        return VisibleGameState(this, playerId)
    }
}

@Serializable
class VisibleGameState {
    val playerAtTurn : String?
    val winningPlayer: String?
    val cardsLeftToPlay : Int
    val playerOrder : List<String>
    val drawPileSize: Int
    val pendingInteractions : Interactions
    val playerState : MutableMap<String, PlayerState> = mutableMapOf()
    val discardPile : MutableList<Card>

    constructor(gameState: GameState, playerId: String) {
        playerAtTurn = gameState.playerAtTurn
        winningPlayer = gameState.winningPlayer
        drawPileSize = gameState.drawPile.size
        discardPile = gameState.discardPile
        cardsLeftToPlay = gameState.cardsLeftToPlay
        playerOrder = gameState.playerOrder
        pendingInteractions = gameState.pendingInteractions
        gameState.playerState.forEach {
                (id, state) ->  if (id == playerId) playerState[id] = state else playerState[id] = state.getPublicPlayerState()
        }
    }
}
