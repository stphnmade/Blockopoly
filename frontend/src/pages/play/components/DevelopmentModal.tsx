import type { PropertySetView, ServerCard } from "../types";

type Props = {
  isOpen: boolean;
  developmentCard: ServerCard | null;
  developmentLabel: string;
  eligibleSets: PropertySetView[];
  selectedSetId: string | null;
  formatColor: (value?: string | null) => string;
  assetForCard: (card: ServerCard) => string;
  onSelectSet: (setId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
};

export default function DevelopmentModal({
  isOpen,
  developmentCard,
  developmentLabel,
  eligibleSets,
  selectedSetId,
  formatColor,
  assetForCard,
  onSelectSet,
  onClose,
  onConfirm,
  canConfirm,
}: Props) {
  if (!isOpen || !developmentCard) return null;

  return (
    <div className="rent-overlay" role="dialog" aria-modal="true" aria-labelledby="dev-title">
      <div className="rent-modal">
        <div className="rent-header">
          <div>
            <div className="rent-title" id="dev-title">
              {developmentLabel}
            </div>
            <div className="rent-subtitle">Select a completed set to upgrade.</div>
          </div>
          <div className="rent-card-preview">
            <img src={assetForCard(developmentCard)} alt={`${developmentLabel} card`} draggable={false} />
          </div>
        </div>
        <div className="rent-body">
          <div className="rent-section">
            <div className="rent-section-title">Eligible sets</div>
            {eligibleSets.length === 0 ? (
              <div className="rent-empty">No eligible completed sets.</div>
            ) : (
              <div className="rent-options">
                {eligibleSets.map((set) => {
                  const selected = selectedSetId === set.id;
                  return (
                    <button
                      key={`dev-${set.id}`}
                      type="button"
                      className={`rent-option ${selected ? "selected" : ""}`}
                      onClick={() => onSelectSet(set.id)}
                    >
                      {formatColor(set.color)} set
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
                {eligibleSets
                  .find((set) => set.id === selectedSetId)
                  ?.properties.map((card) => (
                    <div key={`dev-card-${card.id}`} className="charge-card selected">
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
            Place {developmentLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
