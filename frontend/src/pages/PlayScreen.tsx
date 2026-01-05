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
import ChargeModal from "./play/components/ChargeModal";
import DealBreakerModal from "./play/components/DealBreakerModal";
import DealResponseModal from "./play/components/DealResponseModal";
import DebtCollectorModal from "./play/components/DebtCollectorModal";
import DevelopmentModal from "./play/components/DevelopmentModal";
import DevelopmentJsnModal from "./play/components/DevelopmentJsnModal";
import DiscardModal from "./play/components/DiscardModal";
import ForcedDealModal from "./play/components/ForcedDealModal";
import JsnChainModal from "./play/components/JsnChainModal";
import PositioningModal from "./play/components/PositioningModal";
import RentModal from "./play/components/RentModal";
import SlyDealModal from "./play/components/SlyDealModal";
import type { DealBreakerTarget } from "./play/components/DealBreakerModal";
import type {
  PositioningCard,
  PositioningTarget,
  PositioningTargets,
  DealTargetEntry,
  PropertySetView,
  RentColorOption,
  ServerCard,
} from "./play/types";
import { SFX_ACTION_OVERLAY, resolveActionSfx } from "../utils/soundBoard";

// Drag-and-drop removed: using click/menu interactions only

import { cardAssetMap } from "../utils/cardmapping";
const cardBack = new URL("../assets/cards/card-back.svg", import.meta.url).href;

