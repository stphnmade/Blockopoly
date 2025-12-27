/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/pages/PlayScreen.tsx --------------------------------------------------
   Fixed version with aligned drop IDs, dynamic discard, and drag overlay.
---------------------------------------------------------------------------- */

import React, {
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  PLAYERS_KEY,
  PLAYER_ID_KEY,
  ROOM_ID_KEY,
  NAME_KEY,
} from "../constants/constants";
import "../style/PlayScreen.css";

// Drag-and-drop removed: using click/menu interactions only

import { cardAssetMap } from "../utils/cardmapping";
const cardBack = new URL("../assets/cards/card-back.svg", import.meta.url).href;

/** Mat components (2–5 players) */
export type PlaymatProps = {
  layout: Partial<Record<"p1" | "p2" | "p3" | "p4" | "p5", string>>;
  myPID: string;
  names: Record<string, string>;
  discardImages?: string[];
  playerCardMap?: Record<
    string,
    { bank: string[]; properties: Record<string, string[]> }
  >;
};
const Playmat2 = lazy(
  () => import("../components/mats/Playmat2")
) as React.LazyExoticComponent<React.ComponentType<PlaymatProps>>;
const Playmat3 = lazy(
  () => import("../components/mats/Playmat3")
) as React.LazyExoticComponent<React.ComponentType<PlaymatProps>>;
const Playmat4 = lazy(
  () => import("../components/mats/Playmat4")
) as React.LazyExoticComponent<React.ComponentType<PlaymatProps>>;
const Playmat5 = lazy(
  () => import("../components/mats/Playmat5")
) as React.LazyExoticComponent<React.ComponentType<PlaymatProps>>;

/** Server types */
type ServerCardType = "GENERAL_ACTION" | "RENT_ACTION" | "PROPERTY" | "MONEY";
type ServerCard = {
  id: number;
  type: ServerCardType;
  value?: number;
  actionType?: string;
  colors?: string[];
};

type ServerPlayerState = {
  hand: ServerCard[];
  propertyCollection: Record<string, ServerCard[]>;
  bank: ServerCard[];
};

type ServerGameState = {
  playerAtTurn: string | null;
  winningPlayer: string | null;
  cardsLeftToPlay: number;
  playerOrder: string[];
  drawPileSize: number;
  pendingInteractions: Record<string, unknown>;
  playerState: Record<string, ServerPlayerState>;
  discardPile: ServerCard[];
};

type StateEnvelope =
  | { type: "STATE"; gameState: ServerGameState }
  | { type: "START_TURN"; playerId: string }
  | { type: "DRAW"; playerId: string; cards: ServerCard[] }
  | { type: "PLAY_UNSTOPPABLE_ACTION"; playerId: string; card: ServerCard }
  | { type: "PATCH"; fromVersion?: number; toVersion?: number; events?: any[] }
  | Record<string, unknown>;

/** Actions */
type Color = string;
type Action =
  | { type: "EndTurn" }
  | { type: "PlayMoney"; id: number }
  | { type: "PlayProperty"; id: number; color: Color }
  | { type: "Discard"; cardId: number }
  | { type: "PassGo"; id: number }
  | {
      type: "MoveProperty";
      cardId: number;
      fromSetId: string | null;
      toSetId: string;
      position?: number;
    };

const GAME_API = import.meta.env.VITE_GAME_SERVICE ?? "http://localhost:8081";
const toWs = (base: string) =>
  base
    .replace(/^http(s?):\/\//, (_: string, s: string) =>
      s ? "wss://" : "ws://"
    )
    .replace(/\/+$/, "");
const assetForCard = (c: ServerCard) =>
  !c || c.id === 999 ? cardBack : cardAssetMap[c.id] ?? cardBack;
const MAX_HAND_SIZE = 7;

