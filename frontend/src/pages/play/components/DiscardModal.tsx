import type { ServerCard } from "../types";

type Props = {
  isOpen: boolean;
  maxHandSize: number;
  discardNeeded: number;
  myHand: ServerCard[];
  discardSelection: number[];
  canConfirmDiscard: boolean;
  assetForCard: (card: ServerCard) => string;
  onToggleSelection: (cardId: number) => void;
  onAutoSelect: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DiscardModal({
  isOpen,
  maxHandSize,
  discardNeeded,
  myHand,
  discardSelection,
  canConfirmDiscard,
  assetForCard,
  onToggleSelection,
  onAutoSelect,
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="discard-overlay" role="dialog" aria-modal="true" aria-labelledby="discard-title">
      <div className="discard-modal">
        <div className="discard-header">
          <div className="discard-title" id="discard-title">
            Discard to {maxHandSize}
          </div>
          <div className="discard-subtitle">
            Select {discardNeeded} card{discardNeeded === 1 ? "" : "s"} to discard.
          </div>
        </div>
        <div className="discard-grid">
          {myHand.map((card, idx) => {
            const selected = discardSelection.includes(card.id);
            const selectionFull = discardSelection.length >= discardNeeded;
            const isNonDiscardable = card.type === "PROPERTY" || card.type === "MONEY";
            const disabled = isNonDiscardable || (!selected && selectionFull);
            return (
              <button
                key={`discard-${card.id}-${idx}`}
                type="button"
                className={`discard-card ${selected ? "selected" : ""}`}
                onClick={() => onToggleSelection(card.id)}
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
            onClick={onAutoSelect}
            disabled={discardNeeded <= 0}
          >
            Auto-select {discardNeeded}
          </button>
          <button
            type="button"
            className="discard-primary"
            onClick={onConfirm}
            disabled={!canConfirmDiscard}
          >
            Discard & End Turn
          </button>
          <button type="button" className="discard-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
