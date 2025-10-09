import type { PropertySetVM } from "../../types/viewmodels";
import SetStackCell from "./SetStackCell";
import "./property-grid.css";

type Props = {
  sets: PropertySetVM[];
  onOpenSet?: (setKey: string) => void;
  enableDnD?: boolean;
  orientation?: "me" | "opponent";
};

export default function PropertySetGrid({ sets, onOpenSet, enableDnD, orientation = "me" }: Props) {
  return (
    <div className={`prop-grid ${orientation === "me" ? "me" : "opponent"}`} role="grid" aria-label="Property Sets Grid">
      {Array.from({ length: 10 }).map((_, i) => {
        const set = sets[i];
        return (
          <div key={i} role="gridcell" className="prop-grid-cell">
            {set ? (
              <SetStackCell set={set} onOpenSet={onOpenSet} enableDnD={enableDnD} />
            ) : (
              <div className="prop-empty" />
            )}
          </div>
        );
      })}
    </div>
  );
}