/** Click-only hand card (drag removed) */
const DraggableCard: React.FC<{
  card: ServerCard;
  canDrag: boolean; // kept prop name for compatibility
  onClick: () => void;
}> = ({ card, canDrag, onClick }) => {
  return (
    <div
      className={`hand-card ${canDrag ? "clickable" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={`${card.type}${card.actionType ? `: ${card.actionType}` : ""}`}
    >
      <img src={assetForCard(card)} alt={card.type} draggable={false} />
    </div>
  );
};

type LobbyPlayer = { id: string; name?: string | null };

const PlayScreen: React.FC = () => {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();

  const myName = (sessionStorage.getItem(NAME_KEY) || "").trim();
  const myPID = sessionStorage.getItem(PLAYER_ID_KEY) || "";
  const roomId = sessionStorage.getItem(ROOM_ID_KEY) || "";

  const playersRaw = sessionStorage.getItem(PLAYERS_KEY) ?? "[]";
  const lobbyPlayers = useMemo(
    () => (JSON.parse(playersRaw) as LobbyPlayer[]).filter(Boolean),
    [playersRaw]
  );
  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of lobbyPlayers)
      if (p?.id && p.name && p.name.trim()) m[p.id] = p.name.trim();
    if (myPID && myName) m[myPID] = myName;
    return m;
  }, [lobbyPlayers, myPID, myName]);

  const displayName = useCallback(
    (pid?: string | null) => {
      if (!pid) return "-";
      if (pid === myPID) return myName || "You";
      const n = nameById[pid];
      return n && n.trim() ? n : "Opponent";
    },
    [nameById, myPID, myName]
  );

  /** State */
  const [game, setGame] = useState<ServerGameState | null>(null);
  const [myHand, setMyHand] = useState<ServerCard[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [handExpanded, setHandExpanded] = useState(true);
  const [wsReady, setWsReady] = useState(false);
  const [menuCard, setMenuCard] = useState<ServerCard | null>(null);
  const [colorChoices, setColorChoices] = useState<string[] | null>(null);
  const [spentThisTurn, setSpentThisTurn] = useState(0);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [discardSelection, setDiscardSelection] = useState<number[]>([]);
    // activeCard state removed with drag/drop

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(500);

  const wsUrl = useMemo(
    () =>
      `${toWs(GAME_API)}/ws/play/${encodeURIComponent(
        roomId
      )}/${encodeURIComponent(myPID)}`,
    [roomId, myPID]
  );

  const wsSend = useCallback((action: Action) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(action));
  }, []);

  /** Animations */
  const animateToNewHand = useCallback((newHand: ServerCard[]) => {
    setIsAnimating(true);
    setMyHand((prev) => {
      const prevIds = new Set(prev.map((c) => c.id));
      const added = newHand.filter((c) => !prevIds.has(c.id));
      if (added.length === 0) {
        setIsAnimating(false);
        return newHand;
      }
      let curr = [...prev];
      added.forEach((card, i) => {
        setTimeout(() => {
          curr = [...curr, card];
          setMyHand(curr);
          if (i === added.length - 1)
            setTimeout(() => {
              setMyHand(newHand);
              setIsAnimating(false);
            }, 120);
        }, i * 200);
      });
      return prev;
    });
  }, []);

  /** WS snapshot handling */
  const handleStateSnapshot = useCallback(
    (snapshot: ServerGameState) => {
      setGame(snapshot);
      const mine = snapshot.playerState?.[myPID];
      animateToNewHand(mine?.hand ?? []);
      if ((snapshot.cardsLeftToPlay ?? 0) >= 3) setSpentThisTurn(0);
    },
    [myPID, animateToNewHand]
  );

  const handleDraw = useCallback(
    (playerId: string, cards: ServerCard[]) => {
      if (playerId !== myPID) return;
      cards.forEach((c, i) =>
        setTimeout(() => setMyHand((prev) => [...prev, c]), i * 200)
      );
    },
    [myPID]
  );

  const connect = useCallback(() => {
    if (!roomId || !myPID) {
      navigate("/");
      return;
    }
    const ws = new WebSocket(wsUrl);
    console.info("[WS] attempting connect", { wsUrl, roomId, myPID });
    wsRef.current = ws;

    ws.onopen = () => {
      console.info("[WS] connected", { wsUrl });
      setWsReady(true);
      backoffRef.current = 500;
    };

    ws.onmessage = (evt) => {
      console.debug("[WS] raw message", evt.data);
      try {
        const msg: StateEnvelope = JSON.parse(evt.data);
        if ((msg as any).type === "STATE" && (msg as any).gameState) {
          handleStateSnapshot((msg as any).gameState);
          return;
        }
        if ((msg as any).type === "PLAY_UNSTOPPABLE_ACTION") {
          const payload = msg as any;
          const playerId = payload.playerId as string | undefined;
          const card = payload.card as ServerCard | undefined;
          if (!card?.id) return;
          if (playerId === myPID) {
            setMyHand((prev) => prev.filter((c) => c.id !== card.id));
          }
          setGame((g) => {
            if (!g) return g;
            const next = { ...g, playerState: { ...g.playerState }, discardPile: [...(g.discardPile ?? [])] } as ServerGameState;
            next.discardPile = [...next.discardPile, card];
            if (playerId === myPID && next.playerState[playerId]) {
              const ps = next.playerState[playerId];
              ps.hand = (ps.hand ?? []).filter((c) => c.id !== card.id);
              next.playerState[playerId] = ps;
            }
            return next;
          });
          return;
        }
        // Handle server PATCH frames with event array (optimistic updates)
        if ((msg as any).type === "PATCH" && Array.isArray((msg as any).events)) {
          const events = (msg as any).events as any[];
          // apply each event to local game state for immediate UI reflection
          events.forEach((e) => {
            if (!e || !e.type) return;
            if (e.type === "MOVE_PROPERTY") {
              const payload = e.payload ?? {};
              const { playerId, cardId, fromSetId, toSetId } = payload;
              if (!playerId || !cardId) return;
              setGame((g) => {
                if (!g) return g;
                const next = { ...g, playerState: { ...g.playerState } } as ServerGameState;
                const ps = next.playerState[playerId];
                if (!ps) return next;
                // helper to normalize card object
                const cid = typeof cardId === "string" ? Number(cardId) : cardId;
                const cardObj: ServerCard = { id: cid, type: "PROPERTY" };

                // remove from source set (handles array or { properties: [] })
                if (fromSetId && ps.propertyCollection && ps.propertyCollection[fromSetId]) {
                  const src = ps.propertyCollection[fromSetId] as any;
                  if (Array.isArray(src)) {
                    ps.propertyCollection[fromSetId] = src.filter((c: any) => (c?.id ?? c) !== cid);
                  } else if (src && Array.isArray(src.properties)) {
                    src.properties = src.properties.filter((c: any) => (c?.id ?? c) !== cid);
                    ps.propertyCollection[fromSetId] = src;
                  }
                }

                // add to target set
                if (!ps.propertyCollection) ps.propertyCollection = {} as Record<string, ServerCard[]>;
                const dest = ps.propertyCollection[toSetId];
                if (Array.isArray(dest)) {
                  ps.propertyCollection[toSetId] = [...dest, cardObj];
                } else if (dest && Array.isArray((dest as any).properties)) {
                  (dest as any).properties = [...(dest as any).properties, cardObj];
                  ps.propertyCollection[toSetId] = dest as any;
                } else {
                  // create new set as simple array form
                  ps.propertyCollection[toSetId] = [cardObj];
                }

                return next;
              });
            } else if (e.type === "DISCARD") {
              const payload = e.payload ?? {};
              const { playerId, cardId } = payload;
              if (!cardId) return;
              setGame((g) => {
                if (!g) return g;
                const next = { ...g, playerState: { ...g.playerState }, discardPile: [...(g.discardPile ?? [])] } as ServerGameState;
                const cid = typeof cardId === "string" ? Number(cardId) : cardId;
                const cardObj: ServerCard = { id: cid, type: "GENERAL_ACTION" };
                // remove card from player's hand if present
                if (playerId && next.playerState?.[playerId]) {
                  const ps = next.playerState[playerId];
                  ps.hand = (ps.hand ?? []).filter((c) => (c?.id ?? c) !== cid);
                  next.playerState[playerId] = ps;
                }
                next.discardPile = [...(next.discardPile ?? []), cardObj];
                return next;
              });
            }
          });
          return;
        }
        if ((msg as any).type === "START_TURN") {
          const pid = (msg as any).playerId as string;
          setGame((g) => (g ? { ...g, playerAtTurn: pid } : g));
          if (pid === myPID) setSpentThisTurn(0);
          return;
        }
        if ((msg as any).type === "DRAW") {
          handleDraw((msg as any).playerId, (msg as any).cards);
          return;
        }
        if ((msg as any)?.playerAtTurn && (msg as any)?.playerState) {
          handleStateSnapshot(msg as any);
          return;
        }
      } catch {
        /* ignore */
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] error event", err);
    };

    ws.onclose = (ev) => {
      console.warn("[WS] closed", { code: ev?.code, reason: ev?.reason, wasClean: ev?.wasClean });
      setWsReady(false);
      const delay = Math.min(backoffRef.current, 6000);
      backoffRef.current = Math.min(delay * 2, 6000);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => connect(), delay);
    };
  }, [navigate, wsUrl, roomId, myPID, handleStateSnapshot, handleDraw]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  /** Derived */
  const isMyTurn = game?.playerAtTurn === myPID;
  const playsLeft = Math.max(0, (game?.cardsLeftToPlay ?? 0) - spentThisTurn);
  const discardNeeded = Math.max(0, myHand.length - MAX_HAND_SIZE);
  const canConfirmDiscard = discardNeeded > 0 && discardSelection.length === discardNeeded;

  const orderedPids = (
    game?.playerOrder?.length ? game.playerOrder : lobbyPlayers.map((p) => p.id)
  ).slice(0, 5);
  const playerCount = Math.max(2, Math.min(5, orderedPids.length || 2));
  const Mat = useMemo(
    () =>
      ({ 2: Playmat2, 3: Playmat3, 4: Playmat4, 5: Playmat5 }[playerCount] ||
      Playmat5),
    [playerCount]
  );

  const layout: PlaymatProps["layout"] = useMemo(() => {
    const seats = ["p1", "p2", "p3", "p4", "p5"] as const;
    const m: Partial<Record<(typeof seats)[number], string>> = {};
    orderedPids.forEach((pid, i) => {
      m[seats[i]] = pid;
    });
    return m;
  }, [orderedPids]);

  // last 3 images; newest at the end
  const discardImages = useMemo(
    () => (game?.discardPile ?? []).slice(-3).map(assetForCard),
    [game?.discardPile]
  );

  const playerCardMap = useMemo(() => {
    const m: Record<string, { bank: string[]; properties: Record<string, string[]> }> = {};
    if (!game?.playerState) return m;
    for (const pid of Object.keys(game.playerState)) {
      const ps = game.playerState[pid];
      m[pid] = {
        bank: (ps.bank ?? []).map(assetForCard),
        properties: Object.fromEntries(
          // backend may send PropertyCollection wrapper { collection: { setId: PropertySet } }
          // or directly a map of setId -> PropertySet/array. Normalize to the inner collection when present.
          Object.entries((ps.propertyCollection && (ps.propertyCollection.collection ? (ps.propertyCollection as any).collection : ps.propertyCollection)) ?? {}).map(([setId, val]) => {
            // val may be an array of ServerCard or an object with .properties array
            const cardArr: ServerCard[] = Array.isArray(val)
              ? (val as unknown as ServerCard[])
              : (val && Array.isArray((val as any).properties) ? (val as any).properties : []);
            return [setId, cardArr.map(assetForCard)];
          })
        ),
      };
    }
    return m;
  }, [game?.playerState]);

  /** Click-menu actions */
  const onCardClick = (card: ServerCard) => {
    if (!isMyTurn) return;
    if (isDiscarding) return;
    setMenuCard(card);
    if (card.type === "PROPERTY") {
      const colors = card.colors ?? [];
      setColorChoices(colors.length > 1 ? colors : null);
    } else setColorChoices(null);
  };

  const bankSelected = () => {
    if (!menuCard || !isMyTurn || playsLeft <= 0) return;
    if (menuCard.type === "MONEY") {
      wsSend({ type: "PlayMoney", id: menuCard.id });
      console.debug("[Play] increment spentThisTurn (menu bank)", { cardId: menuCard.id, before: spentThisTurn });
      setSpentThisTurn((n) => n + 1);
    }
    setMenuCard(null);
    setColorChoices(null);
  };

  const passGoSelected = () => {
    if (!menuCard || !isMyTurn || playsLeft <= 0) return;
    if (menuCard.type !== "GENERAL_ACTION" || menuCard.actionType !== "PASS_GO") return;
    wsSend({ type: "PassGo", id: menuCard.id });
    console.debug("[Play] increment spentThisTurn (pass go)", { cardId: menuCard.id, before: spentThisTurn });
    setSpentThisTurn((n) => n + 1);
    setMenuCard(null);
    setColorChoices(null);
  };

  const playPropertySelected = (color?: string) => {
    if (!menuCard || !isMyTurn || playsLeft <= 0) return;
    const chosen = color ?? menuCard.colors?.[0];
    if (!chosen) {
      setMenuCard(null);
      return;
    }
  wsSend({ type: "PlayProperty", id: menuCard.id, color: chosen });
  console.debug("[Play] increment spentThisTurn (menu property)", { cardId: menuCard.id, color: chosen, before: spentThisTurn });
  setSpentThisTurn((n) => n + 1);
    setMenuCard(null);
    setColorChoices(null);
  };

  /** DnD drop handling */
  // parseDropId removed with drag/drop

  // Drag & drop removed: use click/menu interactions only

  const sendEndTurn = useCallback(() => {
    if (!isMyTurn) return;
    if (myHand.length > MAX_HAND_SIZE) {
      setIsDiscarding(true);
      setMenuCard(null);
      setColorChoices(null);
      return;
    }
    wsSend({ type: "EndTurn" });
  }, [isMyTurn, myHand.length, wsSend]);

  const toggleDiscardSelection = useCallback(
    (cardId: number) => {
      setDiscardSelection((prev) => {
        if (prev.includes(cardId)) {
          return prev.filter((id) => id !== cardId);
        }
        if (prev.length >= discardNeeded) return prev;
        return [...prev, cardId];
      });
    },
    [discardNeeded]
  );

  const autoSelectDiscards = useCallback(() => {
    if (discardNeeded <= 0) return;
    setDiscardSelection((prev) => {
      const selected = new Set(prev);
      const next = [...prev];
      for (const card of myHand) {
        if (next.length >= discardNeeded) break;
        if (!selected.has(card.id)) {
          next.push(card.id);
          selected.add(card.id);
        }
      }
      return next.slice(0, discardNeeded);
    });
  }, [discardNeeded, myHand]);

  const confirmDiscardAndEndTurn = useCallback(() => {
    if (!isMyTurn || discardNeeded <= 0) return;
    if (discardSelection.length !== discardNeeded) return;
    discardSelection.forEach((cardId) => wsSend({ type: "Discard", cardId }));
    setDiscardSelection([]);
    setIsDiscarding(false);
    wsSend({ type: "EndTurn" });
  }, [discardNeeded, discardSelection, isMyTurn, wsSend]);

  const cancelDiscard = useCallback(() => {
    setDiscardSelection([]);
    setIsDiscarding(false);
  }, []);

  useEffect(() => {
    if (!isMyTurn && isDiscarding) {
      setIsDiscarding(false);
      setDiscardSelection([]);
    }
  }, [isMyTurn, isDiscarding]);

  useEffect(() => {
    if (!isDiscarding) return;
    if (discardNeeded <= 0) {
      setIsDiscarding(false);
      setDiscardSelection([]);
      return;
    }
    setDiscardSelection((prev) => {
      const inHand = prev.filter((id) => myHand.some((c) => c.id === id));
      if (inHand.length <= discardNeeded) return inHand;
      return inHand.slice(0, discardNeeded);
    });
  }, [discardNeeded, isDiscarding, myHand]);

  return (
    <div className="mat-stage">

        <Mat
          layout={layout}
          myPID={myPID}
          names={nameById}
          discardImages={discardImages}
          playerCardMap={playerCardMap}
        />

        {/* Top bar */}
        <div
          className="play-topbar"
        >
          <div>
            Room Code: <b>{roomCode || "—"}</b>
          </div>
          <div>
            Room ID: <b>{roomId || "—"}</b>
          </div>
          <div>
            You: <b>{myName || "You"}</b>
          </div>
          <div>
            Turn: <b>{displayName(game?.playerAtTurn)}</b>
          </div>
          <div>
            Draw pile: <b>{game?.drawPileSize ?? "-"}</b>
          </div>
          <div>
            Plays left: <b>{playsLeft}</b>
          </div>
          <div
            className={`ws-dot ${wsReady ? "on" : "off"}`}
            title={wsReady ? "Connected" : "Reconnecting..."}
          />
        </div>

    {/* Actions: the End Turn button is rendered as a portal into document.body
      so it centers relative to the viewport (not the transformed .mat-stage) */}

        {/* Hand */}
        <div className={`mat-hand-overlay ${isAnimating ? "animating" : ""}`}>
          <div className="mat-hand-row">
            <div className="flex items-center gap-3 mr-2">
              <button
                className="hand-collapse-btn"
                onClick={() => setHandExpanded((s) => !s)}
                aria-expanded={handExpanded ? "true" : "false"}
                title={handExpanded ? "Hide hand" : "Show hand"}
              >
                {handExpanded ? "Hide" : `${myName || "Your"} hand`}
              </button>
              <div className="text-sm font-medium">{myName || "Your hand"}</div>
            </div>
            {handExpanded && myHand.map((card, idx) => {
            const isPassGo = card.type === "GENERAL_ACTION" && card.actionType === "PASS_GO";
            const canDrag =
              isMyTurn &&
              playsLeft > 0 &&
              (card.type === "MONEY" || card.type === "PROPERTY" || isPassGo);
            return (
              <DraggableCard
                key={`${card.id}-${idx}`}
                card={card}
                canDrag={canDrag}
                onClick={() => onCardClick(card)}
              />
            );
          })}
          </div>
        </div>

      

      {/* Portal-mounted End Turn button (centers on viewport) */}
      {typeof document !== "undefined"
        ? createPortal(
            <button
              className="end-turn-button"
              onClick={sendEndTurn}
              disabled={!isMyTurn || isDiscarding}
            >
              End Turn
            </button>,
            document.body
          )
        : null}

      {isDiscarding && (
        <div className="discard-overlay" role="dialog" aria-modal="true" aria-labelledby="discard-title">
          <div className="discard-modal">
            <div className="discard-header">
              <div className="discard-title" id="discard-title">
                Discard to {MAX_HAND_SIZE}
              </div>
              <div className="discard-subtitle">
                Select {discardNeeded} card{discardNeeded === 1 ? "" : "s"} to discard.
              </div>
            </div>
            <div className="discard-grid">
              {myHand.map((card, idx) => {
                const selected = discardSelection.includes(card.id);
                const selectionFull = discardSelection.length >= discardNeeded;
                const disabled = !selected && selectionFull;
                return (
                  <button
                    key={`discard-${card.id}-${idx}`}
                    type="button"
                    className={`discard-card ${selected ? "selected" : ""}`}
                    onClick={() => toggleDiscardSelection(card.id)}
                    disabled={disabled}
                    aria-pressed={selected}
                    title={`${card.type}${card.actionType ? `: ${card.actionType}` : ""}`}
                  >
                    <img src={assetForCard(card)} alt={card.type} draggable={false} />
                  </button>
                );
              })}
            </div>
            <div className="discard-actions">
              <button
                type="button"
                className="discard-secondary"
                onClick={autoSelectDiscards}
                disabled={discardNeeded <= 0}
              >
                Auto-select {discardNeeded}
              </button>
              <button
                type="button"
                className="discard-primary"
                onClick={confirmDiscardAndEndTurn}
                disabled={!canConfirmDiscard}
              >
                Discard & End Turn
              </button>
              <button type="button" className="discard-secondary" onClick={cancelDiscard}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline property color picker / bank action */}
      {menuCard && (
        <div className="card-menu bg-gray-900 border border-gray-700 shadow-2xl">
          <div className="card-menu-row">
            <span className="text-white font-semibold text-lg">
              Selected: #{menuCard.id} {menuCard.type}
            </span>
          </div>
          <div className="card-menu-row">
            {menuCard.type === "MONEY" && (
              <button
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                disabled={!isMyTurn || playsLeft <= 0}
                onClick={bankSelected}
              >
                Bank
              </button>
            )}
            {menuCard.type === "PROPERTY" && !colorChoices && (
              <button
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                disabled={!isMyTurn || playsLeft <= 0}
                onClick={() => playPropertySelected()}
              >
                Play as Property
              </button>
            )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "PASS_GO" && (
                <button
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0}
                  onClick={passGoSelected}
                >
                  Draw 2 (Pass Go)
                </button>
              )}
          </div>
          {menuCard.type === "PROPERTY" && colorChoices && (
            <div className="card-menu-row">
              {colorChoices.map((c) => (
                <button
                  key={c}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                             text-white font-medium px-4 py-2 rounded-lg 
                             transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0}
                  onClick={() => playPropertySelected(c)}
                >
                  Play as {c}
                </button>
              ))}
            </div>
          )}
          {menuCard.type === "PROPERTY" && (
            <div className="card-menu-row">
              <button
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                disabled={!isMyTurn}
                onClick={() => {
                  // TODO: Implement property movement UI
                  alert(
                    "MoveProperty action is available - UI implementation needed"
                  );
                  setMenuCard(null);
                  setColorChoices(null);
                }}
              >
                Move Property
              </button>
            </div>
          )}
          <div className="card-menu-row">
            <button
              onClick={() => {
                setMenuCard(null);
                setColorChoices(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayScreen;
