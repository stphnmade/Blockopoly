import type { CSSProperties } from "react";
import type { PropertySetVM } from "../../types/viewmodels";
import SetStackCell from "./SetStackCell";
import "./property-grid.css";

type Props = {
  sets: PropertySetVM[];
  onOpenSet?: (setKey: string) => void;
  enableDnD?: boolean;
  orientation?: "me" | "opponent";
};

const SLOT_COUNT = 10;

export default function PropertySetGrid({
  sets,
  onOpenSet,
  enableDnD,
  orientation = "me",
}: Props) {
  const slots: Array<PropertySetVM | null> = [...sets];
  while (slots.length < SLOT_COUNT) slots.push(null);

  return (
    <div
      className={`prop-grid ${orientation === "me" ? "me" : "opponent"}`}
      role="list"
      aria-label="Property Sets"
    >
      {slots.slice(0, SLOT_COUNT).map((set, idx) => {
        if (!set) {
          return (
            <div
              key={`slot-${idx}`}
              role="listitem"
              className="prop-slot empty"
              aria-label={`Empty property slot ${idx + 1}`}
            />
          );
        }
        const required = set.requiredCount ?? 0;
        const current = set.currentCount ?? set.cards.length;
        const progressLabel = required > 0 ? `${current}/${required}` : `${current}/?`;
        return (
          <div
            key={set.key}
            role="listitem"
            className={`prop-slot ${set.isComplete ? "complete" : ""}`}
            style={set.colorToken ? ({ ["--set-color" as string]: set.colorToken } as CSSProperties) : undefined}
          >
            <div className="prop-slot-stack">
              <SetStackCell set={set} onOpenSet={onOpenSet} enableDnD={enableDnD} />
            </div>
            <div className="prop-slot-info" role="note">
              <span className="prop-info-progress">{progressLabel}</span>
              <span className="prop-info-rent">Rent {set.rentValue ?? 0}M</span>
              {set.overage && set.overage > 0 && (
                <span className="progress-overage">+{set.overage}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
