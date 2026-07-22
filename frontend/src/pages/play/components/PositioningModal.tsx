import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { TbArrowsMoveHorizontal, TbCheck, TbX } from "react-icons/tb";
import type {
  PositioningCard,
  PositioningTarget,
  PositioningTargets,
  PropertySetView,
  ServerCard,
} from "../types";

type Props = {
  isOpen: boolean;
  myPropertySets: PropertySetView[];
  positioningCard: PositioningCard | null;
  positioningTargets: PositioningTargets;
  positionTarget: PositioningTarget;
  newSetId: string;
  formatColor: (value?: string | null) => string;
  assetForCard: (card: ServerCard) => string;
  onSelectCard: (card: ServerCard, fromSetId: string) => void;
  onSelectTarget: (toSetId: string, toColor?: string | null) => void;
  onMove: (
    card: ServerCard,
    fromSetId: string,
    toSetId: string,
    toColor?: string | null
  ) => boolean;
  onClose: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
};

type DropTargetData = {
  toSetId: string;
  toColor?: string | null;
  label: string;
};

type DropGhost = {
  id: number;
  image: string;
  left: number;
  top: number;
  width: number;
  height: number;
  deltaX: number;
  deltaY: number;
};

function PositionCardButton({
  card,
  setId,
  selected,
  sourceSelected,
  assetForCard,
  onSelect,
}: {
  card: ServerCard;
  setId: string;
  selected: boolean;
  sourceSelected: boolean;
  assetForCard: (card: ServerCard) => string;
  onSelect: (card: ServerCard, setId: string) => void;
}) {
  const { attributes, listeners, isDragging, setNodeRef } = useDraggable({
    id: `position-card:${setId}:${card.id}`,
    data: { card, fromSetId: setId },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`position-card ${selected ? "selected" : ""} ${
        sourceSelected ? "source-active" : ""
      } ${isDragging ? "dragging" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(card, setId);
      }}
      {...attributes}
      {...listeners}
      aria-pressed={selected}
      aria-label={`Select property card ${card.id} from this collection`}
    >
      <img src={assetForCard(card)} alt="Property card" draggable={false} />
    </button>
  );
}

function CollectionLane({
  set,
  selectedSource,
  positioningCard,
  validTarget,
  selectedTarget,
  formatColor,
  assetForCard,
  onSelectSource,
  onSelectCard,
  onSelectTarget,
}: {
  set: PropertySetView;
  selectedSource: boolean;
  positioningCard: PositioningCard | null;
  validTarget: boolean;
  selectedTarget: boolean;
  formatColor: (value?: string | null) => string;
  assetForCard: (card: ServerCard) => string;
  onSelectSource: (setId: string) => void;
  onSelectCard: (card: ServerCard, setId: string) => void;
  onSelectTarget: (setId: string) => void;
}) {
  const label = `${formatColor(set.color)} collection`;
  const { isOver, setNodeRef } = useDroppable({
    id: `position-set:${set.id}`,
    data: { toSetId: set.id, label } satisfies DropTargetData,
    disabled: !validTarget,
  });
  const handleLaneClick = () => {
    if (positioningCard && validTarget) onSelectTarget(set.id);
    else if (!positioningCard) onSelectSource(set.id);
  };
  return (
    <section
      ref={setNodeRef}
      className={`position-set ${selectedSource ? "source-selected" : ""} ${
        validTarget ? "valid-target" : ""
      } ${selectedTarget ? "target-selected" : ""} ${isOver ? "is-over" : ""}`}
      aria-label={label}
    >
      <div className="position-set-heading">
        <button
          type="button"
          className="position-set-select"
          onClick={handleLaneClick}
          aria-pressed={selectedSource || selectedTarget}
          disabled={Boolean(positioningCard) && !validTarget}
        >
          <span className="position-color-dot" aria-hidden />
          <span>
            <strong>{formatColor(set.color)}</strong>
            <small>
              {set.properties.length} {set.properties.length === 1 ? "card" : "cards"}
              {set.isComplete ? " (complete)" : ""}
            </small>
          </span>
        </button>
        {validTarget && <span className="position-drop-label">Drop here</span>}
      </div>
      <div className="position-set-row">
        {set.properties.map((card, index) => (
          <PositionCardButton
            key={`position-card-${set.id}-${card.id}-${index}`}
            card={card}
            setId={set.id}
            selected={
              positioningCard?.card.id === card.id && positioningCard.fromSetId === set.id
            }
            sourceSelected={selectedSource}
            assetForCard={assetForCard}
            onSelect={onSelectCard}
          />
        ))}
      </div>
    </section>
  );
}

function NewCollectionLane({
  color,
  newSetId,
  selected,
  formatColor,
  onSelect,
}: {
  color: string;
  newSetId: string;
  selected: boolean;
  formatColor: (value?: string | null) => string;
  onSelect: (toSetId: string, color: string) => void;
}) {
  const label = `New ${formatColor(color)} collection`;
  const { isOver, setNodeRef } = useDroppable({
    id: `position-new:${color}`,
    data: { toSetId: newSetId, toColor: color, label } satisfies DropTargetData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`position-new-set ${selected ? "target-selected" : ""} ${
        isOver ? "is-over" : ""
      }`}
      onClick={() => onSelect(newSetId, color)}
      aria-pressed={selected}
    >
      <span className="position-new-plus" aria-hidden>+</span>
      <strong>New {formatColor(color)}</strong>
      <small>Start a collection</small>
    </button>
  );
}

export default function PositioningModal({
  isOpen,
  myPropertySets,
  positioningCard,
  positioningTargets,
  positionTarget,
  newSetId,
  formatColor,
  assetForCard,
  onSelectCard,
  onSelectTarget,
  onMove,
  onClose,
  onConfirm,
  canConfirm,
}: Props) {
  const [selectedSourceSetId, setSelectedSourceSetId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<PositioningCard | null>(null);
  const [dropGhost, setDropGhost] = useState<DropGhost | null>(null);
  const [announcement, setAnnouncement] = useState(
    "Choose a collection, then select or drag one of its cards."
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const validTargetIds = useMemo(
    () => new Set(positioningTargets.existing.map((set) => set.id)),
    [positioningTargets.existing]
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedSourceSetId(null);
      setActiveDrag(null);
      setDropGhost(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (positioningCard) setSelectedSourceSetId(positioningCard.fromSetId);
  }, [positioningCard]);

  const selectCard = useCallback(
    (card: ServerCard, fromSetId: string) => {
      setSelectedSourceSetId(fromSetId);
      onSelectCard(card, fromSetId);
      setAnnouncement(`Card selected. Choose a highlighted destination for card ${card.id}.`);
    },
    [onSelectCard]
  );

  const selectTarget = useCallback(
    (toSetId: string, toColor?: string | null) => {
      onSelectTarget(toSetId, toColor);
      const label =
        toSetId === newSetId
          ? `new ${formatColor(toColor)} collection`
          : `${formatColor(myPropertySets.find((set) => set.id === toSetId)?.color)} collection`;
      setAnnouncement(`${label} selected. Activate Move card to finish.`);
    },
    [formatColor, myPropertySets, newSetId, onSelectTarget]
  );

  const startDrag = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as
        | { card?: ServerCard; fromSetId?: string }
        | undefined;
      if (!data?.card || !data.fromSetId) return;
      const next = { card: data.card, fromSetId: data.fromSetId };
      setActiveDrag(next);
      selectCard(data.card, data.fromSetId);
      setAnnouncement(`Moving card ${data.card.id}. Drop it on a highlighted collection.`);
    },
    [selectCard]
  );

  const endDrag = useCallback(
    (event: DragEndEvent) => {
      const source = event.active.data.current as
        | { card?: ServerCard; fromSetId?: string }
        | undefined;
      const target = event.over?.data.current as DropTargetData | undefined;
      setActiveDrag(null);
      if (!source?.card || !source.fromSetId || !target) {
        setAnnouncement("Move cancelled. Choose a highlighted destination.");
        return;
      }

      const translated = event.active.rect.current.translated;
      const destination = event.over?.rect;
      if (translated && destination) {
        setDropGhost({
          id: Date.now(),
          image: assetForCard(source.card),
          left: translated.left,
          top: translated.top,
          width: translated.width,
          height: translated.height,
          deltaX: destination.left + destination.width / 2 - translated.width / 2 - translated.left,
          deltaY: destination.top + destination.height / 2 - translated.height / 2 - translated.top,
        });
        window.setTimeout(() => setDropGhost(null), 380);
      }

      const moved = onMove(
        source.card,
        source.fromSetId,
        target.toSetId,
        target.toColor
      );
      setAnnouncement(
        moved
          ? `Card ${source.card.id} moved to ${target.label}.`
          : "The move could not be sent. Try again."
      );
    },
    [assetForCard, onMove]
  );

  if (!isOpen) return null;

  return (
    <div className="position-overlay" role="dialog" aria-modal="true" aria-labelledby="position-title">
      <div className="position-modal">
        <div className="position-header">
          <div>
            <div className="position-title" id="position-title">
              Position Properties
            </div>
            <div className="position-subtitle">
              Choose a collection, then move a card to any highlighted destination.
            </div>
          </div>
          <button type="button" className="position-close" onClick={onClose} aria-label="Close positioning">
            <TbX aria-hidden />
          </button>
        </div>

        <div className="position-instruction" aria-hidden>
          <span><b>1</b> Choose collection</span>
          <span><b>2</b> Select or drag card</span>
          <span><b>3</b> Choose destination</span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={startDrag}
          onDragCancel={() => setActiveDrag(null)}
          onDragEnd={endDrag}
        >
          <div className="position-board" aria-label="Property collections">
            {myPropertySets.length === 0 ? (
              <div className="position-empty">No properties in play yet.</div>
            ) : (
              myPropertySets.map((set) => (
                <CollectionLane
                  key={set.id}
                  set={set}
                  selectedSource={selectedSourceSetId === set.id}
                  positioningCard={positioningCard}
                  validTarget={validTargetIds.has(set.id)}
                  selectedTarget={positionTarget?.toSetId === set.id}
                  formatColor={formatColor}
                  assetForCard={assetForCard}
                  onSelectSource={setSelectedSourceSetId}
                  onSelectCard={selectCard}
                  onSelectTarget={(setId) => selectTarget(setId)}
                />
              ))
            )}

            {positioningCard &&
              positioningTargets.newColors.map((color) => (
                <NewCollectionLane
                  key={`position-new-${color}`}
                  color={color}
                  newSetId={newSetId}
                  selected={
                    positionTarget?.toSetId === newSetId && positionTarget.toColor === color
                  }
                  formatColor={formatColor}
                  onSelect={selectTarget}
                />
              ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDrag ? (
              <div className="position-drag-preview">
                <img src={assetForCard(activeDrag.card)} alt="" />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {positioningCard &&
          positioningTargets.existing.length === 0 &&
          positioningTargets.newColors.length === 0 && (
            <div className="position-no-targets">
              This card has no available destination.
            </div>
          )}

        <div className="position-status" role="status" aria-live="polite">
          <TbArrowsMoveHorizontal aria-hidden />
          <span>{announcement}</span>
        </div>

        <div className="position-actions">
          <button type="button" className="position-secondary" onClick={onClose}>
            Done
          </button>
          <button
            type="button"
            className="position-primary"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            <TbCheck aria-hidden />
            Move card
          </button>
        </div>
      </div>

      {dropGhost && (
        <img
          key={dropGhost.id}
          className="position-drop-ghost"
          src={dropGhost.image}
          alt=""
          style={
            {
              left: dropGhost.left,
              top: dropGhost.top,
              width: dropGhost.width,
              height: dropGhost.height,
              "--position-drop-x": `${dropGhost.deltaX}px`,
              "--position-drop-y": `${dropGhost.deltaY}px`,
            } as CSSProperties
          }
        />
      )}
    </div>
  );
}
