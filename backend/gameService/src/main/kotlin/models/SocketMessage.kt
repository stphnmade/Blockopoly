package com.gameservice.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// File for messages to be sent to players
@Serializable
sealed interface SocketMessage {
    fun toJson() = Json.encodeToString(serializer(),this)
}

@Serializable
sealed interface MultiStepInitiator : SocketMessage {
    val requester: String
}

@Serializable
@SerialName("LEAVE")
data class LeaveMessage(val playerId: String) : SocketMessage

@Serializable
@SerialName("STATE")
data class StateMessage(val gameState: VisibleGameState) : SocketMessage

@Serializable
@SerialName("DRAW")
data class DrawMessage(val playerId: String, val cards: List<Card>) : SocketMessage

@Serializable
@SerialName("START_TURN")
data class StartMessage(val playerId: String) : SocketMessage

@Serializable
@SerialName("DISCARD")
data class DiscardMessage(val playerId: String, val card: Card) : SocketMessage

@Serializable
@SerialName("PLAY_UNSTOPPABLE_ACTION")
data class PlayUnstoppableActionMessage(val playerId: String, val card: Card) : SocketMessage

@Serializable
@SerialName("PLACE_IN_BANK")
data class PlaceInBankMessage(val playerId: String, val card: Card) : SocketMessage

@Serializable
@SerialName("PLACE_PROPERTY")
data class PlacePropertyMessage(val playerId: String, val card: Card.Property, val propertySetId: String) : SocketMessage

@Serializable
@SerialName("PAYMENT_EARNINGS")
data class PaymentEarningsMessage(val receiver: String, val giver: String, val propertyToDestination: Map<Int, String>, val bankCards: Set<Int>) : SocketMessage

@Serializable
@SerialName("RENT_REQUEST")
data class RentRequestMessage(
    override val requester: String,
    val targets: List<String>,
    val cardsUsed: List<Int>,
    val amount: Int,
    val baseAmount: Int = 0,
    val multiplier: Int = 1,
    val color: Color? = null
) : SocketMessage, MultiStepInitiator

@Serializable
@SerialName("JUST_SAY_NO")
data class JustSayNoMessage(val playerId: String, val respondingTo: String) : SocketMessage

@Serializable
@SerialName("DEBT_COLLECTOR")
data class DebtCollectMessage(override val requester: String, val target: String, val cardId: Int) : SocketMessage, MultiStepInitiator

@Serializable
@SerialName("DEVELOPMENT_ADDED")
data class DevelopmentAddedMessage(val development: Card.Action, val placedOn: String) : SocketMessage

@Serializable
@SerialName("BIRTHDAY")
data class BirthdayMessage(override val requester: String, val cardId: Int) : SocketMessage, MultiStepInitiator

@Serializable
@SerialName("SLY_DEAL")
data class SlyDealMessage(override val requester: String, val targetPlayer: String, val targetCard: Int, val receivingAs: Color?) : SocketMessage, MultiStepInitiator

@Serializable
@SerialName("SLY_DEAL_ACCEPTED")
data class SlyDealAcceptedMessage(val requester: String, val targetPlayer: String, val cardTaken: Int, val destinationSet: String) : SocketMessage

@Serializable
@SerialName("FORCED_DEAL")
data class ForcedDealMessage(override val requester: String, val targetPlayer: String, val requesterCard: Int, val requesterReceivingAs: Color?, val targetCard: Int) : SocketMessage, MultiStepInitiator

@Serializable
@SerialName("FORCED_DEAL_ACCEPTED")
data class ForcedDealAcceptedMessage(val requester: String, val targetPlayer: String, val cardTaken: Int, val requesterDestinationSet: String, val cardGiven: Int, val targetDestinationSet: String) : SocketMessage

@Serializable
@SerialName("DEALBREAKER")
data class DealbreakerMessage(override val requester: String, val targetPlayer: String, val targetSetId: String) : SocketMessage, MultiStepInitiator

@Serializable
@SerialName("DEALBREAKER_ACCEPTED")
data class DealbreakerAcceptedMessage(val requester: String, val targetPlayer: String, val takenSetId: String) : SocketMessage

@Serializable
@SerialName("CARD_DISCARDED")
data class CardDiscardedMessage(val playerId: String, val cardId: Int, val remainingHandCount: Int) : SocketMessage

@Serializable
@SerialName("PROPERTY_MOVED")
data class PropertyMovedMessage(val playerId: String, val cardId: Int, val fromSetId: String?, val toSetId: String, val newIdentityIfWild: Color?) : SocketMessage
