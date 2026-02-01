# Room-related Redis & In-Memory Keys

This document inventories all known room-related storage and will be kept
in sync with lifecycle / cleanup logic.

## Redis (roomService)

All keys are currently versioned with a `v1:` prefix and are created from
the room service (lobby / room management).

- `v1:p2n:{playerId}` (`PLAYER_TO_NAME_PREFIX`)
  - String
  - Player display name.
  - TTL: `SECS_IN_HOUR` at creation and update.

- `v1:p2r:{playerId}` (`PLAYER_TO_ROOM_PREFIX`)
  - String
  - Maps a player to their roomId.
  - TTL: `SECS_IN_HOUR` at creation and update.

- `v1:r2p:{roomId}` (`ROOM_TO_PLAYERS_PREFIX`)
  - List
  - Ordered list of playerIds in a room (host is last element).
  - TTL: `SECS_IN_HOUR` at room creation; refreshed on some flows.

- `v1:j2r:{roomCode}` (`JOIN_CODE_TO_ROOM_PREFIX`)
  - String
  - Maps lobby join code to a roomId.
  - TTL: not explicitly set today; effectively unbounded until room close.

- `v1:r2j:{roomId}` (`ROOM_TO_JOIN_CODE_PREFIX`)
  - String
  - Reverse mapping from roomId to join code.
  - TTL: `SECS_IN_HOUR` at room creation.

- `v1:rss:{roomId}` (`ROOM_START_STATUS_PREFIX`)
  - String (`"true"` when game has started)
  - TTL: `SECS_IN_HOUR * 24` when the room is started.

- `v1:rc2p:{roomId}:{clientId}` (`ROOM_CLIENT_TO_PLAYER_PREFIX`)
  - String
  - Maps a per-browser clientId to a playerId for reconnect bootstrap.
  - TTL: `SECS_IN_HOUR` at creation.

## In-memory (gameService)

The game server keeps active game rooms in memory only:

- `ServerManager.rooms: ConcurrentHashMap<String, DealGame>`
  - Key: `roomId`
  - Value: `DealGame`, which owns:
    - `state: CompletableDeferred<MutableStateFlow<GameState>>`
    - `playerSockets: ConcurrentHashMap<String, WebSocketSession>`
    - `commandChannel`, `broadcastChannel`, and game coroutines.

There is currently **no Redis-backed game state**; game rooms live only in
`ServerManager.rooms` plus whatever room metadata exists in roomService.

## Planned canonical metadata key

To support TTL + janitor cleanup, we will introduce a canonical metadata
key (to be implemented):

- `room:{roomId}:meta`
  - Hash
  - Fields:
    - `createdAt` (epoch ms)
    - `lastActive` (epoch ms)
    - `status` (`ACTIVE` | `CLOSING` | `CLOSED`)
    - `connectedCount`
    - `playerCount`

All additional room-specific keys (including the existing `v1:*` keys)
will either:

- be covered by a shared TTL policy driven from `room:{roomId}:meta`, or
- be migrated to `room:{roomId}:*` naming to make hard deletes/EXPIRE
  deterministic.

