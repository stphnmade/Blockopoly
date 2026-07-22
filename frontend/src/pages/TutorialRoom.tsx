import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { TbChevronDown, TbChevronUp } from "react-icons/tb";
import Playmat3 from "../components/mats/Playmat3";
import { cardAssetMap } from "../utils/cardmapping";
import "../style/PlayScreen.css";
import "../style/TutorialRoom.css";

const cardBack = new URL("../assets/cards/card-back.svg", import.meta.url).href;
const blockopolyLogo = new URL("../assets/Blockopoly-logo.png", import.meta.url).href;

type TutorialZone = "bank" | "estate" | "completed-set" | "opponent-complete" | "opponent-property";
type BubbleAnchor = "hand" | "bank" | "estate" | "completed-set" | "topbar";

type TutorialCard = {
  id: string;
  cardId: number;
  name: string;
  type: "MONEY" | "PROPERTY" | "GENERAL_ACTION" | "RENT_ACTION";
  actionType?: string;
  validZones: TutorialZone[];
};

type TutorialStep = {
  id: string;
  title: string;
  cardId?: string;
  targetZone?: TutorialZone;
  bubbleAnchor: BubbleAnchor;
  instruction: string;
  success: string;
  note: string;
  kind?: "drag" | "button" | "win";
  turn: 1 | 2;
  playNumber?: 1 | 2 | 3;
};

type PlacedCard = TutorialCard & { zone: TutorialZone };
type ZoneRect = { left: number; top: number; width: number; height: number };

const tutorialCards: TutorialCard[] = [
  {
    id: "money-3",
    cardId: 99,
    name: "₿3 Money",
    type: "MONEY",
    validZones: ["bank"],
  },
  {
    id: "green-property",
    cardId: 50,
    name: "Green Property",
    type: "PROPERTY",
    validZones: ["estate"],
  },
  {
    id: "house",
    cardId: 18,
    name: "House",
    type: "GENERAL_ACTION",
    actionType: "HOUSE",
    validZones: ["completed-set"],
  },
  {
    id: "hotel",
    cardId: 21,
    name: "Hotel",
    type: "GENERAL_ACTION",
    actionType: "HOTEL",
    validZones: ["completed-set"],
  },
  {
    id: "rent",
    cardId: 35,
    name: "Rent",
    type: "RENT_ACTION",
    actionType: "RENT",
    validZones: ["completed-set"],
  },
  {
    id: "deal-breaker",
    cardId: 1,
    name: "Deal Breaker",
    type: "GENERAL_ACTION",
    actionType: "DEAL_BREAKER",
    validZones: ["opponent-complete"],
  },
  {
    id: "sly-deal",
    cardId: 6,
    name: "Sly Deal",
    type: "GENERAL_ACTION",
    actionType: "SLY_DEAL",
    validZones: ["opponent-property"],
  },
];

