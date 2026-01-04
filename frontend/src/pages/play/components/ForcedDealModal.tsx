import type { DealTargetEntry, ServerCard } from "../types";

type Props = {
  isOpen: boolean;
  forcedCard: ServerCard | null;
  giveOptions: DealTargetEntry[];
  targetOptions: DealTargetEntry[];
  selectedGiveCardId: number | null;
  selectedTargetCardId: number | null;
  needsColorChoice: boolean;
  availableColors: string[];
  selectedColor: string | null;
  displayName: (pid?: string | null) => string;
  formatColor: (value?: string | null) => string;
  assetForCard: (card: ServerCard) => string;
  onSelectGive: (cardId: number) => void;
  onSelectTarget: (cardId: number) => void;
  onSelectColor: (color: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
};

export default function ForcedDealModal({
  isOpen,
  forcedCard,
  giveOptions,
  targetOptions,
  selectedGiveCardId,
  selectedTargetCardId,
  needsColorChoice,
  availableColors,
  selectedColor,
  displayName,
  formatColor,
  assetForCard,
  onSelectGive,
  onSelectTarget,
  onSelectColor,
  onClose,
  onConfirm,
  canConfirm,
}: Props) {
  if (!isOpen || !forcedCard) return null;

  return (
    <div className="rent-overlay" role="dialog" aria-modal="true" aria-labelledby="forced-title">
      <div className="rent-modal">
        <div className="rent-header">
          <div>
            <div className="rent-title" id="forced-title">
              Forced Deal
            </div>
            <div className="rent-subtitle">
              Swap one of your incomplete properties with an opponent.
            </div>
          </div>
          <div className="rent-card-preview">
            <img src={assetForCard(forcedCard)} alt="Forced Deal card" draggable={false} />
          </div>
        </div>
        <div className="rent-body">
          <div className="rent-section">
            <div className="rent-section-title">Give a property</div>
            {giveOptions.length === 0 ? (
              <div className="rent-empty">No eligible properties to give.</div>
            ) : (
              <div className="charge-cards">
                {giveOptions.map((entry) => {
                  const selected = selectedGiveCardId === entry.card.id;
                  return (
                    <button
                      key={`forced-give-${entry.card.id}`}
                      type="button"
                      className={`charge-card ${selected ? "selected" : ""}`}
                      onClick={() => onSelectGive(entry.card.id)}
                    >
                      <img src={assetForCard(entry.card)} alt="Property card" draggable={false} />
                      <span className="charge-value">You</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rent-section">
            <div className="rent-section-title">Take a property</div>
            {targetOptions.length === 0 ? (
              <div className="rent-empty">No eligible opponent properties.</div>
            ) : (
              <div className="charge-cards">
                {targetOptions.map((entry) => {
                  const selected = selectedTargetCardId === entry.card.id;
                  return (
                    <button
                      key={`forced-target-${entry.card.id}`}
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
                      key={`forced-color-${color}`}
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
            Play Forced Deal
          </button>
        </div>
      </div>
    </div>
  );
}
