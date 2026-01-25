import { useEffect, useState } from "react";
import type { ServerCard } from "../types";

type Props = {
  isOpen: boolean;
  title: string;
  subtitle: string;
  jsnCount: number;
  targetLabel?: string;
  incomingLabel?: string;
  targetCard?: ServerCard | null;
  targetSetCards?: ServerCard[];
  incomingCard?: ServerCard | null;
  incomingSetCards?: ServerCard[];
  colorOptions?: string[];
  selectedColor?: string | null;
  formatColor: (value?: string | null) => string;
  assetForCard: (card: ServerCard) => string;
  onSelectColor: (color: string) => void;
  onPlayJsn: () => void;
  onAccept: () => void;
  canAccept: boolean;
};

export default function DealResponseModal({
  isOpen,
  title,
  subtitle,
  jsnCount,
  targetLabel = "Card you lose",
  incomingLabel = "Card you receive",
  targetCard,
  targetSetCards,
  incomingCard,
  incomingSetCards,
  colorOptions = [],
  selectedColor,
  formatColor,
  assetForCard,
  onSelectColor,
  onPlayJsn,
  onAccept,
  canAccept,
}: Props) {
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <button
        type="button"
        className="modal-minimized-banner"
        onClick={() => setIsMinimized(false)}
      >
        <span className="modal-minimized-dot" />
        <span className="modal-minimized-label">{title}</span>
      </button>
    );
  }

  return (
    <div className="rent-overlay" role="dialog" aria-modal="true" aria-labelledby="deal-response-title">
      <div className="rent-modal">
        <div className="rent-header">
          <div>
            <div className="rent-title" id="deal-response-title">
              {title}
            </div>
            <div className="rent-subtitle">{subtitle}</div>
          </div>
          <div>
            <button
              type="button"
              className="charge-jsn"
              onClick={onPlayJsn}
              disabled={jsnCount === 0}
            >
              Just Say No ({jsnCount})
            </button>
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
            <div className="rent-section-title">{targetLabel}</div>
            {targetCard ? (
              <div className="charge-cards">
                <div className="charge-card selected">
                  <img src={assetForCard(targetCard)} alt="Target card" draggable={false} />
                </div>
              </div>
            ) : targetSetCards && targetSetCards.length > 0 ? (
              <div className="charge-cards">
                {targetSetCards.map((card) => (
                  <div key={`target-set-${card.id}`} className="charge-card selected">
                    <img src={assetForCard(card)} alt="Target card" draggable={false} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rent-empty">No specific card selected.</div>
            )}
          </div>
          <div className="rent-section">
            <div className="rent-section-title">{incomingLabel}</div>
            {incomingCard ? (
              <div className="charge-cards">
                <div className="charge-card selected">
                  <img src={assetForCard(incomingCard)} alt="Incoming card" draggable={false} />
                </div>
              </div>
            ) : incomingSetCards && incomingSetCards.length > 0 ? (
              <div className="charge-cards">
                {incomingSetCards.map((card) => (
                  <div key={`incoming-${card.id}`} className="charge-card selected">
                    <img src={assetForCard(card)} alt="Incoming card" draggable={false} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rent-empty">No card received.</div>
            )}
          </div>
          <div className="rent-section">
            <div className="rent-section-title">Receive as</div>
            {colorOptions.length === 0 ? (
              <div className="rent-empty">No color choice needed.</div>
            ) : (
              <div className="rent-options">
                {colorOptions.map((color) => {
                  const selected = selectedColor === color;
                  return (
                    <button
                      key={`deal-receive-${color}`}
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
          <button
            type="button"
            className="rent-primary"
            onClick={onAccept}
            disabled={!canAccept}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
