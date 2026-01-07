package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.cardMapping
import com.gameservice.models.Card
import com.gameservice.models.GameState
import com.gameservice.models.PlaceInBankMessage
import com.gameservice.models.PlayMoney
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

suspend fun playForMoney(room: DealGame, game: MutableStateFlow<GameState>, playerId: String, playMoney: PlayMoney) : GameState {
    return game.updateAndGet { current ->
        if (current.pendingInteractions.isNotEmpty()) return current
        val playerState = current.playerState[playerId] ?: return current
        val card = cardMapping[playMoney.id] ?: return current
        if (card !is Card.Money && card !is Card.ActionCard) return current

        if (current.playerAtTurn != playerId ||
            current.cardsLeftToPlay <= 0 ||
            !current.isCardInHand(playerId, card)) return current

        playerState.hand.removeIf { it.id == card.id }
        playerState.bank.add(card)
        room.sendBroadcast(PlaceInBankMessage(playerId, card))
        val cardsLeft = current.cardsLeftToPlay - 1
        return@updateAndGet current.copy(cardsLeftToPlay = cardsLeft)
    }
}
