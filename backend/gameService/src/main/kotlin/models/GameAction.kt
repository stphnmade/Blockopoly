package com.gameservice.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// File for messages received from players
data class Command(val playerId: String, val command: GameAction)

@Serializable
sealed interface GameAction

@Serializable
@SerialName("StartTurn")
class StartTurn() : GameAction

@Serializable
@SerialName("EndTurn")
class EndTurn() : GameAction

@Serializable
@SerialName("PlayProperty")
data class PlayProperty(val id: Int, val color: Color) : GameAction

@Serializable
@SerialName("PlayMoney")
data class PlayMoney(val id: Int) : GameAction

@Serializable
@SerialName("RequestRent")
data class RequestRent(
    val rentCardId: Int,
    val rentDoublers: List<Int>,
    val rentingSetId: String,
    val rentColor: Color? = null,
    val target: String? = null
) : GameAction

@Serializable
@SerialName("AcceptCharge")
data class AcceptCharge(val payment: List<Int>) : GameAction

@Serializable
@SerialName("JustSayNo")
data class JustSayNo(val ids: List<Int>, val respondingTo: String? = null) : GameAction

@Serializable
@SerialName("AcceptJustSayNo")
data class AcceptJsn(val respondingTo: String) : GameAction

@Serializable
@SerialName("PassGo")
class PassGo(val id: Int) : GameAction

@Serializable
@SerialName("PlayDoubleRent")
data class PlayDoubleRent(val id: Int) : GameAction

@Serializable
@SerialName("DebtCollect")
data class DebtCollect(val id: Int, val target: String) : GameAction

@Serializable
@SerialName("Birthday")
data class Birthday(val id: Int) : GameAction

@Serializable
@SerialName("SlyDeal")
data class SlyDeal(
    val id: Int,
    val targetCard: Int,
    val colorToReceiveAs: Color? = null
) : GameAction

@Serializable
@SerialName("AcceptDeal")
data class AcceptDeal(val receiveAsColor: Color?) : GameAction

@Serializable
@SerialName("ForcedDeal")
data class ForcedDeal(
    val id: Int,
    val targetCard: Int,
    val cardToGive: Int,
    val colorToReceiveAs: Color? = null
) : GameAction

@Serializable
@SerialName("Dealbreaker")
data class Dealbreaker(val id: Int, val targetSetId: String) : GameAction
@Serializable
@SerialName("PlayDevelopment")
data class PlayDevelopment(val id: Int, val propertySetId: String) : GameAction

@Serializable
@SerialName("RestartGame")
class RestartGame() : GameAction

@Serializable
@SerialName("Discard")
data class Discard(val cardId: Int) : GameAction

@Serializable
@SerialName("MoveProperty")
data class MoveProperty(
    val cardId: Int,
    val fromSetId: String?,
    val toSetId: String,
    val position: Int? = null,
    val toColor: Color? = null
) : GameAction

@Serializable
@SerialName("PING")
data class Ping(val ts: Long) : GameAction

@Serializable
@SerialName("PONG")
data class Pong(val ts: Long) : GameAction
