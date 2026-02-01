package com.gameservice.handlers

import com.gameservice.DealGame
import com.gameservice.models.AcceptCharge
import com.gameservice.models.AcceptDeal
import com.gameservice.models.AcceptJsn
import com.gameservice.models.Birthday
import com.gameservice.models.Dealbreaker
import com.gameservice.models.DebtCollect
import com.gameservice.models.Discard
import com.gameservice.models.EndTurn
import com.gameservice.models.ForcedDeal
import com.gameservice.models.GameAction
import com.gameservice.models.GameState
import com.gameservice.models.JustSayNo
import com.gameservice.models.MoveProperty
import com.gameservice.models.PassGo
import com.gameservice.models.Ping
import com.gameservice.models.Pong
import com.gameservice.models.PlayDoubleRent
import com.gameservice.models.PlayDevelopment
import com.gameservice.models.PlayMoney
import com.gameservice.models.PlayProperty
import com.gameservice.models.RequestRent
import com.gameservice.models.RestartGame
import com.gameservice.models.SlyDeal
import com.gameservice.models.StartTurn
import kotlinx.coroutines.flow.MutableStateFlow

suspend fun applyAction(room: DealGame, game: MutableStateFlow<GameState>, playerId: String, action: GameAction) : GameState {
    return when (action) {
        is StartTurn -> startTurn(room, game.value, playerId)
        is PlayProperty -> playProperty(room, game, playerId, action)
        is PlayMoney -> playForMoney(room, game, playerId, action)
        is RequestRent -> requestRent(room, game, playerId, action)
        is AcceptCharge -> acceptCharge(room, game, playerId, action)
        is JustSayNo -> justSayNo(room, game, playerId, action)
        is AcceptJsn -> acceptJsn(room, game, playerId, action)
        is PassGo -> passGo(room, game, playerId, action)
        is PlayDoubleRent -> playDoubleRent(room, game, playerId, action)
        is Birthday -> itsMyBirthday(room, game, playerId, action)
        is DebtCollect -> debtCollect(room, game, playerId, action)
        is PlayDevelopment -> playDevelopment(room, game, playerId, action)
        is SlyDeal -> slyDeal(room, game, playerId, action)
        is ForcedDeal -> forcedDeal(room, game, playerId, action)
        is Dealbreaker -> dealbreaker(room, game, playerId, action)
        is AcceptDeal -> acceptDeal(room, game, playerId, action)
        is EndTurn -> endTurn(room, game, playerId)
        is Discard -> discard(room, game, playerId, action)
        is MoveProperty -> moveProperty(room, game, playerId, action)
        is RestartGame -> return game.value
        is Ping -> game.value
        is Pong -> game.value
    }
}
