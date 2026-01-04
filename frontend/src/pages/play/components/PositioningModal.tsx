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
  onClose: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
};

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
  onClose,
  onConfirm,
  canConfirm,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="position-overlay" role="dialog" aria-modal="true" aria-labelledby="position-title">
      <div className="position-modal">
        <div className="position-header">
          <div className="position-title" id="position-title">
            Position Properties
          </div>
          <div className="position-subtitle">
            Select a card and choose where it should live.
          </div>
          <div className="position-note">
            Ten-color wilds can be repositioned only during your turn (optional).
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
                          onClick={() => onSelectCard(card, set.id)}
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
                        onClick={() => onSelectTarget(set.id)}
                      >
                        {formatColor(set.color)} set
                      </button>
                    );
                  })}
                  {positioningTargets.existing.length === 0 && (
                    <div className="position-empty">No compatible existing sets.</div>
                  )}
                </div>
                <div className="position-section-title">Start new set</div>
                <div className="position-targets">
                  {positioningTargets.newColors.map((color) => {
                    const selected =
                      positionTarget?.toSetId === newSetId &&
                      positionTarget?.toColor === color;
                    return (
                      <button
                        key={`position-new-${color}`}
                        type="button"
                        className={`position-target ${selected ? "selected" : ""}`}
                        onClick={() => onSelectTarget(newSetId, color)}
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
          <button type="button" className="position-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="position-primary"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            Position Card
          </button>
        </div>
      </div>
    </div>
  );
}
