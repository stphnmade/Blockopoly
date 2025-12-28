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

type PropertySetView = {
  id: string;
  color: string | null;
  isComplete: boolean;
  properties: ServerCard[];
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
  | { type: "AcceptCharge"; payment: number[] }
  | { type: "JustSayNo"; ids: number[]; respondingTo?: string | null }
  | {
      type: "RequestRent";
      rentCardId: number;
      rentDoublers: number[];
      rentingSetId: string;
      rentColor?: string | null;
      target?: string | null;
    }
  | {
      type: "MoveProperty";
      cardId: number;
      fromSetId: string | null;
      toSetId: string;
      position?: number;
      toColor?: string | null;
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
const ALL_COLOR_COUNT = 10;
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
  const [isPositioning, setIsPositioning] = useState(false);
  const [positioningCard, setPositioningCard] = useState<{
    card: ServerCard;
    fromSetId: string;
  } | null>(null);
  const [positionTarget, setPositionTarget] = useState<{
    toSetId: string;
    toColor?: string | null;
  } | null>(null);
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
  } | null>(null);
  const [rentBankSelection, setRentBankSelection] = useState<number[]>([]);
  const [rentPropertySelection, setRentPropertySelection] = useState<number[]>([]);
  const [rentNotice, setRentNotice] = useState<{
    message: string;
  } | null>(null);
    // activeCard state removed with drag/drop

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(500);
  const rentNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setRentNotice({ message });
          if (rentNoticeTimer.current) {
            clearTimeout(rentNoticeTimer.current);
          }
          rentNoticeTimer.current = setTimeout(() => {
            setRentNotice(null);
          }, 3200);
          if (targets.includes(myPID)) {
            const amount =
              typeof payload.amount === "number"
                ? payload.amount
                : Number(payload.amount ?? 0) || 0;
            setRentCharge({
              requesterId: requester ?? "",
              amount,
              color: rentColor ?? null,
            });
          }
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
  }, [navigate, wsUrl, roomId, myPID, handleStateSnapshot, handleDraw, displayName, formatColor]);

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

  const myPropertySets = useMemo<PropertySetView[]>(() => {
    const ps = game?.playerState?.[myPID];
    if (!ps?.propertyCollection) return [];
    const rawCollection = (ps.propertyCollection as any).collection ?? ps.propertyCollection;
    if (!rawCollection || typeof rawCollection !== "object") return [];
    return Object.entries(rawCollection).map(([setId, setVal]) => {
      const properties: ServerCard[] = Array.isArray(setVal)
        ? (setVal as unknown as ServerCard[])
        : (setVal && Array.isArray((setVal as any).properties)
          ? (setVal as any).properties
          : []);
      return {
        id: setId,
        color: (setVal as any)?.color ?? null,
        isComplete: Boolean((setVal as any)?.isComplete),
        properties,
      };
    });
  }, [game?.playerState, myPID]);

  const myBankCards = useMemo(
    () => game?.playerState?.[myPID]?.bank ?? [],
    [game?.playerState, myPID]
  );

  const myPropertyCards = useMemo(
    () => myPropertySets.flatMap((set) => set.properties),
    [myPropertySets]
  );

  const getCardValue = (card: ServerCard) => (typeof card.value === "number" ? card.value : 0);

  

  const isRainbowCard = useCallback(
    (colors?: string[]) => (colors?.length ?? 0) >= ALL_COLOR_COUNT,
    []
  );

  const positioningTargets = useMemo(() => {
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

  const rentColorOptions = useMemo(() => {
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

  const autoRentColor = rentColorOptions.length === 1 ? rentColorOptions[0].color : null;
  const autoRentSetId =
    rentColorOptions.length === 1 ? rentColorOptions[0].setIds?.[0] ?? null : null;
  const effectiveRentColor = rentColor ?? autoRentColor;
  const effectiveRentSetId = rentSetId ?? autoRentSetId;

  const canConfirmRent =
    isMyTurn &&
    playsLeft > 0 &&
    !!rentCard &&
    !!effectiveRentColor &&
    !!effectiveRentSetId &&
    hasRentTargets &&
    (rentChargeAll || !!rentTarget);

  const rentAmountDue = rentCharge?.amount ?? 0;
  const rentBankTotal = myBankCards.reduce((sum, card) => sum + getCardValue(card), 0);
  const rentPropertyTotal = myPropertyCards.reduce((sum, card) => sum + getCardValue(card), 0);
  const rentTotalValue = rentBankTotal + rentPropertyTotal;

  const rentBankSelected = new Set(rentBankSelection);
  const rentPropertySelected = new Set(rentPropertySelection);
  const rentBankSelectedTotal = myBankCards
    .filter((card) => rentBankSelected.has(card.id))
    .reduce((sum, card) => sum + getCardValue(card), 0);
  const rentPropertySelectedTotal = myPropertyCards
    .filter((card) => rentPropertySelected.has(card.id))
    .reduce((sum, card) => sum + getCardValue(card), 0);
  const rentSelectedTotal = rentBankSelectedTotal + rentPropertySelectedTotal;
  const rentRemaining = Math.max(0, rentAmountDue - rentSelectedTotal);

  const rentBankForced = !!rentCharge && rentBankTotal < rentAmountDue;
  const rentPropertyForced = !!rentCharge && rentTotalValue <= rentAmountDue;
  const rentPropertyAllowed =
    !!rentCharge && rentBankTotal < rentAmountDue && !rentPropertyForced;

  const rentBankIds = useMemo(() => myBankCards.map((card) => card.id), [myBankCards]);
  const rentPropertyIds = useMemo(
    () => myPropertyCards.map((card) => card.id),
    [myPropertyCards]
  );
  const rentBankSelectionComplete =
    rentBankIds.length === rentBankSelection.length &&
    rentBankIds.every((id) => rentBankSelected.has(id));
  const rentPropertySelectionComplete =
    rentPropertyIds.length === rentPropertySelection.length &&
    rentPropertyIds.every((id) => rentPropertySelected.has(id));

  const canPayRent =
    !!rentCharge &&
    (rentTotalValue <= rentAmountDue
      ? rentBankSelectionComplete && rentPropertySelectionComplete
      : rentBankTotal >= rentAmountDue
        ? rentPropertySelection.length === 0 && rentSelectedTotal >= rentAmountDue
        : rentBankSelectionComplete && rentSelectedTotal >= rentAmountDue);

  const jsnCards = useMemo(
    () =>
      myHand.filter(
        (card) => card.type === "GENERAL_ACTION" && card.actionType === "JUST_SAY_NO"
      ),
    [myHand]
  );
  /** Click-menu actions */
  const onCardClick = (card: ServerCard) => {
    if (!isMyTurn) return;
    if (isDiscarding) return;
    if (isPositioning) return;
    if (isRenting) return;
    if (card.type === "RENT_ACTION") {
      openRentMenu(card);
      return;
    }
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
  }, [isDiscarding, isMyTurn, isPositioning, playsLeft]);

  const closeRentMenu = useCallback(() => {
    setIsRenting(false);
    setRentCard(null);
    setRentColor(null);
    setRentSetId(null);
    setRentChargeAll(true);
    setRentTarget(null);
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
    if (!rentChargeAll && !rentTarget) return;
    wsSend({
      type: "RequestRent",
      rentCardId: rentCard.id,
      rentDoublers: [],
      rentingSetId: effectiveRentSetId,
      rentColor: effectiveRentColor,
      target: rentChargeAll ? null : rentTarget,
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
    rentChargeAll,
    rentTarget,
    wsSend,
  ]);

  const toggleRentBankCard = useCallback(
    (cardId: number) => {
      if (!rentCharge || rentBankForced) return;
      setRentBankSelection((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    },
    [rentBankForced, rentCharge]
  );

  const toggleRentPropertyCard = useCallback(
    (cardId: number) => {
      if (!rentCharge || !rentPropertyAllowed) return;
      setRentPropertySelection((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    },
    [rentCharge, rentPropertyAllowed]
  );

  const submitRentPayment = useCallback(() => {
    if (!rentCharge || !canPayRent) return;
    const payment = [...rentBankSelection, ...rentPropertySelection];
    wsSend({ type: "AcceptCharge", payment });
    setRentCharge(null);
    setRentBankSelection([]);
    setRentPropertySelection([]);
  }, [canPayRent, rentBankSelection, rentCharge, rentPropertySelection, wsSend]);

  const playJustSayNo = useCallback(() => {
    if (!rentCharge || jsnCards.length === 0) return;
    wsSend({ type: "JustSayNo", ids: [jsnCards[0].id] });
    setRentCharge(null);
    setRentBankSelection([]);
    setRentPropertySelection([]);
  }, [jsnCards, rentCharge, wsSend]);

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
    if (!rentChargeAll && rentTargets.length === 1 && !rentTarget) {
      setRentTarget(rentTargets[0]);
    }
  }, [isRenting, rentChargeAll, rentTarget, rentTargets]);

  useEffect(() => {
    const pending = (game?.pendingInteractions as any)?.pendingInteractions;
    if (!Array.isArray(pending)) {
      setRentCharge(null);
      return;
    }
    const rentInteraction = pending.find(
      (entry) =>
        entry?.awaitingResponseFrom === myPID &&
        entry?.action?.type === "RENT_REQUEST"
    );
    if (!rentInteraction) {
      setRentCharge(null);
      return;
    }
    const action = rentInteraction.action ?? {};
    const next = {
      requesterId: action.requester ?? "",
      amount:
        typeof action.amount === "number"
          ? action.amount
          : Number(action.amount ?? 0) || 0,
      color: action.color ?? null,
    };
    setRentCharge((prev) =>
      prev &&
      prev.requesterId === next.requesterId &&
      prev.amount === next.amount &&
      prev.color === next.color
        ? prev
        : next
    );
  }, [game?.pendingInteractions, myPID]);

  useEffect(() => {
    if (!rentCharge) {
      setRentBankSelection([]);
      setRentPropertySelection([]);
      return;
    }
    if (rentBankTotal < rentAmountDue) {
      setRentBankSelection(rentBankIds);
    } else {
      setRentBankSelection((prev) => prev.filter((id) => rentBankIds.includes(id)));
    }
    if (rentTotalValue <= rentAmountDue) {
      setRentPropertySelection(rentPropertyIds);
    } else if (rentBankTotal >= rentAmountDue) {
      setRentPropertySelection([]);
    } else {
      setRentPropertySelection((prev) =>
        prev.filter((id) => rentPropertyIds.includes(id))
      );
    }
  }, [
    rentAmountDue,
    rentBankIds,
    rentBankTotal,
    rentCharge,
    rentPropertyIds,
    rentTotalValue,
  ]);

  useEffect(() => {
    return () => {
      if (rentNoticeTimer.current) {
        clearTimeout(rentNoticeTimer.current);
      }
    };
  }, []);

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

        {rentNotice && (
          <div className="rent-notice" role="status" aria-live="polite">
            {rentNotice.message}
          </div>
        )}

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

      {isPositioning && (
        <div className="position-overlay" role="dialog" aria-modal="true" aria-labelledby="position-title">
          <div className="position-modal">
            <div className="position-header">
              <div className="position-title" id="position-title">
                Position Properties
              </div>
              <div className="position-subtitle">
                Select a card and choose where it should live.
              </div>
            </div>
            <div className="position-body">
              <div className="position-section">
                <div className="position-section-title">Your properties</div>
                {myPropertySets.length === 0 ? (
                  <div className="position-empty">No properties in play yet.</div>
                ) : (
                  myPropertySets.map((set) => (
                    <div key={set.id} className="position-set">
                      <div className="position-set-title">
                        {formatColor(set.color)}
                        {set.isComplete ? " (Complete)" : ""}
                      </div>
                      <div className="position-set-row">
                        {set.properties.map((card, idx) => {
                          const selected =
                            positioningCard?.card.id === card.id &&
                            positioningCard?.fromSetId === set.id;
                          return (
                            <button
                              key={`position-card-${set.id}-${card.id}-${idx}`}
                              type="button"
                              className={`position-card ${selected ? "selected" : ""}`}
                              onClick={() => selectPositioningCard(card, set.id)}
                            >
                              <img src={assetForCard(card)} alt={card.type} draggable={false} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="position-section">
                <div className="position-section-title">Destination</div>
                {!positioningCard ? (
                  <div className="position-empty">Choose a card to see valid destinations.</div>
                ) : (
                  <>
                    <div className="position-selected">
                      Selected card #{positioningCard.card.id}
                    </div>
                    <div className="position-targets">
                      {positioningTargets.existing.map((set) => {
                        const selected = positionTarget?.toSetId === set.id;
                        return (
                          <button
                            key={`position-target-${set.id}`}
                            type="button"
                            className={`position-target ${selected ? "selected" : ""}`}
                            onClick={() => selectPositionTarget(set.id)}
                          >
                            {formatColor(set.color)} set
                          </button>
                        );
                      })}
                      {positioningTargets.existing.length === 0 && (
                        <div className="position-empty">
                          No compatible existing sets.
                        </div>
                      )}
                    </div>
                    <div className="position-section-title">Start new set</div>
                    <div className="position-targets">
                      {positioningTargets.newColors.map((color) => {
                        const selected =
                          positionTarget?.toSetId === NEW_PROPERTY_SET_ID &&
                          positionTarget?.toColor === color;
                        return (
                          <button
                            key={`position-new-${color}`}
                            type="button"
                            className={`position-target ${selected ? "selected" : ""}`}
                            onClick={() => selectPositionTarget(NEW_PROPERTY_SET_ID, color)}
                          >
                            New {formatColor(color)} set
                          </button>
                        );
                      })}
                      {positioningTargets.isRainbow && (
                        <div className="position-empty">
                          Ten-color wilds cannot start a new set.
                        </div>
                      )}
                      {!positioningTargets.isRainbow &&
                        positioningTargets.newColors.length === 0 && (
                          <div className="position-empty">No new set options.</div>
                        )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="position-actions">
              <button
                type="button"
                className="position-secondary"
                onClick={closePositioning}
              >
                Cancel
              </button>
              <button
                type="button"
                className="position-primary"
                onClick={confirmPositioning}
                disabled={!positioningCard || !positionTarget}
              >
                Position Card
              </button>
            </div>
          </div>
        </div>
      )}

      {isRenting && rentCard && (
        <div className="rent-overlay" role="dialog" aria-modal="true" aria-labelledby="rent-title">
          <div className="rent-modal">
            <div className="rent-header">
              <div>
                <div className="rent-title" id="rent-title">
                  Charge Rent
                </div>
                <div className="rent-subtitle">
                  Choose a rent color and target to charge.
                </div>
              </div>
              <div className="rent-card-preview">
                <img src={assetForCard(rentCard)} alt="Rent card" draggable={false} />
              </div>
            </div>
            <div className="rent-body">
              <div className="rent-section">
                <div className="rent-section-title">Rent color</div>
                {rentColorOptions.length === 0 ? (
                  <div className="rent-empty">
                    You have no properties that match this rent card.
                  </div>
                ) : rentColorOptions.length === 1 ? (
                  <div className="rent-auto">
                    Auto-selected: {formatColor(rentColorOptions[0].color)}
                  </div>
                ) : (
                  <div className="rent-options">
                    {rentColorOptions.map((option) => {
                      const selected = rentColor === option.color;
                      return (
                        <button
                          key={option.color}
                          type="button"
                          className={`rent-option ${selected ? "selected" : ""}`}
                          onClick={() => selectRentColor(option.color)}
                        >
                          {formatColor(option.color)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="rent-section">
                <div className="rent-section-title">Targets</div>
                <div className="rent-options">
                  <button
                    type="button"
                    className={`rent-option ${rentChargeAll ? "selected" : ""}`}
                    onClick={() => {
                      setRentChargeAll(true);
                      setRentTarget(null);
                    }}
                    disabled={!hasRentTargets}
                  >
                    All opponents
                  </button>
                  <button
                    type="button"
                    className={`rent-option ${!rentChargeAll ? "selected" : ""}`}
                    onClick={() => setRentChargeAll(false)}
                    disabled={!hasRentTargets}
                  >
                    Single opponent
                  </button>
                </div>
                {!rentChargeAll && (
                  <div className="rent-options">
                    {rentTargets.map((pid) => {
                      const selected = rentTarget === pid;
                      return (
                        <button
                          key={pid}
                          type="button"
                          className={`rent-option ${selected ? "selected" : ""}`}
                          onClick={() => setRentTarget(pid)}
                        >
                          {displayName(pid)}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!rentChargeAll && rentTargets.length === 0 && (
                  <div className="rent-empty">No opponents available.</div>
                )}
              </div>
            </div>
            <div className="rent-actions">
              <button type="button" className="rent-secondary" onClick={closeRentMenu}>
                Cancel
              </button>
              <button
                type="button"
                className="rent-primary"
                onClick={confirmRent}
                disabled={!canConfirmRent}
              >
                Charge Rent
              </button>
            </div>
          </div>
        </div>
      )}

      {rentCharge && (
        <div className="charge-overlay" role="dialog" aria-modal="true" aria-labelledby="charge-title">
          <div className="charge-modal">
            <div className="charge-header">
              <div>
                <div className="charge-title" id="charge-title">
                  Pay Rent
                </div>
                <div className="charge-subtitle">
                  {displayName(rentCharge.requesterId)} requests {rentAmountDue}M
                  {rentCharge.color ? ` for ${formatColor(rentCharge.color)} rent.` : " in rent."}
                </div>
              </div>
              <button
                type="button"
                className="charge-jsn"
                onClick={playJustSayNo}
                disabled={jsnCards.length === 0}
              >
                Just Say No ({jsnCards.length})
              </button>
            </div>
            <div className="charge-body">
              <div className="charge-section">
                <div className="charge-section-title">Bank (total {rentBankTotal}M)</div>
                {myBankCards.length === 0 ? (
                  <div className="charge-empty">No money in bank.</div>
                ) : (
                  <div className="charge-cards">
                    {myBankCards.map((card) => {
                      const selected = rentBankSelected.has(card.id);
                      return (
                        <button
                          key={`rent-bank-${card.id}`}
                          type="button"
                          className={`charge-card ${selected ? "selected" : ""}`}
                          onClick={() => toggleRentBankCard(card.id)}
                          disabled={Boolean(rentBankForced)}
                          aria-pressed={selected}
                        >
                          <img src={assetForCard(card)} alt="Bank card" draggable={false} />
                          <span className="charge-value">{getCardValue(card)}M</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="charge-section">
                <div className="charge-section-title">
                  Properties (total {rentPropertyTotal}M)
                </div>
                {myPropertyCards.length === 0 ? (
                  <div className="charge-empty">No properties to pay.</div>
                ) : (
                  <div className="charge-cards">
                    {myPropertyCards.map((card) => {
                      const selected = rentPropertySelected.has(card.id);
                      return (
                        <button
                          key={`rent-prop-${card.id}`}
                          type="button"
                          className={`charge-card ${selected ? "selected" : ""}`}
                          onClick={() => toggleRentPropertyCard(card.id)}
                          disabled={!rentPropertyAllowed}
                          aria-pressed={selected}
                        >
                          <img src={assetForCard(card)} alt="Property card" draggable={false} />
                          <span className="charge-value">{getCardValue(card)}M</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="charge-summary">
              <div>Selected: {rentSelectedTotal}M</div>
              <div>Remaining: {rentRemaining}M</div>
            </div>
            {rentBankForced && (
              <div className="charge-note">
                Bank money applies first and is selected automatically.
              </div>
            )}
            {rentPropertyForced && (
              <div className="charge-note">
                All cards are required to cover this rent.
              </div>
            )}
            <div className="charge-actions">
              <button
                type="button"
                className="charge-primary"
                onClick={submitRentPayment}
                disabled={!canPayRent}
              >
                Pay Rent
              </button>
            </div>
          </div>
        </div>
      )}

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
