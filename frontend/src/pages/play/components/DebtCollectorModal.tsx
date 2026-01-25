import { useEffect, useState } from "react";
import type { ServerCard } from "../types";

type Props = {
  isOpen: boolean;
  debtCard: ServerCard | null;
  debtTargets: string[];
  debtTarget: string | null;
  hasDebtTargets: boolean;
  displayName: (pid?: string | null) => string;
  assetForCard: (card: ServerCard) => string;
  amount: number;
  onSelectTarget: (pid: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
};

export default function DebtCollectorModal({
  isOpen,
  debtCard,
  debtTargets,
  debtTarget,
  hasDebtTargets,
  displayName,
  assetForCard,
  amount,
  onSelectTarget,
  onClose,
  onConfirm,
  canConfirm,
}: Props) {
  if (!isOpen || !debtCard) return null;

  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  if (isMinimized) {
    return (
      <button
        type="button"
        className="modal-minimized-banner"
        onClick={() => setIsMinimized(false)}
      >
        <span className="modal-minimized-dot" />
        <span className="modal-minimized-label">Debt Collector</span>
      </button>
    );
  }

  return (
    <div className="rent-overlay" role="dialog" aria-modal="true" aria-labelledby="debt-title">
      <div className="rent-modal">
        <div className="rent-header">
          <div>
            <div className="rent-title" id="debt-title">
              Debt Collector
            </div>
            <div className="rent-subtitle">Choose a target to collect {amount}M.</div>
          </div>
          <div>
            <div className="rent-card-preview">
              <img src={assetForCard(debtCard)} alt="Debt collector card" draggable={false} />
            </div>
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
            <div className="rent-section-title">Target</div>
            {hasDebtTargets ? (
              <div className="rent-options">
                {debtTargets.map((pid) => {
                  const selected = debtTarget === pid;
                  return (
                    <button
                      key={`debt-${pid}`}
                      type="button"
                      className={`rent-option ${selected ? "selected" : ""}`}
                      onClick={() => onSelectTarget(pid)}
                    >
                      {displayName(pid)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rent-empty">No opponents available.</div>
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
            Collect {amount}M
          </button>
        </div>
      </div>
    </div>
  );
}