const tutorialSteps: TutorialStep[] = [
  {
    id: "bank-money",
    title: "Bank Money",
    cardId: "money-3",
    targetZone: "bank",
    bubbleAnchor: "bank",
    instruction: "Turn 1, play 1 of 3: drag the money card from your hand into your bank.",
    success: "Money banked. In a live game, the server confirms this before the board changes.",
    note: "Banking spends one of your three plays for the turn.",
    kind: "drag",
    turn: 1,
    playNumber: 1,
  },
  {
    id: "play-property",
    title: "Play A Property",
    cardId: "green-property",
    targetZone: "estate",
    bubbleAnchor: "estate",
    instruction: "Turn 1, play 2 of 3: drag Quarry St. onto the Green set. It has 2 of 3 cards, so this completes the set.",
    success: "Property placed. Properties build the sets needed to win.",
    note: "Playing a property spends one play. The Green set is now complete.",
    kind: "drag",
    turn: 1,
    playNumber: 2,
  },
  {
    id: "place-house",
    title: "Place A House",
    cardId: "house",
    targetZone: "completed-set",
    bubbleAnchor: "completed-set",
    instruction: "Turn 1, play 3 of 3: drag the House onto your completed Green set.",
    success: "House placed on the completed set.",
    note: "You have now spent all three plays, so the next lesson is ending your turn.",
    kind: "drag",
    turn: 1,
    playNumber: 3,
  },
  {
    id: "end-turn",
    title: "End Turn",
    bubbleAnchor: "topbar",
    instruction: "You used all 3 plays. End your turn so the next players can act.",
    success: "Turn ended. Taylor completed Yellow, while Jordan left a single Brown property exposed.",
    note: "Ending turn hands control to the next player. The tutorial fast-forwards opponents so Deal Breaker and Sly Deal teach different rules.",
    kind: "button",
    turn: 1,
  },
  {
    id: "place-hotel",
    title: "Place A Hotel",
    cardId: "hotel",
    targetZone: "completed-set",
    bubbleAnchor: "completed-set",
    instruction: "Turn 2, play 1 of 3: drag the Hotel onto your developed Green set.",
    success: "Hotel placed. This is the second development layer.",
    note: "Your turn starts fresh with 3 plays. Hotel is only valid because the complete set already has a House.",
    kind: "drag",
    turn: 2,
    playNumber: 1,
  },
  {
    id: "deal-breaker",
    title: "Deal Breaker",
    cardId: "deal-breaker",
    targetZone: "opponent-complete",
    bubbleAnchor: "completed-set",
    instruction: "Turn 2, play 2 of 3: drag Deal Breaker onto Taylor's completed Yellow set to take the full set.",
    success: "Deal Breaker took the completed Yellow set.",
    note: "Deal Breaker can only take a complete set, which makes 2/3 and 3/3 progress important.",
    kind: "drag",
    turn: 2,
    playNumber: 2,
  },
  {
    id: "sly-deal",
    title: "Sly Deal",
    cardId: "sly-deal",
    targetZone: "opponent-property",
    bubbleAnchor: "completed-set",
    instruction: "Turn 2, play 3 of 3: drag Sly Deal onto Jordan's single Brown property to steal the one card you need.",
    success: "Sly Deal stole one Brown property. Your Brown set is now complete.",
    note: "Sly Deal steals one eligible property, not a full set. That gives you three complete sets, which wins.",
    kind: "drag",
    turn: 2,
    playNumber: 3,
  },
  {
    id: "tutorial-win",
    title: "Tutorial Complete",
    bubbleAnchor: "topbar",
    instruction: "You completed three sets and learned the main action flow.",
    success: "Tutorial complete.",
    note: "Three complete sets wins Blockopoly.",
    kind: "win",
    turn: 2,
  },
];

const functionLessons = [
  ["Pass Go", "Draw two cards and keep building your turn."],
  ["Rent", "Choose a valid property set, then select who pays."],
  ["Double Rent", "Pair with rent before resolving the charge."],
  ["Birthday", "Every opponent pays a small amount."],
  ["Debt Collector", "Choose one opponent to pay a larger amount."],
  ["Just Say No", "Reaction card used when someone targets you."],
  ["Sly Deal", "Steal one eligible property."],
  ["Forced Deal", "Swap one of your properties with an opponent's."],
  ["Deal Breaker", "Take a complete set."],
  ["House / Hotel", "Develop eligible complete sets for stronger rent."],
  ["Wild Property", "Choose a color now, reposition later."],
];

const names = {
  tutorialYou: "You",
  tutorialTaylor: "Taylor",
  tutorialJordan: "Jordan",
};

const layout = {
  p1: "tutorialYou",
  p2: "tutorialTaylor",
  p3: "tutorialJordan",
};

const actionLog = [
  "Tutorial room started.",
  "Turn 1: You have three plays.",
];

const assetForCardId = (id: number) => cardAssetMap[id] ?? cardBack;

function TutorialCardImage({ card }: { card: TutorialCard }) {
  return <img src={assetForCardId(card.cardId)} alt={card.name} draggable={false} />;
}

