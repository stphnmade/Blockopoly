import { useEffect, useState } from "react";
import type { DealTargetEntry, ServerCard } from "../types";

type Props = {
  isOpen: boolean;
  slyCard: ServerCard | null;
  targets: DealTargetEntry[];
  selectedCardId: number | null;
  needsColorChoice: boolean;
  availableColors: string[];
  selectedColor: string | null;
  displayName: (pid?: string | null) => string;
  formatColor: (value?: string | null) => string;
  assetForCard: (card: ServerCard) => string;
  onSelectTarget: (cardId: number) => void;
  onSelectColor: (color: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
};

export default function SlyDealModal({
  isOpen,
  slyCard,
  targets,
  selectedCardId,
  needsColorChoice,
  availableColors,
  selectedColor,
  displayName,
  formatColor,
  assetForCard,
  onSelectTarget,
  onSelectColor,
  onClose,
  onConfirm,
  canConfirm,
}: Props) {
  if (!isOpen || !slyCard) return null;

  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  if (isMinimized) {
    return (
      <button
        type="button"
        className="modal-minimized-banner"
        onClick={() => setIsMinimized(false)}
      >
        <span className="modal-minimized-dot" />
        <span className="modal-minimized-label">Sly Deal</span>
      </button>
    );
  }

  return (
    <div className="rent-overlay" role="dialog" aria-modal="true" aria-labelledby="sly-title">
      <div className="rent-modal">
        <div className="rent-header">
          <div>
            <div className="rent-title" id="sly-title">
              Sly Deal
            </div>
            <div className="rent-subtitle">
              Choose a single property from an opponent (incomplete sets only).
            </div>
          </div>
          <div>
            <div className="rent-card-preview">
              <img src={assetForCard(slyCard)} alt="Sly Deal card" draggable={false} />
            </div>
            <button
              type="button"
              className="modal-minimize"
              onClick={() => setIsMinimized(true)}
            >
              Minimize
            </button>
          </div>
        </div>
        <div className="rent-body">
          <div className="rent-section">
            <div className="rent-section-title">Target property</div>
            {targets.length === 0 ? (
              <div className="rent-empty">No eligible properties to steal.</div>
            ) : (
              <div className="charge-cards">
                {targets.map((entry) => {
                  const selected = selectedCardId === entry.card.id;
                  return (
                    <button
                      key={`sly-${entry.card.id}`}
                      type="button"
                      className={`charge-card ${selected ? "selected" : ""}`}
                      onClick={() => onSelectTarget(entry.card.id)}
                    >
                      <img src={assetForCard(entry.card)} alt="Property card" draggable={false} />
                      <span className="charge-value">{displayName(entry.ownerId)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rent-section">
            <div className="rent-section-title">Receive as</div>
            {!needsColorChoice && <div className="rent-empty">No color choice needed.</div>}
            {needsColorChoice && (
              <div className="rent-options">
                {availableColors.map((color) => {
                  const selected = selectedColor === color;
                  return (
                    <button
                      key={`sly-color-${color}`}
                      type="button"
                      className={`rent-option ${selected ? "selected" : ""}`}
                      onClick={() => onSelectColor(color)}
                    >
                      {formatColor(color)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="rent-actions">
          <button type="button" className="rent-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rent-primary"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            Play Sly Deal
          </button>
        </div>
      </div>
    </div>
  );
}
