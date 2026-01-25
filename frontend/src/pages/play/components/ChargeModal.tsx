import { useEffect, useState } from "react";
import type { ServerCard } from "../types";

type Props = {
  isOpen: boolean;
  title: string;
  subtitle: string;
  payLabel: string;
  mustPayAllLabel: string;
  jsnCount: number;
  onPlayJsn: () => void;
  myBankCards: ServerCard[];
  chargePropertyCards: ServerCard[];
  rentBankTotal: number;
  rentPropertyTotal: number;
  rentSelectedTotal: number;
  rentRemaining: number;
  rentBankSelected: Set<number>;
  rentPropertySelected: Set<number>;
  rentMustPayAll: boolean;
  hasNonPayableWilds: boolean;
  canPayRent: boolean;
  assetForCard: (card: ServerCard) => string;
  getCardValue: (card: ServerCard) => number;
  onToggleBankCard: (cardId: number) => void;
  onTogglePropertyCard: (cardId: number) => void;
  onSubmit: () => void;
};

export default function ChargeModal({
  isOpen,
  title,
  subtitle,
  payLabel,
  mustPayAllLabel,
  jsnCount,
  onPlayJsn,
  myBankCards,
  chargePropertyCards,
  rentBankTotal,
  rentPropertyTotal,
  rentSelectedTotal,
  rentRemaining,
  rentBankSelected,
  rentPropertySelected,
  rentMustPayAll,
  hasNonPayableWilds,
  canPayRent,
  assetForCard,
  getCardValue,
  onToggleBankCard,
  onTogglePropertyCard,
  onSubmit,
}: Props) {
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <button
        type="button"
        className="modal-minimized-banner"
        onClick={() => setIsMinimized(false)}
      >
        <span className="modal-minimized-dot" />
        <span className="modal-minimized-label">{title}</span>
      </button>
    );
  }

  return (
    <div className="charge-overlay" role="dialog" aria-modal="true" aria-labelledby="charge-title">
      <div className="charge-modal">
        <div className="charge-header">
          <div>
            <div className="charge-title" id="charge-title">
              {title}
            </div>
            <div className="charge-subtitle">{subtitle}</div>
          </div>
          <div>
            <button
              type="button"
              className="charge-jsn"
              onClick={onPlayJsn}
              disabled={jsnCount === 0}
            >
              Just Say No ({jsnCount})
            </button>
            <button
              type="button"
              className="modal-minimize"
              onClick={() => setIsMinimized(true)}
            >
              Minimize
            </button>
          </div>
        </div>
        <div className="charge-body">
          <div className="charge-section">
            <div className="charge-section-title">Bank (total {rentBankTotal}M)</div>
            {myBankCards.length === 0 ? (
              <div className="charge-empty">No money in bank.</div>
            ) : (
              <div className="charge-cards">
                {myBankCards.map((card) => {
                  const selected = rentBankSelected.has(card.id);
                  return (
                    <button
                      key={`rent-bank-${card.id}`}
                      type="button"
                      className={`charge-card ${selected ? "selected" : ""}`}
                      onClick={() => onToggleBankCard(card.id)}
                      disabled={rentMustPayAll}
                      aria-pressed={selected}
                    >
                      <img src={assetForCard(card)} alt="Bank card" draggable={false} />
                      <span className="charge-value">{getCardValue(card)}M</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="charge-section">
            <div className="charge-section-title">
              Properties (total {rentPropertyTotal}M)
            </div>
            {chargePropertyCards.length === 0 ? (
              <div className="charge-empty">
                {hasNonPayableWilds
                  ? "Ten-color wilds cannot be used to pay."
                  : "No properties to pay."}
              </div>
            ) : (
              <div className="charge-cards">
                {chargePropertyCards.map((card) => {
                  const selected = rentPropertySelected.has(card.id);
                  return (
                    <button
                      key={`rent-prop-${card.id}`}
                      type="button"
                      className={`charge-card ${selected ? "selected" : ""}`}
                      onClick={() => onTogglePropertyCard(card.id)}
                      disabled={rentMustPayAll}
                      aria-pressed={selected}
                    >
                      <img src={assetForCard(card)} alt="Property card" draggable={false} />
                      <span className="charge-value">{getCardValue(card)}M</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="charge-summary">
          <div>Selected: {rentSelectedTotal}M</div>
          <div>Remaining: {rentRemaining}M</div>
        </div>
        {rentMustPayAll && <div className="charge-note">{mustPayAllLabel}</div>}
        <div className="charge-actions">
          <button
            type="button"
            className="charge-primary"
            onClick={onSubmit}
            disabled={!canPayRent}
          >
            {payLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
