import type { RentColorOption, ServerCard } from "../types";

type Props = {
  isOpen: boolean;
  rentCard: ServerCard | null;
  rentColorOptions: RentColorOption[];
  rentColor: string | null;
  rentChargeAllEffective: boolean;
  rentRequiresAll: boolean;
  hasRentTargets: boolean;
  rentTargets: string[];
  rentTarget: string | null;
  rentDoublers: number[];
  rentMultiplier: number;
  canAddFirstDouble: boolean;
  canAddSecondDouble: boolean;
  canConfirmRent: boolean;
  assetForCard: (card: ServerCard) => string;
  formatColor: (value?: string | null) => string;
  displayName: (pid?: string | null) => string;
  onSelectColor: (color: string) => void;
  onSelectAllTargets: () => void;
  onSelectSingleTargets: () => void;
  onSelectTarget: (pid: string) => void;
  onAddFirstDouble: () => void;
  onAddSecondDouble: () => void;
  onRemoveSecondDouble: () => void;
  onClearDouble: () => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function RentModal({
  isOpen,
  rentCard,
  rentColorOptions,
  rentColor,
  rentChargeAllEffective,
  rentRequiresAll,
  hasRentTargets,
  rentTargets,
  rentTarget,
  rentDoublers,
  rentMultiplier,
  canAddFirstDouble,
  canAddSecondDouble,
  canConfirmRent,
  assetForCard,
  formatColor,
  displayName,
  onSelectColor,
  onSelectAllTargets,
  onSelectSingleTargets,
  onSelectTarget,
  onAddFirstDouble,
  onAddSecondDouble,
  onRemoveSecondDouble,
  onClearDouble,
  onClose,
  onConfirm,
}: Props) {
  if (!isOpen || !rentCard) return null;

  return (
    <div className="rent-overlay" role="dialog" aria-modal="true" aria-labelledby="rent-title">
      <div className="rent-modal">
        <div className="rent-header">
          <div>
            <div className="rent-title" id="rent-title">
              Charge Rent
            </div>
            <div className="rent-subtitle">Choose a rent color and target to charge.</div>
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
                      onClick={() => onSelectColor(option.color)}
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
                className={`rent-option ${rentChargeAllEffective ? "selected" : ""}`}
                onClick={onSelectAllTargets}
                disabled={!hasRentTargets}
              >
                All opponents
              </button>
              <button
                type="button"
                className={`rent-option ${!rentChargeAllEffective ? "selected" : ""}`}
                onClick={onSelectSingleTargets}
                disabled={!hasRentTargets || rentRequiresAll}
              >
                Single opponent
              </button>
            </div>
            {!rentChargeAllEffective && !rentRequiresAll && (
              <div className="rent-options">
                {rentTargets.map((pid) => {
                  const selected = rentTarget === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      className={`rent-option ${selected ? "selected" : ""}`}
                      onClick={() => onSelectTarget(pid)}
                    >
                      {displayName(pid)}
                    </button>
                  );
                })}
              </div>
            )}
            {!rentChargeAllEffective && rentTargets.length === 0 && (
              <div className="rent-empty">No opponents available.</div>
            )}
          </div>
          <div className="rent-section">
            <div className="rent-section-title">Double The Rent</div>
            {!canAddFirstDouble && (
              <div className="rent-empty">Need a Double Rent card and a play remaining.</div>
            )}
            {canAddFirstDouble && rentDoublers.length === 0 && (
              <button type="button" className="rent-option" onClick={onAddFirstDouble}>
                Apply x2
              </button>
            )}
            {rentDoublers.length === 1 && (
              <div className="rent-double-row">
                <span className="rent-double-tag">Multiplier x{rentMultiplier}</span>
                <button type="button" className="rent-option" onClick={onClearDouble}>
                  Remove
                </button>
              </div>
            )}
            {rentDoublers.length === 1 && canAddSecondDouble && (
              <div className="rent-double-prompt">
                <span>Do you want to x4 this rent?</span>
                <button type="button" className="rent-option" onClick={onAddSecondDouble}>
                  Add second Double
                </button>
              </div>
            )}
            {rentDoublers.length === 2 && (
              <div className="rent-double-row">
                <span className="rent-double-tag">Multiplier x4</span>
                <button type="button" className="rent-option" onClick={onRemoveSecondDouble}>
                  Remove second Double
                </button>
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
            disabled={!canConfirmRent}
          >
            Charge Rent
          </button>
        </div>
      </div>
    </div>
  );
}
