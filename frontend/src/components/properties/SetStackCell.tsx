import type { PropertySetVM, CardVM } from "../../types/viewmodels";

export default function SetStackCell({ set, onOpenSet, enableDnD }: {
  set: PropertySetVM;
  onOpenSet?: (key: string) => void;
  enableDnD?: boolean;
}) {
  void enableDnD; // currently unused but reserved for DnD hook wiring
  const overlap = 12; // px
  return (
    <button
      type="button"
      className="set-cell"
      onClick={() => onOpenSet?.(set.key)}
      aria-label={`${set.displayName} set with ${set.cards.length} cards${set.isComplete ? ", complete" : ""}`}
    >
      {/* <div className="set-badge">{set.cards.length}{set.isComplete ? " ✓" : ""}</div> */}
      <div className="set-stack" style={{ position: "relative" }}>
  {set.cards.map((card: CardVM, idx: number) => (
          <div
            key={card.id}
            className="set-card"
            style={{
              top: idx * overlap,
              left: idx === set.cards.length - 1 ? 0 : 2,
              zIndex: idx === set.cards.length - 1 ? 20 : 10 + idx,
            }}
          >
            <img src={card.imageUrl ?? ""} alt={card.name} draggable={false} />
          </div>
        ))}
      </div>
    </button>
  );
}