function DraggableHandCard({
  card,
  disabled,
  onInspect,
}: {
  card: TutorialCard;
  disabled: boolean;
  onInspect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.id,
      data: { card },
      disabled,
    });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className={`hand-card tutorial-hand-card ${disabled ? "" : "clickable"} ${
        isDragging ? "dragging" : ""
      }`}
      style={style}
      title={card.name}
      onDoubleClick={onInspect}
      {...listeners}
      {...attributes}
    >
      <TutorialCardImage card={card} />
    </div>
  );
}

function TutorialDropOverlay({
  zone,
  activeCard,
  rect,
}: {
  zone: TutorialZone;
  activeCard: TutorialCard | null;
  rect?: ZoneRect;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: zone });
  const valid = Boolean(activeCard?.validZones.includes(zone));
  const style = rect
    ? ({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      } as CSSProperties)
    : undefined;
  return (
    <div
      ref={setNodeRef}
      className={`tutorial-live-drop-zone zone-${zone} ${valid ? "valid" : ""} ${
        valid && isOver ? "over" : ""
      }`}
      style={style}
      aria-label={`${zone} tutorial drop target`}
    >
      {valid && <span>{isOver ? "Release" : "Drop here"}</span>}
    </div>
  );
}

function TutorialHint({
  step,
  index,
  rect,
}: {
  step: TutorialStep;
  index: number;
  rect?: ZoneRect;
}) {
  const style = rect
    ? ({
        left: rect.left + Math.min(rect.width - 18, Math.max(8, rect.width / 2 - 9)),
        top: Math.max(8, rect.top - 26),
      } as CSSProperties)
    : undefined;

  return (
    <div className="tutorial-hint" style={style}>
      <button type="button" aria-label={`Step ${index + 1}: ${step.title}`}>
        ?
      </button>
      <div className="tutorial-hint-tip" role="tooltip">
        <div className="tutorial-callout-kicker">Step {index + 1}</div>
        <strong>{step.title}</strong>
        <p>{step.instruction}</p>
      </div>
    </div>
  );
}

