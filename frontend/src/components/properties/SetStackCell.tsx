import type { CardVM, PropertySetVM } from "../../types/viewmodels";

export default function SetStackCell({
  set,
  onOpenSet,
  enableDnD,
}: {
  set: PropertySetVM;
  onOpenSet?: (key: string) => void;
  enableDnD?: boolean;
}) {
  void enableDnD; // reserved for DnD hook wiring
  return (
    <button
      type="button"
      className="set-cell"
      onClick={() => onOpenSet?.(set.key)}
      aria-label={`${set.displayName} set with ${set.cards.length} cards${set.isComplete ? ", complete" : ""}`}
    >
      <div className="set-stack">
        {set.cards.map((card: CardVM, idx: number) => {
          const isWild = Boolean(card.isWild);
          const assignedColor = card.assignedColor ? String(card.assignedColor) : "";
          const assignedInitial = assignedColor ? assignedColor.charAt(0) : "";
          return (
            <div
              key={card.id}
              className={`set-card ${isWild ? "is-wild" : ""}`}
              style={{
                top: "50%",
                left: "50%",
                transform: `translate(-50%, calc(-50% + (var(--stack-offset, 10px) * ${idx})))`,
                zIndex: 10 + idx,
              }}
            >
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.name} draggable={false} />
              ) : (
                <div className="set-card-placeholder" />
              )}
              {isWild && (
                <span
                  className="wild-badge"
                  title={`Wild${assignedColor ? `: ${assignedColor}` : ""}`}
                >
                  W
                  {assignedInitial && <span className="wild-initial">{assignedInitial}</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </button>
  );
}