/** Mat components (2-5 players) */
export type PlaymatProps = {
  layout: Partial<Record<"p1" | "p2" | "p3" | "p4" | "p5", string>>;
  myPID: string;
  names: Record<string, string>;
  discardImages?: string[];
  playerCardMap?: Record<
    string,
    {
      bank: { images: string[]; total: number; count: number };
      properties: unknown;
    }
  >;
  cardImageForId?: (id: number) => string;
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

type PropertyCardEntry = DealTargetEntry & { isComplete: boolean };

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
  | { type: "Birthday"; id: number }
  | { type: "PlayDoubleRent"; id: number }
  | { type: "DebtCollect"; id: number; target: string }
  | { type: "AcceptCharge"; payment: number[] }
  | { type: "JustSayNo"; ids: number[]; respondingTo?: string | null }
  | { type: "AcceptJustSayNo"; respondingTo: string }
  | { type: "AcceptDeal"; receiveAsColor?: string | null }
  | {
      type: "RequestRent";
      rentCardId: number;
      rentDoublers: number[];
      rentingSetId: string;
      rentColor?: string | null;
      target?: string | null;
    }
  | { type: "SlyDeal"; id: number; targetCard: number; colorToReceiveAs?: string | null }
  | {
      type: "ForcedDeal";
      id: number;
      targetCard: number;
      cardToGive: number;
      colorToReceiveAs?: string | null;
    }
  | { type: "Dealbreaker"; id: number; targetSetId: string }
  | { type: "PlayDevelopment"; id: number; propertySetId: string }
  | {
      type: "MoveProperty";
      cardId: number;
      fromSetId: string | null;
      toSetId: string;
      position?: number;
      toColor?: string | null;
    }
  | { type: "RestartGame" };

type ChargeKind = "RENT" | "BIRTHDAY" | "DEBT_COLLECTOR";
type ToastKind = "info" | "error";
type Toast = { id: number; message: string; kind: ToastKind };

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
const ALL_COLOR_COUNT = 10;
const BIRTHDAY_PAYMENT_AMOUNT = 2;
const DEBT_COLLECTOR_PAYMENT_AMOUNT = 5;
const NEW_PROPERTY_SET_ID = "NEW_SET";

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

type LobbyPlayer = { playerId?: string; id?: string; name?: string | null };

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
    for (const p of lobbyPlayers) {
      const pid = p?.playerId ?? p?.id;
      if (pid && p.name && p.name.trim()) m[pid] = p.name.trim();
    }
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
  const [isPositioning, setIsPositioning] = useState(false);
  const [positioningCard, setPositioningCard] = useState<PositioningCard | null>(null);
  const [positionTarget, setPositionTarget] = useState<PositioningTarget>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [discardSelection, setDiscardSelection] = useState<number[]>([]);
  const [isRenting, setIsRenting] = useState(false);
  const [rentCard, setRentCard] = useState<ServerCard | null>(null);
  const [rentColor, setRentColor] = useState<string | null>(null);
  const [rentSetId, setRentSetId] = useState<string | null>(null);
  const [rentChargeAll, setRentChargeAll] = useState(true);
  const [rentTarget, setRentTarget] = useState<string | null>(null);
  const [rentCharge, setRentCharge] = useState<{
    requesterId: string;
    amount: number;
    color?: string | null;
    kind: ChargeKind;
  } | null>(null);
  const [isDebtCollecting, setIsDebtCollecting] = useState(false);
  const [debtCard, setDebtCard] = useState<ServerCard | null>(null);
  const [debtTarget, setDebtTarget] = useState<string | null>(null);
  const [isSlyDealing, setIsSlyDealing] = useState(false);
  const [slyCard, setSlyCard] = useState<ServerCard | null>(null);
  const [slyTargetCardId, setSlyTargetCardId] = useState<number | null>(null);
  const [slyReceiveColor, setSlyReceiveColor] = useState<string | null>(null);
  const [isForcedDealing, setIsForcedDealing] = useState(false);
  const [forcedCard, setForcedCard] = useState<ServerCard | null>(null);
  const [forcedTargetCardId, setForcedTargetCardId] = useState<number | null>(null);
  const [forcedGiveCardId, setForcedGiveCardId] = useState<number | null>(null);
  const [forcedReceiveColor, setForcedReceiveColor] = useState<string | null>(null);
  const [isDealBreaking, setIsDealBreaking] = useState(false);
  const [dealBreakerCard, setDealBreakerCard] = useState<ServerCard | null>(null);
  const [dealBreakerTargetSetId, setDealBreakerTargetSetId] = useState<string | null>(null);
  const [isDeveloping, setIsDeveloping] = useState(false);
  const [developmentCard, setDevelopmentCard] = useState<ServerCard | null>(null);
  const [developmentTargetSetId, setDevelopmentTargetSetId] = useState<string | null>(null);
  const [dealReceiveColor, setDealReceiveColor] = useState<string | null>(null);
  const [rentBankSelection, setRentBankSelection] = useState<number[]>([]);
  const [rentPropertySelection, setRentPropertySelection] = useState<number[]>([]);
  const [rentDoublers, setRentDoublers] = useState<number[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
    // activeCard state removed with drag/drop

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(500);
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const toastIdRef = useRef(0);

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

  const playSound = useCallback((src: string, volume = 0.85) => {
    if (!src || typeof Audio === "undefined") return;
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      void audio.play();
    } catch {
      /* ignore audio errors */
    }
  }, []);

  const playActionSound = useCallback(
    (actionType?: string | null) => {
      const primary = resolveActionSfx(actionType);
      playSound(primary, 0.9);
      playSound(SFX_ACTION_OVERLAY, 0.5);
    },
    [playSound]
  );

  const pushToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      toastTimers.current.delete(id);
    }, 3200);
    toastTimers.current.set(id, timer);
  }, []);

  const getPendingInteractions = useCallback((pending: unknown) => {
    if (!pending) return [] as any[];
    if (Array.isArray(pending)) return pending;
    const typed = pending as { pendingInteractions?: unknown; _pendingInteractions?: unknown };
    if (Array.isArray(typed.pendingInteractions)) return typed.pendingInteractions;
    if (Array.isArray(typed._pendingInteractions)) return typed._pendingInteractions;
    return [] as any[];
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

  const formatColor = useCallback((value?: string | null) => {
    if (!value) return "Unassigned";
    return value.charAt(0) + value.slice(1).toLowerCase();
  }, []);

  const formatActionLabel = useCallback((actionType?: string | null) => {
    switch (actionType) {
      case "PASS_GO":
        return "Pass Go";
      case "JUST_SAY_NO":
        return "Just Say No";
      case "DEAL_BREAKER":
        return "Deal Breaker";
      case "DEBT_COLLECTOR":
        return "Debt Collector";
      case "FORCED_DEAL":
        return "Forced Deal";
      case "SLY_DEAL":
        return "Sly Deal";
      case "BIRTHDAY":
        return "It's My Birthday";
      case "HOUSE":
        return "House";
      case "HOTEL":
        return "Hotel";
      case "DOUBLE_RENT":
        return "Double The Rent";
      case "WILD_RENT":
        return "Wild Rent";
      case "RENT":
        return "Rent";
      default:
        return "Action";
    }
  }, []);

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
          if (card.actionType) {
            const actionLabel = formatActionLabel(card.actionType);
            pushToast(`${displayName(playerId)} played ${actionLabel}.`, "info");
            playActionSound(card.actionType);
          }
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
        if ((msg as any).type === "BIRTHDAY") {
          const payload = msg as any;
          const requester = payload.requester as string | undefined;
          const isSelf = requester === myPID;
          const message = isSelf
            ? `You played It's My Birthday! Everyone pays ${BIRTHDAY_PAYMENT_AMOUNT}M.`
            : `${displayName(requester)} played It's My Birthday! Everyone pays ${BIRTHDAY_PAYMENT_AMOUNT}M.`;
          pushToast(message, "info");
          if (requester && requester !== myPID) {
            setRentCharge({
              requesterId: requester,
              amount: BIRTHDAY_PAYMENT_AMOUNT,
              color: null,
              kind: "BIRTHDAY",
            });
          }
          return;
        }
        if ((msg as any).type === "DEBT_COLLECTOR") {
          const payload = msg as any;
          const requester = payload.requester as string | undefined;
          const target = payload.target as string | undefined;
          const targetLabel = target ? displayName(target) : "an opponent";
          const isSelf = requester === myPID;
          const message = isSelf
            ? `You played Debt Collector on ${targetLabel} for ${DEBT_COLLECTOR_PAYMENT_AMOUNT}M.`
            : `${displayName(requester)} played Debt Collector on ${targetLabel} for ${DEBT_COLLECTOR_PAYMENT_AMOUNT}M.`;
          pushToast(message, "info");
          playActionSound("DEBT_COLLECTOR");
          if (target && target === myPID) {
            setRentCharge({
              requesterId: requester ?? "",
              amount: DEBT_COLLECTOR_PAYMENT_AMOUNT,
              color: null,
              kind: "DEBT_COLLECTOR",
            });
          }
          return;
        }
        if ((msg as any).type === "RENT_REQUEST") {
          const payload = msg as any;
          const requester = payload.requester as string | undefined;
          const targets = Array.isArray(payload.targets) ? (payload.targets as string[]) : [];
          const rentColor = payload.color as string | undefined;
          const targetLabel =
            targets.length > 1 ? "everyone" : targets.length === 1 ? displayName(targets[0]) : "";
          const rentLabel = rentColor ? `rent for ${formatColor(rentColor)}` : "rent";
          const message = `${displayName(requester)} charges ${rentLabel}${
            targetLabel ? ` from ${targetLabel}` : ""
          }`;
          pushToast(message, "info");
          playActionSound("RENT");
          if (targets.includes(myPID)) {
            const amount =
              typeof payload.amount === "number"
                ? payload.amount
                : Number(payload.amount ?? 0) || 0;
            setRentCharge({
              requesterId: requester ?? "",
              amount,
              color: rentColor ?? null,
              kind: "RENT",
            });
          }
          return;
        }
        if ((msg as any).type === "ACTION_INVALID") {
          const payload = msg as any;
          const action = payload.action as string | undefined;
          const reason = payload.reason as string | undefined;
          const playerId = payload.playerId as string | undefined;
          const actionLabel = action ? formatActionLabel(action) : "Action";
          const message = reason
            ? reason
            : `${displayName(playerId)} attempted an invalid ${actionLabel}.`;
          pushToast(message, "error");
          return;
        }
        if ((msg as any).type === "JUST_SAY_NO") {
          const payload = msg as any;
          const playerId = payload.playerId as string | undefined;
          const respondingTo = payload.respondingTo as string | undefined;
          const message = `${displayName(playerId)} played Just Say No${respondingTo ? ` against ${displayName(respondingTo)}` : ""}.`;
          pushToast(message, "info");
          playActionSound("JUST_SAY_NO");
          return;
        }
        if ((msg as any).type === "SLY_DEAL") {
          const payload = msg as any;
          const requester = payload.requester as string | undefined;
          const targetPlayer = payload.targetPlayer as string | undefined;
          const message = `${displayName(requester)} played Sly Deal on ${displayName(targetPlayer)}.`;
          pushToast(message, "info");
          playActionSound("SLY_DEAL");
          return;
        }
        if ((msg as any).type === "FORCED_DEAL") {
          const payload = msg as any;
          const requester = payload.requester as string | undefined;
          const targetPlayer = payload.targetPlayer as string | undefined;
          const message = `${displayName(requester)} played Forced Deal on ${displayName(targetPlayer)}.`;
          pushToast(message, "info");
          playActionSound("FORCED_DEAL");
          return;
        }
        if ((msg as any).type === "DEALBREAKER") {
          const payload = msg as any;
          const requester = payload.requester as string | undefined;
          const targetPlayer = payload.targetPlayer as string | undefined;
          const message = `${displayName(requester)} played Deal Breaker on ${displayName(targetPlayer)}.`;
          pushToast(message, "info");
          playActionSound("DEAL_BREAKER");
          return;
        }
        if ((msg as any).type === "DEVELOPMENT_ADDED") {
          const payload = msg as any;
          const dev = payload.development as ServerCard | undefined;
          const actionLabel = formatActionLabel(dev?.actionType);
          const message = `${actionLabel} added to a completed set.`;
          pushToast(message, "info");
          playActionSound(dev?.actionType);
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
  }, [
    navigate,
    wsUrl,
    roomId,
    myPID,
    handleStateSnapshot,
    handleDraw,
    displayName,
    formatColor,
    formatActionLabel,
    pushToast,
  ]);

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
  const playsLeft = Math.max(0, game?.cardsLeftToPlay ?? 0);
  const pendingInteractions = useMemo(
    () => getPendingInteractions(game?.pendingInteractions),
    [game?.pendingInteractions, getPendingInteractions]
  );
  const discardableHand = useMemo(
    () => myHand.filter((card) => card.type !== "PROPERTY"),
    [myHand]
  );
  const discardNeeded = Math.max(0, discardableHand.length - MAX_HAND_SIZE);
  const canConfirmDiscard = discardNeeded > 0 && discardSelection.length === discardNeeded;

  const lobbyOrder = useMemo(
    () =>
      lobbyPlayers
        .map((p) => p.playerId ?? p.id)
        .filter((pid): pid is string => Boolean(pid)),
    [lobbyPlayers]
  );
  const orderedPids = (
    game?.playerOrder?.length ? game.playerOrder : lobbyOrder
  ).slice(0, 5);
  const rotatedPids = useMemo(() => {
    if (!myPID || !orderedPids.includes(myPID)) return orderedPids;
    const idx = orderedPids.indexOf(myPID);
    return [...orderedPids.slice(idx), ...orderedPids.slice(0, idx)];
  }, [myPID, orderedPids]);
  const playerCount = Math.max(2, Math.min(5, rotatedPids.length || 2));
  const Mat = useMemo(
    () =>
      ({ 2: Playmat2, 3: Playmat3, 4: Playmat4, 5: Playmat5 }[playerCount] ||
      Playmat5),
    [playerCount]
  );

  const layout: PlaymatProps["layout"] = useMemo(() => {
    const seats = ["p1", "p2", "p3", "p4", "p5"] as const;
    const m: Partial<Record<(typeof seats)[number], string>> = {};
    rotatedPids.forEach((pid, i) => {
      m[seats[i]] = pid;
    });
    return m;
  }, [rotatedPids]);

  // last 3 images; newest at the end
  const discardImages = useMemo(
    () => (game?.discardPile ?? []).slice(-3).map(assetForCard),
    [game?.discardPile]
  );

  const playerCardMap = useMemo(() => {
    const m: Record<
      string,
      { bank: { images: string[]; total: number; count: number }; properties: unknown }
    > = {};
    if (!game?.playerState) return m;
    for (const pid of Object.keys(game.playerState)) {
      const ps = game.playerState[pid];
      const bankCards = (ps.bank ?? []).filter(
        (card) =>
          card.type === "MONEY" ||
          card.type === "GENERAL_ACTION" ||
          card.type === "RENT_ACTION"
      );
      const bankTotal = bankCards.reduce(
        (sum, card) => sum + (typeof card.value === "number" ? card.value : 0),
        0
      );
      m[pid] = {
        bank: {
          images: bankCards.map(assetForCard),
          total: bankTotal,
          count: bankCards.length,
        },
        properties: { propertyCollection: ps.propertyCollection },
      };
    }
    return m;
  }, [game?.playerState]);

  const parsePropertyCollection = useCallback((propertyCollection: unknown): PropertySetView[] => {
    if (!propertyCollection) return [];
    const rawCollection = (propertyCollection as any).collection ?? propertyCollection;
    if (!rawCollection || typeof rawCollection !== "object") return [];
    return Object.entries(rawCollection).map(([setId, setVal]) => {
      const properties: ServerCard[] = Array.isArray(setVal)
        ? (setVal as unknown as ServerCard[])
        : setVal && Array.isArray((setVal as any).properties)
          ? (setVal as any).properties
          : [];
      return {
        id: setId,
        color: (setVal as any)?.color ?? null,
        isComplete: Boolean((setVal as any)?.isComplete),
        properties,
        hasHouse: Boolean((setVal as any)?.house),
        hasHotel: Boolean((setVal as any)?.hotel),
      };
    });
  }, []);

  const playerPropertySets = useMemo(() => {
    const map: Record<string, PropertySetView[]> = {};
    if (!game?.playerState) return map;
    for (const [pid, ps] of Object.entries(game.playerState)) {
      map[pid] = parsePropertyCollection(ps.propertyCollection);
    }
    return map;
  }, [game?.playerState, parsePropertyCollection]);

  const myPropertySets = useMemo<PropertySetView[]>(
    () => playerPropertySets[myPID] ?? [],
    [myPID, playerPropertySets]
  );

  const myBankCards = useMemo(
    () =>
      (game?.playerState?.[myPID]?.bank ?? []).filter(
        (card) =>
          card.type === "MONEY" ||
          card.type === "GENERAL_ACTION" ||
          card.type === "RENT_ACTION"
      ),
    [game?.playerState, myPID]
  );

  const myPropertyCards = useMemo(
    () => myPropertySets.flatMap((set) => set.properties),
    [myPropertySets]
  );

  const getCardValue = (card: ServerCard) => (typeof card.value === "number" ? card.value : 0);

  const propertyEntries = useMemo<PropertyCardEntry[]>(() => {
    const entries: PropertyCardEntry[] = [];
    Object.entries(playerPropertySets).forEach(([pid, sets]) => {
      sets.forEach((set) => {
        set.properties.forEach((card) => {
          entries.push({
            card,
            ownerId: pid,
            setId: set.id,
            setColor: set.color,
            isComplete: set.isComplete,
          });
        });
      });
    });
    return entries;
  }, [playerPropertySets]);

  const propertyEntryById = useMemo(() => {
    const map = new Map<number, PropertyCardEntry>();
    propertyEntries.forEach((entry) => {
      map.set(entry.card.id, entry);
    });
    return map;
  }, [propertyEntries]);

  const opponentPropertyEntries = useMemo(
    () => propertyEntries.filter((entry) => entry.ownerId !== myPID),
    [propertyEntries, myPID]
  );
  const opponentIncompleteEntries = useMemo(
    () => opponentPropertyEntries.filter((entry) => !entry.isComplete),
    [opponentPropertyEntries]
  );
  const myIncompleteEntries = useMemo(
    () => propertyEntries.filter((entry) => entry.ownerId === myPID && !entry.isComplete),
    [propertyEntries, myPID]
  );

  const dealBreakerTargets = useMemo<DealBreakerTarget[]>(() => {
    const targets: DealBreakerTarget[] = [];
    Object.entries(playerPropertySets).forEach(([pid, sets]) => {
      if (pid === myPID) return;
      sets.forEach((set) => {
        if (set.isComplete) targets.push({ ownerId: pid, set });
      });
    });
    return targets;
  }, [myPID, playerPropertySets]);

  const houseTargets = useMemo(
    () => myPropertySets.filter((set) => set.isComplete && !set.hasHouse),
    [myPropertySets]
  );
  const hotelTargets = useMemo(
    () => myPropertySets.filter((set) => set.isComplete && set.hasHouse && !set.hasHotel),
    [myPropertySets]
  );

  

  const isRainbowCard = useCallback(
    (colors?: string[]) => (colors?.length ?? 0) >= ALL_COLOR_COUNT,
    []
  );

  const getDefaultReceiveColor = useCallback(
    (card: ServerCard, fallback?: string | null) => {
      const colors = card.colors ?? [];
      if (colors.length === 0) return null;
      if (isRainbowCard(colors)) return null;
      if (colors.length === 1) return colors[0];
      if (fallback && colors.includes(fallback)) return fallback;
      return colors[0] ?? null;
    },
    [isRainbowCard]
  );

  const needsReceiveColor = useCallback(
    (card: ServerCard) => {
      const colors = card.colors ?? [];
      return !isRainbowCard(colors) && colors.length > 1;
    },
    [isRainbowCard]
  );

  const chargePropertyCards = useMemo(
    () => myPropertyCards.filter((card) => !isRainbowCard(card.colors)),
    [isRainbowCard, myPropertyCards]
  );
  const hasNonPayableWilds = useMemo(
    () => myPropertyCards.some((card) => isRainbowCard(card.colors)),
    [isRainbowCard, myPropertyCards]
  );

  const positioningTargets = useMemo<PositioningTargets>(() => {
    if (!positioningCard) {
      return { existing: [] as PropertySetView[], newColors: [] as string[], isRainbow: false };
    }
    const cardColors = positioningCard.card.colors ?? [];
    const isRainbow = isRainbowCard(cardColors);
    const existing = myPropertySets.filter((set) => {
      if (set.id === positioningCard.fromSetId) return false;
      if (set.isComplete) return false;
      if (isRainbow) return true;
      if (!set.color) return false;
      return cardColors.includes(set.color);
    });
    const newColors = isRainbow ? [] : Array.from(new Set(cardColors));
    return { existing, newColors, isRainbow };
  }, [isRainbowCard, myPropertySets, positioningCard]);

  const rentTargets = useMemo(
    () => orderedPids.filter((pid) => pid && pid !== myPID),
    [orderedPids, myPID]
  );
  const hasRentTargets = rentTargets.length > 0;
  const debtTargets = rentTargets;
  const hasDebtTargets = debtTargets.length > 0;
  const hasSlyTargets = opponentIncompleteEntries.length > 0;
  const hasForcedTargets = opponentIncompleteEntries.length > 0 && myIncompleteEntries.length > 0;
  const hasDealBreakerTargets = dealBreakerTargets.length > 0;
  const hasHouseTargets = houseTargets.length > 0;
  const hasHotelTargets = hotelTargets.length > 0;

  const rentableSetMap = useMemo(() => {
    const map = new Map<string, string[]>();
    myPropertySets.forEach((set) => {
      if (!set.color) return;
      const list = map.get(set.color) ?? [];
      list.push(set.id);
      map.set(set.color, list);
    });
    return map;
  }, [myPropertySets]);

  const rentColorOptions = useMemo<RentColorOption[]>(() => {
    if (!rentCard) return [];
    const cardColors = rentCard.colors ?? [];
    const isWildRent = isRainbowCard(cardColors);
    const availableColors = Array.from(rentableSetMap.keys());
    const colors = isWildRent
      ? availableColors
      : cardColors.filter((color) => rentableSetMap.has(color));
    return colors.map((color) => ({
      color,
      setIds: rentableSetMap.get(color) ?? [],
    }));
  }, [isRainbowCard, rentCard, rentableSetMap]);

  const isWildRentCard = useMemo(() => {
    if (!rentCard) return false;
    if (rentCard.actionType === "WILD_RENT") return true;
    return isRainbowCard(rentCard.colors);
  }, [isRainbowCard, rentCard]);

  const autoRentColor = rentColorOptions.length === 1 ? rentColorOptions[0].color : null;
  const autoRentSetId =
    rentColorOptions.length === 1 ? rentColorOptions[0].setIds?.[0] ?? null : null;
  const effectiveRentColor = rentColor ?? autoRentColor;
  const effectiveRentSetId = rentSetId ?? autoRentSetId;

  const rentRequiresAll = !isWildRentCard;
  const rentChargeAllEffective = rentRequiresAll ? true : rentChargeAll;

  const canConfirmRent =
    isMyTurn &&
    playsLeft >= 1 + rentDoublers.length &&
    !!rentCard &&
    !!effectiveRentColor &&
    !!effectiveRentSetId &&
    hasRentTargets &&
    (rentChargeAllEffective || !!rentTarget);
  const canConfirmDebt =
    isMyTurn && playsLeft > 0 && !!debtCard && !!debtTarget && hasDebtTargets;

  const rentAmountDue = rentCharge?.amount ?? 0;
  const rentBankTotal = myBankCards.reduce((sum, card) => sum + getCardValue(card), 0);
  const rentPropertyTotal = chargePropertyCards.reduce(
    (sum, card) => sum + getCardValue(card),
    0
  );
  const rentTotalValue = rentBankTotal + rentPropertyTotal;

  const rentBankSelected = new Set(rentBankSelection);
  const rentPropertySelected = new Set(rentPropertySelection);
  const rentBankSelectedTotal = myBankCards
    .filter((card) => rentBankSelected.has(card.id))
    .reduce((sum, card) => sum + getCardValue(card), 0);
  const rentPropertySelectedTotal = chargePropertyCards
    .filter((card) => rentPropertySelected.has(card.id))
    .reduce((sum, card) => sum + getCardValue(card), 0);
  const rentSelectedTotal = rentBankSelectedTotal + rentPropertySelectedTotal;
  const rentRemaining = Math.max(0, rentAmountDue - rentSelectedTotal);

  const rentMustPayAll = !!rentCharge && rentTotalValue <= rentAmountDue;

  const rentBankIds = useMemo(() => myBankCards.map((card) => card.id), [myBankCards]);
  const rentPropertyIds = useMemo(
    () => chargePropertyCards.map((card) => card.id),
    [chargePropertyCards]
  );
  const rentBankSelectionComplete =
    rentBankIds.length === rentBankSelection.length &&
    rentBankIds.every((id) => rentBankSelected.has(id));
  const rentPropertySelectionComplete =
    rentPropertyIds.length === rentPropertySelection.length &&
    rentPropertyIds.every((id) => rentPropertySelected.has(id));

  const canPayRent =
    !!rentCharge &&
    (rentAmountDue <= 0
      ? rentSelectedTotal === 0
      : rentMustPayAll
        ? rentBankSelectionComplete && rentPropertySelectionComplete
        : rentSelectedTotal >= rentAmountDue);

  const jsnCards = useMemo(
    () =>
      myHand.filter(
        (card) => card.type === "GENERAL_ACTION" && card.actionType === "JUST_SAY_NO"
      ),
    [myHand]
  );
  const doubleRentCards = useMemo(
    () =>
      myHand.filter(
        (card) => card.type === "GENERAL_ACTION" && card.actionType === "DOUBLE_RENT"
      ),
    [myHand]
  );
  const maxRentDoubles = Math.min(2, Math.max(0, playsLeft - 1), doubleRentCards.length);
  const canAddFirstDouble = maxRentDoubles >= 1;
  const canAddSecondDouble = maxRentDoubles >= 2;
  const rentMultiplier = rentDoublers.length > 0 ? 1 << rentDoublers.length : 1;

  const slyTargetEntry = useMemo(
    () => (slyTargetCardId ? propertyEntryById.get(slyTargetCardId) ?? null : null),
    [propertyEntryById, slyTargetCardId]
  );
  const slyNeedsColorChoice = slyTargetEntry ? needsReceiveColor(slyTargetEntry.card) : false;
  const slyAvailableColors = slyTargetEntry?.card.colors ?? [];
  const slyResolvedColor = slyTargetEntry
    ? slyNeedsColorChoice
      ? slyReceiveColor ?? getDefaultReceiveColor(slyTargetEntry.card, slyTargetEntry.setColor)
      : getDefaultReceiveColor(slyTargetEntry.card, slyTargetEntry.setColor)
    : null;

  const forcedTargetEntry = useMemo(
    () => (forcedTargetCardId ? propertyEntryById.get(forcedTargetCardId) ?? null : null),
    [forcedTargetCardId, propertyEntryById]
  );
  const forcedGiveEntry = useMemo(
    () => (forcedGiveCardId ? propertyEntryById.get(forcedGiveCardId) ?? null : null),
    [forcedGiveCardId, propertyEntryById]
  );
  const forcedNeedsColorChoice = forcedTargetEntry
    ? needsReceiveColor(forcedTargetEntry.card)
    : false;
  const forcedAvailableColors = forcedTargetEntry?.card.colors ?? [];
  const forcedResolvedColor = forcedTargetEntry
    ? forcedNeedsColorChoice
      ? forcedReceiveColor ?? getDefaultReceiveColor(forcedTargetEntry.card, forcedTargetEntry.setColor)
      : getDefaultReceiveColor(forcedTargetEntry.card, forcedTargetEntry.setColor)
    : null;
  /** Click-menu actions */
  const onCardClick = (card: ServerCard) => {
    if (!isMyTurn) return;
    if (isDiscarding) return;
    if (isPositioning) return;
    if (isRenting) return;
    if (isDebtCollecting) return;
    if (isSlyDealing) return;
    if (isForcedDealing) return;
    if (isDealBreaking) return;
    if (isDeveloping) return;
    setMenuCard(card);
    if (card.type === "PROPERTY") {
      const colors = card.colors ?? [];
      setColorChoices(colors.length > 1 ? colors : null);
    } else setColorChoices(null);
  };

  const bankSelected = () => {
    if (!menuCard || !isMyTurn || playsLeft <= 0) return;
    if (
      menuCard.type === "MONEY" ||
      menuCard.type === "GENERAL_ACTION" ||
      menuCard.type === "RENT_ACTION"
    ) {
      wsSend({ type: "PlayMoney", id: menuCard.id });
    }
    setMenuCard(null);
    setColorChoices(null);
  };

  const passGoSelected = () => {
    if (!menuCard || !isMyTurn || playsLeft <= 0) return;
    if (menuCard.type !== "GENERAL_ACTION" || menuCard.actionType !== "PASS_GO") return;
    wsSend({ type: "PassGo", id: menuCard.id });
    setMenuCard(null);
    setColorChoices(null);
  };

  const playBirthdaySelected = useCallback(() => {
    if (!menuCard || !isMyTurn || playsLeft <= 0) return;
    if (menuCard.type !== "GENERAL_ACTION" || menuCard.actionType !== "BIRTHDAY") return;
    wsSend({ type: "Birthday", id: menuCard.id });
    setMenuCard(null);
    setColorChoices(null);
  }, [isMyTurn, menuCard, playsLeft, wsSend]);

  const playDoubleRentSelected = useCallback(() => {
    if (!menuCard || !isMyTurn || playsLeft <= 0) return;
    if (menuCard.type !== "GENERAL_ACTION" || menuCard.actionType !== "DOUBLE_RENT") return;
    wsSend({ type: "PlayDoubleRent", id: menuCard.id });
    setMenuCard(null);
    setColorChoices(null);
  }, [isMyTurn, menuCard, playsLeft, wsSend]);

  const openDebtCollectorMenu = useCallback(
    (card: ServerCard) => {
      if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) return;
      if (!hasDebtTargets) return;
      setMenuCard(null);
      setColorChoices(null);
      setIsDebtCollecting(true);
      setDebtCard(card);
      setDebtTarget(null);
    },
    [hasDebtTargets, isDiscarding, isMyTurn, isPositioning, playsLeft]
  );

  const closeDebtCollectorMenu = useCallback(() => {
    setIsDebtCollecting(false);
    setDebtCard(null);
    setDebtTarget(null);
  }, []);

  const playPropertySelected = (color?: string) => {
    if (!menuCard || !isMyTurn || playsLeft <= 0) return;
    const chosen = color ?? menuCard.colors?.[0];
    if (!chosen) {
      setMenuCard(null);
      return;
    }
  wsSend({ type: "PlayProperty", id: menuCard.id, color: chosen });
    setMenuCard(null);
    setColorChoices(null);
  };

  const openPositioning = useCallback(() => {
    if (!isMyTurn || isDiscarding) return;
    if (myPropertySets.length === 0) return;
    setMenuCard(null);
    setColorChoices(null);
    setIsPositioning(true);
    setPositioningCard(null);
    setPositionTarget(null);
  }, [isMyTurn, isDiscarding, myPropertySets.length]);

  const closePositioning = useCallback(() => {
    setIsPositioning(false);
    setPositioningCard(null);
    setPositionTarget(null);
  }, []);

  const selectPositioningCard = useCallback((card: ServerCard, fromSetId: string) => {
    setPositioningCard({ card, fromSetId });
    setPositionTarget(null);
  }, []);

  const selectPositionTarget = useCallback((toSetId: string, toColor?: string | null) => {
    setPositionTarget({ toSetId, toColor });
  }, []);

  const confirmPositioning = useCallback(() => {
    if (!isMyTurn || !positioningCard || !positionTarget) return;
    const action: Action = {
      type: "MoveProperty",
      cardId: positioningCard.card.id,
      fromSetId: positioningCard.fromSetId,
      toSetId: positionTarget.toSetId,
      ...(positionTarget.toColor ? { toColor: positionTarget.toColor } : {}),
    };
    wsSend(action);
    closePositioning();
  }, [closePositioning, isMyTurn, positionTarget, positioningCard, wsSend]);

  const openRentMenu = useCallback((card: ServerCard) => {
    if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) return;
    setMenuCard(null);
    setColorChoices(null);
    setIsRenting(true);
    setRentCard(card);
    setRentColor(null);
    setRentSetId(null);
    setRentChargeAll(true);
    setRentTarget(null);
    setRentDoublers([]);
  }, [isDiscarding, isMyTurn, isPositioning, playsLeft]);

  const closeRentMenu = useCallback(() => {
    setIsRenting(false);
    setRentCard(null);
    setRentColor(null);
    setRentSetId(null);
    setRentChargeAll(true);
    setRentTarget(null);
    setRentDoublers([]);
  }, []);

  const addFirstDoubleRent = useCallback(() => {
    if (!canAddFirstDouble) return;
    const next = doubleRentCards.find((card) => !rentDoublers.includes(card.id));
    if (!next) return;
    setRentDoublers([next.id]);
  }, [canAddFirstDouble, doubleRentCards, rentDoublers]);

  const addSecondDoubleRent = useCallback(() => {
    if (!canAddSecondDouble) return;
    const next = doubleRentCards.find((card) => !rentDoublers.includes(card.id));
    if (!next) return;
    setRentDoublers((prev) => {
      if (prev.includes(next.id)) return prev;
      return [...prev, next.id].slice(0, 2);
    });
  }, [canAddSecondDouble, doubleRentCards, rentDoublers]);

  const removeSecondDoubleRent = useCallback(() => {
    setRentDoublers((prev) => prev.slice(0, 1));
  }, []);

  const clearDoubleRent = useCallback(() => {
    setRentDoublers([]);
  }, []);

  const selectRentColor = useCallback(
    (color: string) => {
      const option = rentColorOptions.find((entry) => entry.color === color);
      setRentColor(color);
      setRentSetId(option?.setIds?.[0] ?? null);
    },
    [rentColorOptions]
  );

  const confirmRent = useCallback(() => {
    if (!rentCard || !effectiveRentColor || !effectiveRentSetId) return;
    if (!isMyTurn || playsLeft <= 0) return;
    if (!hasRentTargets) return;
    if (!rentChargeAllEffective && !rentTarget) return;
    const playsNeeded = 1 + rentDoublers.length;
    if (playsLeft < playsNeeded) return;
    wsSend({
      type: "RequestRent",
      rentCardId: rentCard.id,
      rentDoublers,
      rentingSetId: effectiveRentSetId,
      rentColor: effectiveRentColor,
      target: rentChargeAllEffective ? null : rentTarget,
    });
    closeRentMenu();
  }, [
    closeRentMenu,
    effectiveRentColor,
    effectiveRentSetId,
    hasRentTargets,
    isMyTurn,
    playsLeft,
    rentCard,
    rentChargeAllEffective,
    rentTarget,
    rentDoublers,
    wsSend,
  ]);

  const confirmDebtCollector = useCallback(() => {
    if (!debtCard || !debtTarget) return;
    if (!isMyTurn || playsLeft <= 0) return;
    if (!hasDebtTargets) return;
    wsSend({
      type: "DebtCollect",
      id: debtCard.id,
      target: debtTarget,
    });
    closeDebtCollectorMenu();
  }, [closeDebtCollectorMenu, debtCard, debtTarget, hasDebtTargets, isMyTurn, playsLeft, wsSend]);

  const openSlyDealMenu = useCallback(
    (card: ServerCard) => {
      if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) return;
      setMenuCard(null);
      setColorChoices(null);
      setIsSlyDealing(true);
      setSlyCard(card);
      setSlyTargetCardId(null);
      setSlyReceiveColor(null);
    },
    [isDiscarding, isMyTurn, isPositioning, playsLeft]
  );

  const closeSlyDealMenu = useCallback(() => {
    setIsSlyDealing(false);
    setSlyCard(null);
    setSlyTargetCardId(null);
    setSlyReceiveColor(null);
  }, []);

  const selectSlyTarget = useCallback(
    (cardId: number) => {
      const entry = propertyEntryById.get(cardId);
      setSlyTargetCardId(cardId);
      setSlyReceiveColor(entry ? getDefaultReceiveColor(entry.card, entry.setColor) : null);
    },
    [getDefaultReceiveColor, propertyEntryById]
  );

  const selectSlyColor = useCallback((color: string) => {
    setSlyReceiveColor(color);
  }, []);

  const confirmSlyDeal = useCallback(() => {
    if (!slyCard || !slyTargetEntry) return;
    if (!isMyTurn || playsLeft <= 0) return;
    const colorToReceiveAs = slyNeedsColorChoice
      ? slyReceiveColor ?? getDefaultReceiveColor(slyTargetEntry.card, slyTargetEntry.setColor)
      : getDefaultReceiveColor(slyTargetEntry.card, slyTargetEntry.setColor);
    wsSend({
      type: "SlyDeal",
      id: slyCard.id,
      targetCard: slyTargetEntry.card.id,
      ...(colorToReceiveAs ? { colorToReceiveAs } : {}),
    });
    closeSlyDealMenu();
  }, [
    closeSlyDealMenu,
    getDefaultReceiveColor,
    isMyTurn,
    playsLeft,
    slyCard,
    slyNeedsColorChoice,
    slyReceiveColor,
    slyTargetEntry,
    wsSend,
  ]);

  const openForcedDealMenu = useCallback(
    (card: ServerCard) => {
      if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) return;
      setMenuCard(null);
      setColorChoices(null);
      setIsForcedDealing(true);
      setForcedCard(card);
      setForcedTargetCardId(null);
      setForcedGiveCardId(null);
      setForcedReceiveColor(null);
    },
    [isDiscarding, isMyTurn, isPositioning, playsLeft]
  );

  const closeForcedDealMenu = useCallback(() => {
    setIsForcedDealing(false);
    setForcedCard(null);
    setForcedTargetCardId(null);
    setForcedGiveCardId(null);
    setForcedReceiveColor(null);
  }, []);

  const selectForcedGive = useCallback((cardId: number) => {
    setForcedGiveCardId(cardId);
  }, []);

  const selectForcedTarget = useCallback(
    (cardId: number) => {
      const entry = propertyEntryById.get(cardId);
      setForcedTargetCardId(cardId);
      setForcedReceiveColor(entry ? getDefaultReceiveColor(entry.card, entry.setColor) : null);
    },
    [getDefaultReceiveColor, propertyEntryById]
  );

  const selectForcedColor = useCallback((color: string) => {
    setForcedReceiveColor(color);
  }, []);

  const confirmForcedDeal = useCallback(() => {
    if (!forcedCard || !forcedTargetEntry || !forcedGiveEntry) return;
    if (!isMyTurn || playsLeft <= 0) return;
    const colorToReceiveAs = forcedNeedsColorChoice
      ? forcedReceiveColor ?? getDefaultReceiveColor(forcedTargetEntry.card, forcedTargetEntry.setColor)
      : getDefaultReceiveColor(forcedTargetEntry.card, forcedTargetEntry.setColor);
    wsSend({
      type: "ForcedDeal",
      id: forcedCard.id,
      targetCard: forcedTargetEntry.card.id,
      cardToGive: forcedGiveEntry.card.id,
      ...(colorToReceiveAs ? { colorToReceiveAs } : {}),
    });
    closeForcedDealMenu();
  }, [
    closeForcedDealMenu,
    forcedCard,
    forcedGiveEntry,
    forcedNeedsColorChoice,
    forcedReceiveColor,
    forcedTargetEntry,
    getDefaultReceiveColor,
    isMyTurn,
    playsLeft,
    wsSend,
  ]);

  const openDealBreakerMenu = useCallback(
    (card: ServerCard) => {
      if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) return;
      setMenuCard(null);
      setColorChoices(null);
      setIsDealBreaking(true);
      setDealBreakerCard(card);
      setDealBreakerTargetSetId(null);
    },
    [isDiscarding, isMyTurn, isPositioning, playsLeft]
  );

  const closeDealBreakerMenu = useCallback(() => {
    setIsDealBreaking(false);
    setDealBreakerCard(null);
    setDealBreakerTargetSetId(null);
  }, []);

  const confirmDealBreaker = useCallback(() => {
    if (!dealBreakerCard || !dealBreakerTargetSetId) return;
    if (!isMyTurn || playsLeft <= 0) return;
    wsSend({
      type: "Dealbreaker",
      id: dealBreakerCard.id,
      targetSetId: dealBreakerTargetSetId,
    });
    closeDealBreakerMenu();
  }, [closeDealBreakerMenu, dealBreakerCard, dealBreakerTargetSetId, isMyTurn, playsLeft, wsSend]);

  const openDevelopmentMenu = useCallback(
    (card: ServerCard) => {
      if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) return;
      setMenuCard(null);
      setColorChoices(null);
      setIsDeveloping(true);
      setDevelopmentCard(card);
      setDevelopmentTargetSetId(null);
    },
    [isDiscarding, isMyTurn, isPositioning, playsLeft]
  );

  const closeDevelopmentMenu = useCallback(() => {
    setIsDeveloping(false);
    setDevelopmentCard(null);
    setDevelopmentTargetSetId(null);
  }, []);

  const confirmDevelopment = useCallback(() => {
    if (!developmentCard || !developmentTargetSetId) return;
    if (!isMyTurn || playsLeft <= 0) return;
    wsSend({
      type: "PlayDevelopment",
      id: developmentCard.id,
      propertySetId: developmentTargetSetId,
    });
    closeDevelopmentMenu();
  }, [closeDevelopmentMenu, developmentCard, developmentTargetSetId, isMyTurn, playsLeft, wsSend]);

  const toggleRentBankCard = useCallback(
    (cardId: number) => {
      if (!rentCharge || rentMustPayAll) return;
      setRentBankSelection((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    },
    [rentCharge, rentMustPayAll]
  );

  const toggleRentPropertyCard = useCallback(
    (cardId: number) => {
      if (!rentCharge || rentMustPayAll) return;
      setRentPropertySelection((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    },
    [rentCharge, rentMustPayAll]
  );

  const submitRentPayment = useCallback(() => {
    if (!rentCharge || !canPayRent) return;
    const payment = [...rentBankSelection, ...rentPropertySelection];
    wsSend({ type: "AcceptCharge", payment });
    setRentCharge(null);
    setRentBankSelection([]);
    setRentPropertySelection([]);
  }, [canPayRent, rentBankSelection, rentCharge, rentPropertySelection, wsSend]);

  const sendJustSayNo = useCallback(
    (respondingTo?: string) => {
      if (jsnCards.length === 0) return;
      wsSend({
        type: "JustSayNo",
        ids: [jsnCards[0].id],
        ...(respondingTo ? { respondingTo } : {}),
      });
    },
    [jsnCards, wsSend]
  );

  const playRentJustSayNo = useCallback(() => {
    if (!rentCharge) return;
    sendJustSayNo();
    setRentCharge(null);
    setRentBankSelection([]);
    setRentPropertySelection([]);
  }, [rentCharge, sendJustSayNo]);

  const acceptJustSayNo = useCallback(
    (respondingTo: string) => {
      if (!respondingTo) return;
      wsSend({ type: "AcceptJustSayNo", respondingTo });
    },
    [wsSend]
  );

  /** DnD drop handling */
  // parseDropId removed with drag/drop

  // Drag & drop removed: use click/menu interactions only

  const sendEndTurn = useCallback(() => {
    if (!isMyTurn) return;
    if (discardableHand.length > MAX_HAND_SIZE) {
      setIsDiscarding(true);
      setMenuCard(null);
      setColorChoices(null);
      return;
    }
    wsSend({ type: "EndTurn" });
  }, [discardableHand.length, isMyTurn, wsSend]);

  const toggleDiscardSelection = useCallback(
    (cardId: number) => {
      const card = myHand.find((entry) => entry.id === cardId);
      if (card?.type === "PROPERTY") return;
      setDiscardSelection((prev) => {
        if (prev.includes(cardId)) {
          return prev.filter((id) => id !== cardId);
        }
        if (prev.length >= discardNeeded) return prev;
        return [...prev, cardId];
      });
    },
    [discardNeeded, myHand]
  );

  const autoSelectDiscards = useCallback(() => {
    if (discardNeeded <= 0) return;
    setDiscardSelection((prev) => {
      const selected = new Set(prev);
      const next = [...prev];
      for (const card of discardableHand) {
        if (next.length >= discardNeeded) break;
        if (!selected.has(card.id)) {
          next.push(card.id);
          selected.add(card.id);
        }
      }
      return next.slice(0, discardNeeded);
    });
  }, [discardNeeded, discardableHand]);

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
      const inHand = prev.filter((id) => discardableHand.some((c) => c.id === id));
      if (inHand.length <= discardNeeded) return inHand;
      return inHand.slice(0, discardNeeded);
    });
  }, [discardNeeded, discardableHand, isDiscarding]);

  useEffect(() => {
    if (!isPositioning) return;
    if (!isMyTurn || isDiscarding) {
      closePositioning();
    }
  }, [closePositioning, isDiscarding, isMyTurn, isPositioning]);

  useEffect(() => {
    if (!isPositioning || !positioningCard) return;
    const stillOwned = myPropertySets.some((set) =>
      set.properties.some((card) => card.id === positioningCard.card.id)
    );
    if (!stillOwned) {
      setPositioningCard(null);
      setPositionTarget(null);
    }
  }, [isPositioning, myPropertySets, positioningCard]);

  useEffect(() => {
    if (!isRenting) return;
    if (!isMyTurn || isDiscarding || isPositioning) {
      closeRentMenu();
    }
  }, [closeRentMenu, isDiscarding, isMyTurn, isPositioning, isRenting]);

  useEffect(() => {
    if (!isRenting || !rentCard) return;
    const stillInHand = myHand.some((card) => card.id === rentCard.id);
    if (!stillInHand) {
      closeRentMenu();
    }
  }, [closeRentMenu, isRenting, myHand, rentCard]);

  useEffect(() => {
    if (!isRenting) return;
    if (rentColorOptions.length === 1 && !rentColor) {
      const only = rentColorOptions[0];
      setRentColor(only.color);
      setRentSetId(only.setIds[0] ?? null);
    }
  }, [isRenting, rentColor, rentColorOptions]);

  useEffect(() => {
    if (!isRenting) return;
    if (rentRequiresAll) {
      if (!rentChargeAll) setRentChargeAll(true);
      if (rentTarget) setRentTarget(null);
      return;
    }
    if (!rentChargeAll && rentTargets.length === 1 && !rentTarget) {
      setRentTarget(rentTargets[0]);
    }
  }, [isRenting, rentChargeAll, rentRequiresAll, rentTarget, rentTargets]);

  useEffect(() => {
    if (!isRenting) return;
    const allowed = new Set(doubleRentCards.map((card) => card.id));
    setRentDoublers((prev) => {
      const filtered = prev.filter((id) => allowed.has(id));
      return filtered.slice(0, maxRentDoubles);
    });
  }, [doubleRentCards, isRenting, maxRentDoubles]);

  useEffect(() => {
    if (!isDebtCollecting) return;
    if (!isMyTurn || isDiscarding || isPositioning) {
      closeDebtCollectorMenu();
    }
  }, [closeDebtCollectorMenu, isDebtCollecting, isDiscarding, isMyTurn, isPositioning]);

  useEffect(() => {
    if (!isDebtCollecting || !debtCard) return;
    const stillInHand = myHand.some((card) => card.id === debtCard.id);
    if (!stillInHand) {
      closeDebtCollectorMenu();
    }
  }, [closeDebtCollectorMenu, debtCard, isDebtCollecting, myHand]);

  useEffect(() => {
    if (!isDebtCollecting) return;
    if (debtTargets.length === 1 && !debtTarget) {
      setDebtTarget(debtTargets[0]);
    }
  }, [debtTarget, debtTargets, isDebtCollecting]);

  useEffect(() => {
    if (!isSlyDealing) return;
    if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) {
      closeSlyDealMenu();
      return;
    }
    if (slyCard && !myHand.some((card) => card.id === slyCard.id)) {
      closeSlyDealMenu();
    }
  }, [
    closeSlyDealMenu,
    isDiscarding,
    isMyTurn,
    isPositioning,
    isSlyDealing,
    myHand,
    playsLeft,
    slyCard,
  ]);

  useEffect(() => {
    if (!isForcedDealing) return;
    if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) {
      closeForcedDealMenu();
      return;
    }
    if (forcedCard && !myHand.some((card) => card.id === forcedCard.id)) {
      closeForcedDealMenu();
    }
  }, [
    closeForcedDealMenu,
    forcedCard,
    isDiscarding,
    isForcedDealing,
    isMyTurn,
    isPositioning,
    myHand,
    playsLeft,
  ]);

  useEffect(() => {
    if (!isDealBreaking) return;
    if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) {
      closeDealBreakerMenu();
      return;
    }
    if (dealBreakerCard && !myHand.some((card) => card.id === dealBreakerCard.id)) {
      closeDealBreakerMenu();
    }
  }, [
    closeDealBreakerMenu,
    dealBreakerCard,
    isDealBreaking,
    isDiscarding,
    isMyTurn,
    isPositioning,
    myHand,
    playsLeft,
  ]);

  useEffect(() => {
    if (!isDeveloping) return;
    if (!isMyTurn || isDiscarding || isPositioning || playsLeft <= 0) {
      closeDevelopmentMenu();
      return;
    }
    if (developmentCard && !myHand.some((card) => card.id === developmentCard.id)) {
      closeDevelopmentMenu();
    }
  }, [
    closeDevelopmentMenu,
    developmentCard,
    isDeveloping,
    isDiscarding,
    isMyTurn,
    isPositioning,
    myHand,
    playsLeft,
  ]);

  useEffect(() => {
    if (!isSlyDealing) return;
    if (slyTargetCardId) return;
    if (opponentIncompleteEntries.length === 1) {
      selectSlyTarget(opponentIncompleteEntries[0].card.id);
    }
  }, [isSlyDealing, opponentIncompleteEntries, selectSlyTarget, slyTargetCardId]);

  useEffect(() => {
    if (!isForcedDealing) return;
    if (!forcedGiveCardId && myIncompleteEntries.length === 1) {
      setForcedGiveCardId(myIncompleteEntries[0].card.id);
    }
    if (!forcedTargetCardId && opponentIncompleteEntries.length === 1) {
      selectForcedTarget(opponentIncompleteEntries[0].card.id);
    }
  }, [
    forcedGiveCardId,
    forcedTargetCardId,
    isForcedDealing,
    myIncompleteEntries,
    opponentIncompleteEntries,
    selectForcedTarget,
  ]);

  useEffect(() => {
    if (!isDealBreaking) return;
    if (!dealBreakerTargetSetId && dealBreakerTargets.length === 1) {
      setDealBreakerTargetSetId(dealBreakerTargets[0].set.id);
    }
  }, [dealBreakerTargetSetId, dealBreakerTargets, isDealBreaking]);

  useEffect(() => {
    if (!isDeveloping || !developmentCard) return;
    if (developmentTargetSetId) return;
    const isHotel = developmentCard.actionType === "HOTEL";
    const targets = isHotel ? hotelTargets : houseTargets;
    if (targets.length === 1) {
      setDevelopmentTargetSetId(targets[0].id);
    }
  }, [
    developmentCard,
    developmentTargetSetId,
    hotelTargets,
    houseTargets,
    isDeveloping,
  ]);

  useEffect(() => {
    const pending = pendingInteractions;
    if (pending.length === 0) {
      setRentCharge(null);
      return;
    }
    const rentInteraction = pending.find(
      (entry) =>
        entry?.awaitingResponseFrom === myPID &&
        entry?.toPlayer === myPID &&
        (entry?.action?.type === "RENT_REQUEST" ||
          entry?.action?.type === "BIRTHDAY" ||
          entry?.action?.type === "DEBT_COLLECTOR")
    );
    if (!rentInteraction) {
      setRentCharge(null);
      return;
    }
    const action = rentInteraction.action ?? {};
    const isBirthday = action.type === "BIRTHDAY";
    const isDebtCollector = action.type === "DEBT_COLLECTOR";
    const nextKind: ChargeKind = isBirthday
      ? "BIRTHDAY"
      : isDebtCollector
        ? "DEBT_COLLECTOR"
        : "RENT";
    const next = {
      requesterId: action.requester ?? "",
      amount: isBirthday
        ? BIRTHDAY_PAYMENT_AMOUNT
        : isDebtCollector
          ? DEBT_COLLECTOR_PAYMENT_AMOUNT
          : typeof action.amount === "number"
            ? action.amount
            : Number(action.amount ?? 0) || 0,
      color: isBirthday || isDebtCollector ? null : action.color ?? null,
      kind: nextKind,
    };
    setRentCharge((prev) =>
      prev &&
      prev.requesterId === next.requesterId &&
      prev.amount === next.amount &&
      prev.color === next.color &&
      prev.kind === next.kind
        ? prev
        : next
    );
  }, [myPID, pendingInteractions]);

  useEffect(() => {
    if (!rentCharge) {
      setRentBankSelection([]);
      setRentPropertySelection([]);
      return;
    }
    if (rentMustPayAll) {
      setRentBankSelection(rentBankIds);
      setRentPropertySelection(rentPropertyIds);
      return;
    }
    setRentBankSelection((prev) => prev.filter((id) => rentBankIds.includes(id)));
    setRentPropertySelection((prev) =>
      prev.filter((id) => rentPropertyIds.includes(id))
    );
  }, [
    rentAmountDue,
    rentBankIds,
    rentBankTotal,
    rentCharge,
    rentPropertyIds,
    rentTotalValue,
    rentMustPayAll,
  ]);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const chargeTitle =
    rentCharge?.kind === "BIRTHDAY"
      ? "Pay Birthday"
      : rentCharge?.kind === "DEBT_COLLECTOR"
        ? "Pay Debt Collector"
        : "Pay Rent";
  const chargePayLabel =
    rentCharge?.kind === "BIRTHDAY"
      ? "Pay Birthday"
      : rentCharge?.kind === "DEBT_COLLECTOR"
        ? "Pay Debt"
        : "Pay Rent";
  const chargeSubtitle = rentCharge
    ? rentCharge.kind === "BIRTHDAY"
      ? `${displayName(rentCharge.requesterId)} requests ${rentAmountDue}M for their birthday.`
      : rentCharge.kind === "DEBT_COLLECTOR"
        ? `${displayName(rentCharge.requesterId)} demands ${rentAmountDue}M in debt.`
      : `${displayName(rentCharge.requesterId)} requests ${rentAmountDue}M${
          rentCharge.color ? ` for ${formatColor(rentCharge.color)} rent.` : " in rent."
        }`
    : "";
  const mustPayAllLabel =
    rentCharge?.kind === "RENT"
      ? "All of your cards are required to cover this rent."
      : "All of your cards are required to cover this charge.";

  const rentJsnInteraction = useMemo(
    () =>
      pendingInteractions.find(
        (entry) =>
          entry?.awaitingResponseFrom === myPID &&
          entry?.toPlayer !== myPID &&
          (entry?.action?.type === "RENT_REQUEST" ||
            entry?.action?.type === "BIRTHDAY" ||
            entry?.action?.type === "DEBT_COLLECTOR")
      ) ?? null,
    [myPID, pendingInteractions]
  );
  const rentJsnAction = rentJsnInteraction?.action as
    | { type: "RENT_REQUEST"; color?: string | null }
    | { type: "BIRTHDAY" }
    | { type: "DEBT_COLLECTOR" }
    | undefined;
  const rentJsnLabel =
    rentJsnAction?.type === "BIRTHDAY"
      ? "birthday"
      : rentJsnAction?.type === "DEBT_COLLECTOR"
        ? "debt collector"
        : rentJsnAction?.type === "RENT_REQUEST"
          ? rentJsnAction.color
            ? `${formatColor(rentJsnAction.color)} rent`
            : "rent"
          : "charge";
  const rentJsnSubtitle = rentJsnInteraction
    ? `${displayName(rentJsnInteraction.toPlayer)} played Just Say No against your ${rentJsnLabel}.`
    : "";

  const dealInteraction = useMemo(
    () =>
      pendingInteractions.find(
        (entry) =>
          entry?.awaitingResponseFrom === myPID &&
          (entry?.action?.type === "SLY_DEAL" ||
            entry?.action?.type === "FORCED_DEAL" ||
            entry?.action?.type === "DEALBREAKER")
      ) ?? null,
    [myPID, pendingInteractions]
  );
  const dealAction = dealInteraction?.action as
    | {
        type: "SLY_DEAL";
        requester: string;
        targetPlayer: string;
        targetCard: number;
        receivingAs?: string | null;
      }
    | {
        type: "FORCED_DEAL";
        requester: string;
        targetPlayer: string;
        targetCard: number;
        requesterCard: number;
        requesterReceivingAs?: string | null;
      }
    | {
        type: "DEALBREAKER";
        requester: string;
        targetPlayer: string;
        targetSetId: string;
      }
    | undefined;
  const dealType = dealAction?.type ?? null;
  const dealIsAggressor = dealInteraction?.fromPlayer === myPID;

  const dealTargetCardEntry = useMemo(() => {
    if (!dealAction) return null;
    if (dealAction.type === "SLY_DEAL" || dealAction.type === "FORCED_DEAL") {
      return propertyEntryById.get(dealAction.targetCard) ?? null;
    }
    return null;
  }, [dealAction, propertyEntryById]);

  const dealIncomingCardEntry = useMemo(() => {
    if (!dealAction) return null;
    if (dealAction.type === "FORCED_DEAL") {
      return propertyEntryById.get(dealAction.requesterCard) ?? null;
    }
    return null;
  }, [dealAction, propertyEntryById]);

  const dealTargetSet = useMemo(() => {
    if (!dealAction || dealAction.type !== "DEALBREAKER") return null;
    const sets = playerPropertySets[dealAction.targetPlayer] ?? [];
    return sets.find((set) => set.id === dealAction.targetSetId) ?? null;
  }, [dealAction, playerPropertySets]);

  const dealNeedsColorChoice =
    !!dealIncomingCardEntry && needsReceiveColor(dealIncomingCardEntry.card);
  const dealColorOptions = dealIncomingCardEntry?.card.colors ?? [];
  const dealResolvedColor = dealIncomingCardEntry
    ? dealNeedsColorChoice
      ? dealReceiveColor ??
        getDefaultReceiveColor(dealIncomingCardEntry.card, dealIncomingCardEntry.setColor)
      : getDefaultReceiveColor(dealIncomingCardEntry.card, dealIncomingCardEntry.setColor)
    : null;

  const dealTitle =
    dealType === "SLY_DEAL"
      ? "Sly Deal"
      : dealType === "FORCED_DEAL"
        ? "Forced Deal"
        : dealType === "DEALBREAKER"
          ? "Deal Breaker"
          : "";
  const dealSubtitle =
    dealType === "SLY_DEAL"
      ? `${displayName(dealAction?.requester)} wants to steal a property from you.`
      : dealType === "FORCED_DEAL"
        ? `${displayName(dealAction?.requester)} wants to swap properties with you.`
        : dealType === "DEALBREAKER"
          ? `${displayName(dealAction?.requester)} wants to take a completed set.`
          : "";
  const canAcceptDeal = !dealNeedsColorChoice || !!dealResolvedColor;

  useEffect(() => {
    if (!dealInteraction || dealType !== "FORCED_DEAL" || !dealIncomingCardEntry) {
      setDealReceiveColor(null);
      return;
    }
    const defaultColor = getDefaultReceiveColor(
      dealIncomingCardEntry.card,
      dealIncomingCardEntry.setColor
    );
    setDealReceiveColor((prev) =>
      prev && dealIncomingCardEntry.card.colors?.includes(prev) ? prev : defaultColor
    );
  }, [dealIncomingCardEntry, dealInteraction, dealType, getDefaultReceiveColor]);

  const acceptDeal = useCallback(() => {
    if (!dealInteraction || dealIsAggressor) return;
    const receiveAsColor = dealNeedsColorChoice ? dealResolvedColor ?? null : dealResolvedColor ?? null;
    wsSend({ type: "AcceptDeal", receiveAsColor });
  }, [dealInteraction, dealIsAggressor, dealNeedsColorChoice, dealResolvedColor, wsSend]);

  const devJsnInteraction = useMemo(
    () =>
      pendingInteractions.find(
        (entry) =>
          entry?.awaitingResponseFrom === myPID &&
          entry?.action?.type === "DEVELOPMENT_REQUEST"
      ) ?? null,
    [pendingInteractions, myPID]
  );
  const devRequester = devJsnInteraction?.action?.requester as string | undefined;
  const devType = devJsnInteraction?.action?.developmentType as string | undefined;
  const devLabel = devType ? formatActionLabel(devType) : "Development";
  const devRespondingTo = (devJsnInteraction?.toPlayer as string | undefined) ?? myPID;

  return (
    <div className="play-screen">
      {/* Top bar */}
      <div className="play-topbar">
        <div>
          Room Code: <b>{roomCode || "-"}</b>
        </div>
        <div>
          Room ID: <b>{roomId || "-"}</b>
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
        <button
          className="position-button"
          onClick={openPositioning}
          disabled={!isMyTurn || isDiscarding || myPropertySets.length === 0}
        >
          Position
        </button>
        <div
          className={`ws-dot ${wsReady ? "on" : "off"}`}
          title={wsReady ? "Connected" : "Reconnecting..."}
        />
      </div>

      <div className="play-area">
        <Mat
          layout={layout}
          myPID={myPID}
          names={nameById}
          discardImages={discardImages}
          playerCardMap={playerCardMap}
          cardImageForId={(id) => cardAssetMap[id] ?? cardBack}
        />
      </div>

      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.kind}`}>
              <span className="toast-icon" aria-hidden>
                !
              </span>
              <span className="toast-message">{toast.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions: the End Turn button is rendered as a portal into document.body
        so it centers relative to the viewport */}

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
              (card.type === "MONEY" ||
                card.type === "PROPERTY" ||
                card.type === "RENT_ACTION" ||
                isPassGo);
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
              disabled={!isMyTurn || isDiscarding || isPositioning}
            >
              End Turn
            </button>,
            document.body
          )
        : null}

      <PositioningModal
        isOpen={isPositioning}
        myPropertySets={myPropertySets}
        positioningCard={positioningCard}
        positioningTargets={positioningTargets}
        positionTarget={positionTarget}
        newSetId={NEW_PROPERTY_SET_ID}
        formatColor={formatColor}
        assetForCard={assetForCard}
        onSelectCard={selectPositioningCard}
        onSelectTarget={selectPositionTarget}
        onClose={closePositioning}
        onConfirm={confirmPositioning}
        canConfirm={!!positioningCard && !!positionTarget}
      />

      <RentModal
        isOpen={isRenting}
        rentCard={rentCard}
        rentColorOptions={rentColorOptions}
        rentColor={rentColor}
        rentChargeAllEffective={rentChargeAllEffective}
        rentRequiresAll={rentRequiresAll}
        hasRentTargets={hasRentTargets}
        rentTargets={rentTargets}
        rentTarget={rentTarget}
        rentDoublers={rentDoublers}
        rentMultiplier={rentMultiplier}
        canAddFirstDouble={canAddFirstDouble}
        canAddSecondDouble={canAddSecondDouble}
        canConfirmRent={canConfirmRent}
        assetForCard={assetForCard}
        formatColor={formatColor}
        displayName={displayName}
        onSelectColor={selectRentColor}
        onSelectAllTargets={() => {
          setRentChargeAll(true);
          setRentTarget(null);
        }}
        onSelectSingleTargets={() => setRentChargeAll(false)}
        onSelectTarget={(pid) => setRentTarget(pid)}
        onAddFirstDouble={addFirstDoubleRent}
        onAddSecondDouble={addSecondDoubleRent}
        onRemoveSecondDouble={removeSecondDoubleRent}
        onClearDouble={clearDoubleRent}
        onClose={closeRentMenu}
        onConfirm={confirmRent}
      />

      <DebtCollectorModal
        isOpen={isDebtCollecting}
        debtCard={debtCard}
        debtTargets={debtTargets}
        debtTarget={debtTarget}
        hasDebtTargets={hasDebtTargets}
        displayName={displayName}
        assetForCard={assetForCard}
        amount={DEBT_COLLECTOR_PAYMENT_AMOUNT}
        onSelectTarget={(pid) => setDebtTarget(pid)}
        onClose={closeDebtCollectorMenu}
        onConfirm={confirmDebtCollector}
        canConfirm={canConfirmDebt}
      />

      <ChargeModal
        isOpen={!!rentCharge}
        title={chargeTitle}
        subtitle={chargeSubtitle}
        payLabel={chargePayLabel}
        mustPayAllLabel={mustPayAllLabel}
        jsnCount={jsnCards.length}
        onPlayJsn={playRentJustSayNo}
        myBankCards={myBankCards}
        chargePropertyCards={chargePropertyCards}
        rentBankTotal={rentBankTotal}
        rentPropertyTotal={rentPropertyTotal}
        rentSelectedTotal={rentSelectedTotal}
        rentRemaining={rentRemaining}
        rentBankSelected={rentBankSelected}
        rentPropertySelected={rentPropertySelected}
        rentMustPayAll={rentMustPayAll}
        hasNonPayableWilds={hasNonPayableWilds}
        canPayRent={canPayRent}
        assetForCard={assetForCard}
        getCardValue={getCardValue}
        onToggleBankCard={toggleRentBankCard}
        onTogglePropertyCard={toggleRentPropertyCard}
        onSubmit={submitRentPayment}
      />

      <JsnChainModal
        isOpen={!!rentJsnInteraction && !rentCharge}
        title="Just Say No played"
        subtitle={rentJsnSubtitle}
        jsnCount={jsnCards.length}
        onAcceptBlock={() => acceptJustSayNo(rentJsnInteraction?.toPlayer ?? "")}
        onPlayJsn={() => sendJustSayNo(rentJsnInteraction?.toPlayer ?? "")}
      />

      <DevelopmentJsnModal
        isOpen={!!devJsnInteraction && !rentCharge}
        devLabel={devLabel}
        devRequester={devRequester}
        jsnCount={jsnCards.length}
        displayName={displayName}
        onAllow={() => acceptJustSayNo(devRespondingTo)}
        onJsn={() => sendJustSayNo(devRespondingTo)}
      />

      <SlyDealModal
        isOpen={isSlyDealing}
        slyCard={slyCard}
        targets={opponentIncompleteEntries}
        selectedCardId={slyTargetCardId}
        needsColorChoice={slyNeedsColorChoice}
        availableColors={slyAvailableColors}
        selectedColor={slyResolvedColor}
        displayName={displayName}
        formatColor={formatColor}
        assetForCard={assetForCard}
        onSelectTarget={selectSlyTarget}
        onSelectColor={selectSlyColor}
        onClose={closeSlyDealMenu}
        onConfirm={confirmSlyDeal}
        canConfirm={!!slyTargetEntry && (!slyNeedsColorChoice || !!slyResolvedColor)}
      />

      <ForcedDealModal
        isOpen={isForcedDealing}
        forcedCard={forcedCard}
        giveOptions={myIncompleteEntries}
        targetOptions={opponentIncompleteEntries}
        selectedGiveCardId={forcedGiveCardId}
        selectedTargetCardId={forcedTargetCardId}
        needsColorChoice={forcedNeedsColorChoice}
        availableColors={forcedAvailableColors}
        selectedColor={forcedResolvedColor}
        displayName={displayName}
        formatColor={formatColor}
        assetForCard={assetForCard}
        onSelectGive={selectForcedGive}
        onSelectTarget={selectForcedTarget}
        onSelectColor={selectForcedColor}
        onClose={closeForcedDealMenu}
        onConfirm={confirmForcedDeal}
        canConfirm={
          !!forcedGiveEntry &&
          !!forcedTargetEntry &&
          (!forcedNeedsColorChoice || !!forcedResolvedColor)
        }
      />

      <DealBreakerModal
        isOpen={isDealBreaking}
        dealBreakerCard={dealBreakerCard}
        targets={dealBreakerTargets}
        selectedSetId={dealBreakerTargetSetId}
        displayName={displayName}
        formatColor={formatColor}
        assetForCard={assetForCard}
        onSelectSet={(setId) => setDealBreakerTargetSetId(setId)}
        onClose={closeDealBreakerMenu}
        onConfirm={confirmDealBreaker}
        canConfirm={!!dealBreakerTargetSetId}
      />

      <DevelopmentModal
        isOpen={isDeveloping}
        developmentCard={developmentCard}
        developmentLabel={developmentCard ? formatActionLabel(developmentCard.actionType) : "Development"}
        eligibleSets={
          developmentCard?.actionType === "HOTEL" ? hotelTargets : houseTargets
        }
        selectedSetId={developmentTargetSetId}
        formatColor={formatColor}
        assetForCard={assetForCard}
        onSelectSet={(setId) => setDevelopmentTargetSetId(setId)}
        onClose={closeDevelopmentMenu}
        onConfirm={confirmDevelopment}
        canConfirm={!!developmentTargetSetId}
      />

      <DealResponseModal
        isOpen={!!dealInteraction && !dealIsAggressor && !rentCharge}
        title={dealTitle}
        subtitle={dealSubtitle}
        jsnCount={jsnCards.length}
        targetLabel={dealType === "DEALBREAKER" ? "Set being stolen" : "Card you lose"}
        targetCard={dealTargetCardEntry?.card ?? null}
        targetSetCards={dealType === "DEALBREAKER" ? dealTargetSet?.properties ?? [] : []}
        incomingCard={dealIncomingCardEntry?.card ?? null}
        colorOptions={dealNeedsColorChoice ? dealColorOptions : []}
        selectedColor={dealResolvedColor}
        formatColor={formatColor}
        assetForCard={assetForCard}
        onSelectColor={(color) => setDealReceiveColor(color)}
        onPlayJsn={() => sendJustSayNo()}
        onAccept={acceptDeal}
        canAccept={canAcceptDeal}
      />

      <JsnChainModal
        isOpen={!!dealInteraction && dealIsAggressor && !rentCharge}
        title="Just Say No played"
        subtitle={`${displayName(dealInteraction?.toPlayer)} played Just Say No against your ${dealTitle}.`}
        jsnCount={jsnCards.length}
        onAcceptBlock={() => acceptJustSayNo(dealInteraction?.toPlayer ?? "")}
        onPlayJsn={() => sendJustSayNo(dealInteraction?.toPlayer ?? "")}
      />

      <DiscardModal
        isOpen={isDiscarding}
        maxHandSize={MAX_HAND_SIZE}
        discardNeeded={discardNeeded}
        myHand={myHand}
        discardSelection={discardSelection}
        canConfirmDiscard={canConfirmDiscard}
        assetForCard={assetForCard}
        onToggleSelection={toggleDiscardSelection}
        onAutoSelect={autoSelectDiscards}
        onConfirm={confirmDiscardAndEndTurn}
        onCancel={cancelDiscard}
      />

      {/* Inline property color picker / bank action */}
      {menuCard && (
        <div className="card-menu bg-gray-900 border border-gray-700 shadow-2xl">
          <div className="card-menu-row">
            <span className="text-white font-semibold text-lg">
              Selected: #{menuCard.id} {menuCard.type}
            </span>
          </div>
          <div className="card-menu-row">
            {(menuCard.type === "MONEY" ||
              menuCard.type === "GENERAL_ACTION" ||
              menuCard.type === "RENT_ACTION") && (
              <button
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                disabled={!isMyTurn || playsLeft <= 0}
                onClick={bankSelected}
              >
                Bank ({getCardValue(menuCard)}M)
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
            {menuCard.type === "RENT_ACTION" && (
              <button
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                disabled={!isMyTurn || playsLeft <= 0}
                onClick={() => openRentMenu(menuCard)}
              >
                Charge Rent
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
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "BIRTHDAY" && (
                <button
                  className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0}
                  onClick={playBirthdaySelected}
                >
                  It's My Birthday (+2M each)
                </button>
              )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "DEBT_COLLECTOR" && (
                <button
                  className="bg-rose-600 hover:bg-rose-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0 || !hasDebtTargets}
                  onClick={() => openDebtCollectorMenu(menuCard)}
                >
                  Debt Collector ({DEBT_COLLECTOR_PAYMENT_AMOUNT}M)
                </button>
              )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "DOUBLE_RENT" && (
                <button
                  className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0}
                  onClick={playDoubleRentSelected}
                >
                  Double The Rent
                </button>
              )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "SLY_DEAL" && (
                <button
                  className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0 || !hasSlyTargets}
                  onClick={() => openSlyDealMenu(menuCard)}
                >
                  Sly Deal
                </button>
              )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "FORCED_DEAL" && (
                <button
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0 || !hasForcedTargets}
                  onClick={() => openForcedDealMenu(menuCard)}
                >
                  Forced Deal
                </button>
              )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "DEAL_BREAKER" && (
                <button
                  className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0 || !hasDealBreakerTargets}
                  onClick={() => openDealBreakerMenu(menuCard)}
                >
                  Deal Breaker
                </button>
              )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "HOUSE" && (
                <button
                  className="bg-lime-600 hover:bg-lime-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0 || !hasHouseTargets}
                  onClick={() => openDevelopmentMenu(menuCard)}
                >
                  Place House
                </button>
              )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "HOTEL" && (
                <button
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled={!isMyTurn || playsLeft <= 0 || !hasHotelTargets}
                  onClick={() => openDevelopmentMenu(menuCard)}
                >
                  Place Hotel
                </button>
              )}
            {menuCard.type === "GENERAL_ACTION" &&
              menuCard.actionType === "JUST_SAY_NO" && (
                <button
                  className="bg-rose-700 disabled:bg-gray-600 
                           text-white font-medium px-4 py-2 rounded-lg 
                           transition-colors duration-200 shadow-md"
                  disabled
                >
                  Just Say No (use when targeted)
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