export const TutorialRoom: React.FC = () => {
  const navigate = useNavigate();
  const playAreaRef = useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [stepIndex, setStepIndex] = useState(0);
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  const [zoneRects, setZoneRects] = useState<Partial<Record<TutorialZone, ZoneRect>>>({});
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set());
  const [activeCard, setActiveCard] = useState<TutorialCard | null>(null);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(true);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [inspectCard, setInspectCard] = useState<TutorialCard | null>(null);
  const [handExpanded, setHandExpanded] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [functionGuideOpen, setFunctionGuideOpen] = useState(false);
  const [message, setMessage] = useState("Use the real hand dock. Compatible board zones highlight while dragging.");
  const collisionDetection = useMemo<CollisionDetection>(
    () => (args) => {
      const dragging = tutorialCards.find((card) => card.id === args.active.id);
      const validZones = new Set<TutorialZone>(dragging?.validZones ?? []);
      return pointerWithin({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
          validZones.has(container.id as TutorialZone)
        ),
      });
    },
    []
  );

  const step = tutorialSteps[stepIndex];
  const completedCardIds = new Set(placedCards.map((card) => card.id));
  const scriptedCardIds = new Set(tutorialSteps.map((entry) => entry.cardId).filter(Boolean));
  const handCards = tutorialCards.filter(
    (card) => scriptedCardIds.has(card.id) && !completedCardIds.has(card.id)
  );
  const currentCard = step.cardId ? tutorialCards.find((card) => card.id === step.cardId) ?? null : null;
  const stepComplete = completedStepIds.has(step.id);
  const isLastStep = stepIndex === tutorialSteps.length - 1;
  const isAfterEndTurn = completedStepIds.has("end-turn");
  const hasDealBreaker = completedCardIds.has("deal-breaker");
  const hasSlyDeal = completedCardIds.has("sly-deal");
  const playsSpentThisTurn = tutorialSteps.filter(
    (entry) => entry.turn === step.turn && entry.kind === "drag" && completedStepIds.has(entry.id)
  ).length;
  const playsLeft = Math.max(0, 3 - playsSpentThisTurn);
  const activeTurnName = step.kind === "win" ? "Complete" : "You";
  const turnStatus =
    step.kind === "button"
      ? "0 plays left"
      : step.kind === "win"
        ? "Tutorial won"
        : `${playsLeft} plays left`;
  const nextPlayLabel =
    step.kind === "drag" && step.playNumber
      ? `Play ${step.playNumber} of 3`
      : step.kind === "button"
        ? "Pass control"
        : "Win condition";
  const hintRect =
    step.kind === "button"
      ? undefined
      : step.targetZone
        ? zoneRects[step.targetZone]
        : undefined;

  useLayoutEffect(() => {
    const root = playAreaRef.current;
    if (!root) return;

    let frame = 0;
    const readRect = (element: Element | null, padding: number): ZoneRect | undefined => {
      if (!element) return undefined;
      const rootRect = root.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return {
        left: Math.max(0, rect.left - rootRect.left - padding),
        top: Math.max(0, rect.top - rootRect.top - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      };
    };

    const measure = () => {
      const greenSet = Array.from(root.querySelectorAll("button[aria-label]")).find((element) =>
        element.getAttribute("aria-label")?.startsWith("Green set")
      );
      const yellowSet = Array.from(root.querySelectorAll("button[aria-label]")).find((element) =>
        element.getAttribute("aria-label")?.startsWith("Yellow set")
      );
      const jordanPropertyCollection = root.querySelector('[aria-label="Jordan property collection"]');
      const brownSet = Array.from(
        (jordanPropertyCollection ?? root).querySelectorAll("button[aria-label]")
      ).find((element) =>
        element.getAttribute("aria-label")?.startsWith("Brown set")
      );
      const playerBank = root.querySelector('[aria-label="You bank"]');
      const propertyCollection = root.querySelector('[aria-label="You property collection"]');
      const nextRects = {
        bank: readRect(playerBank, 12),
        estate: readRect(greenSet ?? propertyCollection, 14),
        "completed-set": readRect(greenSet ?? null, 14),
        "opponent-complete": readRect(yellowSet ?? null, 14),
        "opponent-property": readRect(brownSet ?? null, 14),
      };
      setZoneRects(nextRects);
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(root);
    window.addEventListener("resize", scheduleMeasure);
    const timeout = window.setTimeout(scheduleMeasure, 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [placedCards, stepIndex, handExpanded, introOpen, stepModalOpen, completedStepIds]);

  const playerCardMap = useMemo(() => {
    const bankCards = placedCards.filter((card) => card.zone === "bank");
    const estateCards = placedCards.filter((card) => card.zone === "estate");
    const developedCards = placedCards.filter((card) => card.zone === "completed-set");
    const hasHouse = developedCards.some((card) => card.actionType === "HOUSE");
    const hasHotel = developedCards.some((card) => card.actionType === "HOTEL");
    const userSets: Record<string, unknown> = {
      GREEN: {
        color: "GREEN",
        properties: [
          { id: 51, colors: ["GREEN"], value: 4 },
          { id: 52, colors: ["GREEN"], value: 4 },
          ...estateCards.map((card) => ({
            id: card.cardId,
            colors: ["GREEN"],
            value: 4,
          })),
        ],
        house: hasHouse ? { value: 3 } : null,
        hotel: hasHotel ? { value: 4 } : null,
      },
      BROWN: {
        color: "BROWN",
        properties: [
          { id: 53, colors: ["BROWN"], value: 1 },
          ...(hasSlyDeal ? [{ id: 54, colors: ["BROWN"], value: 1 }] : []),
        ],
      },
    };

    if (hasDealBreaker) {
      userSets.YELLOW = {
        color: "YELLOW",
        properties: [
          { id: 67, colors: ["YELLOW"], value: 3 },
          { id: 68, colors: ["YELLOW"], value: 3 },
          { id: 69, colors: ["YELLOW"], value: 3 },
        ],
      };
    }

    return {
      tutorialYou: {
        bank: {
          images: bankCards.map((card) => assetForCardId(card.cardId)),
          total: bankCards.reduce((sum, card) => sum + (card.cardId === 99 ? 3 : 0), 0),
          count: bankCards.length,
        },
        properties: userSets,
      },
      tutorialTaylor: {
        bank: { images: [assetForCardId(97)], total: 1, count: 1 },
        properties: hasDealBreaker
          ? {}
          : {
              YELLOW: {
                color: "YELLOW",
                properties: [
                  { id: 67, colors: ["YELLOW"], value: 3 },
                  { id: 68, colors: ["YELLOW"], value: 3 },
                  ...(isAfterEndTurn ? [{ id: 69, colors: ["YELLOW"], value: 3 }] : []),
                ],
              },
            },
      },
      tutorialJordan: {
        bank: { images: [assetForCardId(98)], total: 2, count: 1 },
        properties: hasSlyDeal
          ? {}
          : {
              BROWN: {
                color: "BROWN",
                properties: [{ id: 54, colors: ["BROWN"], value: 1 }],
              },
            },
      },
    };
  }, [placedCards, completedStepIds, isAfterEndTurn, hasDealBreaker, hasSlyDeal]);

  const handleDragStart = (event: DragStartEvent) => {
    const card = tutorialCards.find((entry) => entry.id === event.active.id);
    if (!card || card.id !== step.cardId || pendingCardId) return;
    setActiveCard(card);
    setMessage(`Dragging ${card.name}. Only valid targets highlight.`);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const card = activeCard;
    const zone = event.over?.id as TutorialZone | undefined;
    setActiveCard(null);
    if (!card || !zone) {
      setMessage("Drop canceled. Try the highlighted game area.");
      return;
    }
    if (card.id !== step.cardId || zone !== step.targetZone || !card.validZones.includes(zone)) {
      setMessage("That drop is not valid for this tutorial step.");
      return;
    }
    setPendingCardId(card.id);
    setMessage("Confirming with tutorial server...");
    window.setTimeout(() => {
      setPlacedCards((prev) => [...prev, { ...card, zone }]);
      setCompletedStepIds((prev) => new Set(prev).add(step.id));
      setPendingCardId(null);
      setMessage(step.success);
      setStepModalOpen(true);
    }, 320);
  };

  const completeButtonStep = () => {
    if (step.kind !== "button") return;
    setCompletedStepIds((prev) => new Set(prev).add(step.id));
    setMessage(step.success);
    setStepModalOpen(true);
  };

  const nextStep = () => {
    if (step.kind === "win") {
      setStepModalOpen(false);
      setMessage("Tutorial complete. Keep inspecting the real board layout or reset.");
      return;
    }
    const nextIndex = Math.min(tutorialSteps.length - 1, stepIndex + 1);
    setStepIndex(nextIndex);
    setStepModalOpen(false);
    if (tutorialSteps[nextIndex]?.kind === "win") {
      setCompletedStepIds((prev) => new Set(prev).add("tutorial-win"));
      setStepModalOpen(true);
      setMessage("Tutorial complete. You finished with three complete sets.");
    } else {
      setMessage("Use the real hand dock. Compatible board zones highlight while dragging.");
    }
  };

  const resetTutorial = () => {
    setStepIndex(0);
    setPlacedCards([]);
    setCompletedStepIds(new Set());
    setActiveCard(null);
    setPendingCardId(null);
    setIntroOpen(true);
    setStepModalOpen(false);
    setInspectCard(null);
    setMessage("Use the real hand dock. Compatible board zones highlight while dragging.");
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveCard(null);
        setMessage("Drop canceled. Try the highlighted game area.");
      }}
    >
      <div className="play-screen tutorial-clone-screen">
        <div className="play-topbar mode-active">
          <div className="topbar-brand">
            <img src={blockopolyLogo} alt="Blockopoly" className="topbar-logo" />
            <div className="topbar-room">
              <span className="topbar-label">Room</span>
              <b>TUTOR</b>
            </div>
          </div>

          <div className="topbar-main">
            <div className="topbar-active-turn">
              <div className="turn-summary">
                <span className="topbar-kicker">Turn {step.turn}: {activeTurnName}</span>
                <b>{step.title}</b>
                <small className="tutorial-turn-subtitle">{nextPlayLabel}</small>
              </div>
              <div className={`plays-badge ${playsLeft === 0 ? "empty" : ""}`}>
                <span>{playsLeft}</span>
                <small>{step.kind === "button" ? "end turn" : "plays left"}</small>
              </div>
              <button className="position-button" disabled>
                Position
              </button>
              <button
                type="button"
                className="topbar-primary"
                disabled={step.kind !== "button" || stepComplete}
                onClick={completeButtonStep}
              >
                End Turn
              </button>
            </div>
          </div>

          <div className="topbar-utility">
            <div className="topbar-stat">
              <span className="topbar-label">Draw</span>
              <b>24</b>
            </div>
            <button type="button" className="topbar-log-button" onClick={() => setLogOpen(true)}>
              Log
              <span className="activity-log-count">{actionLog.length + placedCards.length}</span>
            </button>
            <button
              type="button"
              className="topbar-log-button tutorial-guide-button"
              onClick={() => setFunctionGuideOpen(true)}
            >
              Cards
            </button>
            <div className="ws-dot on" title="Connected" />
          </div>
        </div>

        <div className="play-area tutorial-play-area" ref={playAreaRef}>
          <Playmat3
            layout={layout}
            myPID="tutorialYou"
            names={names}
            discardImages={[assetForCardId(24), assetForCardId(35)]}
            playerCardMap={playerCardMap}
            cardImageForId={assetForCardId}
          />

          <TutorialDropOverlay zone="bank" activeCard={activeCard} rect={zoneRects.bank} />
          <TutorialDropOverlay zone="estate" activeCard={activeCard} rect={zoneRects.estate} />
          <TutorialDropOverlay
            zone="completed-set"
            activeCard={activeCard}
            rect={zoneRects["completed-set"]}
          />
          <TutorialDropOverlay
            zone="opponent-complete"
            activeCard={activeCard}
            rect={zoneRects["opponent-complete"]}
          />
          <TutorialDropOverlay
            zone="opponent-property"
            activeCard={activeCard}
            rect={zoneRects["opponent-property"]}
          />

          <TutorialHint step={step} index={stepIndex} rect={hintRect} />

        </div>

        <div className="mat-hand-overlay tutorial-hand-overlay">
          <div className="mat-hand-row">
            <div className="mat-hand-side">
              <div className="hand-player-meta">
                <span className="hand-kicker">Your hand</span>
                <div className="hand-player-line">
                  <strong>Tutorial</strong>
                  <span className="hand-card-count" aria-label={`${handCards.length} cards`}>
                    {handCards.length}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="hand-collapse-btn"
                onClick={() => setHandExpanded((expanded) => !expanded)}
                aria-expanded={handExpanded}
                aria-label={handExpanded ? "Collapse tutorial hand" : "Show tutorial hand"}
              >
                {handExpanded ? <TbChevronDown aria-hidden /> : <TbChevronUp aria-hidden />}
                <span>{handExpanded ? "Collapse" : "Show cards"}</span>
              </button>
              <button
                type="button"
                className="end-turn-button"
                disabled={step.kind !== "button" || stepComplete}
                onClick={completeButtonStep}
              >
                End Turn
              </button>
            </div>
            <div className="mat-hand-cards">
              {handExpanded &&
                handCards.map((card) => (
                  <DraggableHandCard
                    key={card.id}
                    card={card}
                    disabled={card.id !== currentCard?.id || Boolean(pendingCardId) || step.kind !== "drag"}
                    onInspect={() => setInspectCard(card)}
                  />
                ))}
            </div>
          </div>
          <div className="tutorial-turn-tracker" aria-label={`Tutorial turn tracker: ${turnStatus}`}>
            <span>Turn {step.turn}</span>
            <b>{nextPlayLabel}</b>
            <span>{turnStatus}</span>
            <div className="tutorial-play-pips" aria-hidden="true">
              {[1, 2, 3].map((play) => (
                <span
                  key={play}
                  className={
                    play <= playsSpentThisTurn
                      ? "spent"
                      : step.playNumber === play
                        ? "current"
                        : ""
                  }
                />
              ))}
            </div>
          </div>
          <div className="tutorial-hand-message" aria-label={message} title={message}>
            ?
          </div>
        </div>

        {introOpen && (
          <div className="tutorial-modal-backdrop" role="dialog" aria-modal="true">
            <div className="tutorial-modal">
              <div className="tutorial-step-count">Advanced tutorial</div>
              <h1>Practice in the actual game layout</h1>
              <p>
                This room uses the same top bar, board, player spaces, property grid,
                bank, discard pile, and hand dock as live play. The only difference is
                that the cards are scripted so you can learn each function safely.
              </p>
              <button type="button" onClick={() => setIntroOpen(false)}>
                Start Tutorial
              </button>
              <button type="button" className="tutorial-modal-secondary" onClick={() => navigate("/")}>
                Back to Menu
              </button>
            </div>
          </div>
        )}

        {stepModalOpen && (
          <div className="tutorial-modal-backdrop" role="dialog" aria-modal="true">
            <div className="tutorial-modal">
              <div className="tutorial-step-count">Step {stepIndex + 1} complete</div>
              <h1>{step.kind === "win" ? "Tutorial Complete" : step.title}</h1>
              <p>{step.success}</p>
              <div className="tutorial-note">{step.note}</div>
              <div className="tutorial-actions">
                {step.kind === "win" ? (
                  <>
                    <button type="button" onClick={resetTutorial}>
                      Reset
                    </button>
                    <button type="button" onClick={() => navigate("/")}>
                      Home Menu
                    </button>
                    <button type="button" onClick={() => navigate("/main")}>
                      Start Game
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={resetTutorial}>
                      Reset
                    </button>
                    <button type="button" onClick={nextStep} disabled={!stepComplete}>
                      {isLastStep ? "Finished" : "Next Lesson"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {logOpen && (
          <div className="tutorial-modal-backdrop" role="dialog" aria-modal="true">
            <div className="tutorial-modal tutorial-list-modal">
              <div className="tutorial-step-count">Tutorial log</div>
              <h1>Recent Actions</h1>
              <div className="tutorial-modal-list">
                {actionLog.map((entry, idx) => (
                  <article key={entry}>
                    <strong>{idx + 1}</strong>
                    <span>{entry}</span>
                  </article>
                ))}
                {placedCards.map((card, idx) => (
                  <article key={card.id}>
                    <strong>{actionLog.length + idx + 1}</strong>
                    <span>Learned: {card.name}</span>
                  </article>
                ))}
              </div>
              <div className="tutorial-actions">
                <button type="button" onClick={() => setLogOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {functionGuideOpen && (
          <div className="tutorial-modal-backdrop" role="dialog" aria-modal="true">
            <div className="tutorial-modal tutorial-list-modal">
              <div className="tutorial-step-count">Advanced card functions</div>
              <h1>Card Guide</h1>
              <div className="tutorial-modal-list cards">
                {functionLessons.map(([title, copy]) => (
                  <article key={title}>
                    <strong>{title}</strong>
                    <span>{copy}</span>
                  </article>
                ))}
              </div>
              <div className="tutorial-actions">
                <button type="button" onClick={() => setFunctionGuideOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {inspectCard && (
          <div className="inspect-overlay" role="dialog" aria-modal="true">
            <div className="inspect-modal">
              <div className="inspect-header">
                <div className="inspect-title">{inspectCard.name}</div>
                <button
                  type="button"
                  className="inspect-close"
                  onClick={() => setInspectCard(null)}
                >
                  Close
                </button>
              </div>
              <div className="inspect-body">
                <img
                  src={assetForCardId(inspectCard.cardId)}
                  alt={inspectCard.name}
                  className="inspect-image"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="hand-card tutorial-hand-card overlay">
            <TutorialCardImage card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
