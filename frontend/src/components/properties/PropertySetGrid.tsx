import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { PropertySetVM } from "../../types/viewmodels";
import SetStackCell from "./SetStackCell";
import "./property-grid.css";

type Props = {
  sets: PropertySetVM[];
  onOpenSet?: (setKey: string) => void;
  enableDnD?: boolean;
  orientation?: "top" | "bottom" | "left" | "right" | "me" | "opponent";
};

const SLOT_COUNT = 10;

export default function PropertySetGrid({
  sets,
  onOpenSet,
  enableDnD,
  orientation = "bottom",
}: Props) {
  const orientationClass =
    orientation === "me" ? "bottom" : orientation === "opponent" ? "top" : orientation;
  const slots: Array<PropertySetVM | null> = [...sets];
  while (slots.length < SLOT_COUNT) slots.push(null);

  const [probeSetKey, setProbeSetKey] = useState<string | null>(null);
  const activeSet = useMemo(
    () => sets.find((s) => s.key === probeSetKey) ?? null,
    [sets, probeSetKey]
  );

  const handleOpenSet = (setKey: string) => {
    setProbeSetKey(setKey);
    onOpenSet?.(setKey);
  };

  return (
    <>
      <div
        className={`prop-grid ${orientationClass}`}
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
              style={
                set.colorToken
                  ? ({ ["--set-color" as string]: set.colorToken } as CSSProperties)
                  : undefined
              }
            >
              {(set.hasHouse || set.hasHotel) && (
                <div className="prop-dev-badges" aria-hidden>
                  {set.hasHouse && (
                    <span className="prop-dev-icon house active" title="House" />
                  )}
                  {set.hasHotel && (
                    <span className="prop-dev-icon hotel active" title="Hotel" />
                  )}
                </div>
              )}
              <div className="prop-slot-stack">
                <SetStackCell set={set} onOpenSet={handleOpenSet} enableDnD={enableDnD} />
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

      {activeSet && (
        <div
          className="prop-probe-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prop-probe-title"
          onClick={() => setProbeSetKey(null)}
        >
          <div
            className="prop-probe-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="prop-probe-header">
              <div className="prop-probe-title" id="prop-probe-title">
                {activeSet.displayName}
              </div>
              <button
                type="button"
                className="prop-probe-close"
                onClick={() => setProbeSetKey(null)}
              >
                Close
              </button>
            </div>
            <div className="prop-probe-body">
              {activeSet.cards.length === 0 ? (
                <div className="prop-probe-empty">No cards in this set.</div>
              ) : (
                <div className="prop-probe-grid">
                  {activeSet.cards.map((card) => (
                    <div key={card.id} className="prop-probe-card">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          draggable={false}
                        />
                      ) : (
                        <div className="prop-probe-placeholder" />
                      )}
                      {card.isWild && (
                        <span className="prop-probe-wild-badge">
                          Wild
                          {card.assignedColor
                            ? ` • ${String(card.assignedColor)}`
                            : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
