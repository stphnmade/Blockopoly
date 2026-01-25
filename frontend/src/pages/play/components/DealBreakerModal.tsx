import { useEffect, useState } from "react";
import type { PropertySetView, ServerCard } from "../types";

export type DealBreakerTarget = {
  ownerId: string;
  set: PropertySetView;
};

type Props = {
  isOpen: boolean;
  dealBreakerCard: ServerCard | null;
  targets: DealBreakerTarget[];
  selectedSetId: string | null;
  displayName: (pid?: string | null) => string;
  formatColor: (value?: string | null) => string;
  assetForCard: (card: ServerCard) => string;
  onSelectSet: (setId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
};

export default function DealBreakerModal({
  isOpen,
  dealBreakerCard,
  targets,
  selectedSetId,
  displayName,
  formatColor,
  assetForCard,
  onSelectSet,
  onClose,
  onConfirm,
  canConfirm,
}: Props) {
  if (!isOpen || !dealBreakerCard) return null;

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
        <span className="modal-minimized-label">Deal Breaker</span>
      </button>
    );
  }

  return (
    <div className="rent-overlay" role="dialog" aria-modal="true" aria-labelledby="dealbreaker-title">
      <div className="rent-modal">
        <div className="rent-header">
          <div>
            <div className="rent-title" id="dealbreaker-title">
              Deal Breaker
            </div>
            <div className="rent-subtitle">Steal a completed set from an opponent.</div>
          </div>
          <div>
            <div className="rent-card-preview">
              <img
                src={assetForCard(dealBreakerCard)}
                alt="Deal Breaker card"
                draggable={false}
              />
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
            <div className="rent-section-title">Target set</div>
            {targets.length === 0 ? (
              <div className="rent-empty">No completed sets available.</div>
            ) : (
              <div className="rent-options">
                {targets.map((target) => {
                  const setColor = formatColor(target.set.color);
                  const selected = selectedSetId === target.set.id;
                  return (
                    <button
                      key={`dealbreaker-${target.set.id}`}
                      type="button"
                      className={`rent-option ${selected ? "selected" : ""}`}
                      onClick={() => onSelectSet(target.set.id)}
                    >
                      {displayName(target.ownerId)} - {setColor} set
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rent-section">
            <div className="rent-section-title">Set preview</div>
            {selectedSetId ? (
              <div className="charge-cards">
                {targets
                  .find((entry) => entry.set.id === selectedSetId)
                  ?.set.properties.map((card) => (
                    <div key={`dealbreaker-card-${card.id}`} className="charge-card selected">
                      <img src={assetForCard(card)} alt="Property card" draggable={false} />
                    </div>
                  ))}
              </div>
            ) : (
              <div className="rent-empty">Select a set to preview.</div>
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
            Play Deal Breaker
          </button>
        </div>
      </div>
    </div>
  );
}
