package com.gameservice

import com.gameservice.handlers.applyAction
import com.gameservice.models.Command
import com.gameservice.models.DrawMessage
import com.gameservice.models.GameState
import com.gameservice.models.RestartGame
import com.gameservice.models.SocketMessage
import com.gameservice.models.StartTurn
import com.gameservice.models.StateMessage
import io.ktor.websocket.CloseReason
import io.ktor.websocket.WebSocketSession
import io.ktor.websocket.close
import io.ktor.websocket.send
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

// Manages 1 game room
class DealGame(val roomId: String, val players: List<String>) {
    val state = CompletableDeferred<MutableStateFlow<GameState>>()
    private val host = players.first()
    private val commandChannel = Channel<Command>(capacity = Channel.UNLIMITED)
    private val broadcastChannel = Channel<SocketMessage>(capacity = Channel.UNLIMITED)
    private val playerSockets = ConcurrentHashMap<String, WebSocketSession>()
    private val gameScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val initialBroadcastDone = CompletableDeferred<Unit>()


    init {
        // Process commands from websocket sequentially.
        // Don't need highly concurrent access to GameState and prevents Concurrent Modifications Errors
        gameScope.launch {
            for (command in commandChannel) {
                if (state.await().value.winningPlayer == null && command.command !is RestartGame) {
                    val newState = applyAction(this@DealGame, state.await(), command.playerId, command.command )
                    state.await().tryEmit(newState)
                } else if (state.await().value.winningPlayer != null && command.command is RestartGame) {
                    restartGame()
                }
            }
        }

        gameScope.launch {
            for (msg in broadcastChannel) {
                broadcast(msg)
            }
        }
    }

    suspend fun sendCommand(command: Command) = commandChannel.send(command)

    suspend fun sendBroadcast(message: SocketMessage) = broadcastChannel.send(message)

    // These broadcasts are mainly to help with animations on client. Authoritative GameState is broadcasted by updates to state
    private suspend fun broadcast(message: SocketMessage) {
        when (message) {
            is StateMessage -> {} // STATE is automatically broadcasted by coroutine in connectPlayer.
            is DrawMessage -> {
                val fakeCards = List(message.cards.size) {FAKE_CARD}
                for ((player, session) in playerSockets) {
                    val cards = if (player == message.playerId) message.cards else fakeCards
                    sendToPlayer(player, session, DrawMessage(message.playerId, cards).toJson())
                }
            }
            else -> for ((player, session) in playerSockets) {
                sendToPlayer(player, session, message.toJson())
            }
        }
    }

    private suspend fun broadcastState(newState: GameState) {
        for ((id, session) in playerSockets) {
            sendToPlayer(id, session, StateMessage(newState.getVisibleGameState(id)).toJson())
        }
    }

    private suspend fun sendToPlayer(playerId: String, session: WebSocketSession, payload: String): Boolean {
        return try {
            session.send(payload)
            true
        } catch (cancelled: CancellationException) {
            if (!currentCoroutineContext().isActive) throw cancelled
            playerSockets.remove(playerId, session)
            false
        } catch (_: Exception) {
            // Remove only the session that failed. A newer connection for the same
            // player may already have replaced it while this send was suspended.
            playerSockets.remove(playerId, session)
            false
        }
    }

    fun disconnectPlayer(playerId: String, session: WebSocketSession) {
        // A closing stale socket must not unregister a replacement connection.
        playerSockets.remove(playerId, session)
    }

     @OptIn(FlowPreview::class)
     suspend fun connectPlayer(playerId: String, session: WebSocketSession) : CompletableDeferred<MutableStateFlow<GameState>>? {
        if (playerId in players) {
            val previousSession = playerSockets.put(playerId, session)
            if (previousSession != null && previousSession !== session) {
                previousSession.close(CloseReason(CloseReason.Codes.NORMAL, "Player started new connection"))
            }
            if (state.isCompleted) {
                sendToPlayer(
                    playerId,
                    session,
                    StateMessage(state.await().value.getVisibleGameState(playerId)).toJson()
                )
            }
        } else return null

        if (playerSockets.size == players.size && !state.isCompleted) {
            val game = GameState(players)
            state.complete(MutableStateFlow(game))

            gameScope.launch {
                state.await()
                    .debounce(100)
                    .collect { newState ->
                        broadcastState(newState)
                        if (!initialBroadcastDone.isCompleted) {
                            initialBroadcastDone.complete(Unit)
                        }
                    }
            }

            gameScope.launch {
                initialBroadcastDone.await()
                sendCommand(Command(game.playerAtTurn!!, StartTurn()))
            }

        }
         return state
    }

    suspend fun restartGame() {
        state.await().tryEmit(GameState(players))
    }
}
