import React, { useMemo, useState } from "react";
import PropertySetGrid from "../properties/PropertySetGrid";
import { buildPlayerPropertyGridVM } from "../../lib/adapters/buildPlayerPropertyGridVM";
import "./mat_styles/PlaymatTable.css";

type BankCard = { id: number; value?: number };

type TablePlayerView = {
  id: string;
  name: string;
  isMe: boolean;
  bankCards: BankCard[];
  propertyCollection?: unknown;
};

type Props = {
  players: TablePlayerView[];
  myPID: string;
  discardImages?: string[];
  assetForCard: (card: { id: number }) => string;
};

type PlayerVM = TablePlayerView & {
  bankTotal: number;
  bankCount: number;
  propertyVM: ReturnType<typeof buildPlayerPropertyGridVM>;
};

type SeatAssignments = {
  bottom: PlayerVM[];
  top: PlayerVM[];
  left: PlayerVM[];
  right: PlayerVM[];
};

const PRIMARY_SLOTS: Array<keyof SeatAssignments> = ["top", "left", "right"];

export default function PlaymatTable({
  players,
  myPID,
  discardImages = [],
  assetForCard,
}: Props) {
  const playerVMs = useMemo<PlayerVM[]>(() => {
    return players.map((player) => {
      const bankTotal = player.bankCards.reduce(
        (sum, card) => sum + (typeof card.value === "number" ? card.value : 0),
        0
      );
      const propertyVM = buildPlayerPropertyGridVM(player.propertyCollection, (id) =>
        assetForCard({ id })
      );
      return {
        ...player,
        bankTotal,
        bankCount: player.bankCards.length,
        propertyVM,
      };
    });
  }, [assetForCard, players]);

  const seats = useMemo<SeatAssignments>(() => {
    const base: SeatAssignments = { bottom: [], top: [], left: [], right: [] };
    if (playerVMs.length === 0) return base;
    base.bottom = [playerVMs[0]];
    let idx = 1;
    PRIMARY_SLOTS.forEach((slot) => {
      if (idx < playerVMs.length) {
        base[slot].push(playerVMs[idx]);
        idx += 1;
      }
    });
    while (idx < playerVMs.length) {
      base.top.push(playerVMs[idx]);
      idx += 1;
    }
    return base;
  }, [playerVMs]);

  const me = useMemo(() => playerVMs.find((player) => player.isMe), [playerVMs]);
  const [openBank, setOpenBank] = useState(false);

  const lastThree = discardImages.slice(-3);
  const [d1, d2, d3] = [
    lastThree[0] ?? null,
    lastThree[1] ?? null,
    lastThree[2] ?? null,
  ];

  const renderPlayerPanel = (player: PlayerVM, compact = false) => {
    const bankDepth = Math.min(6, Math.max(1, Math.ceil(player.bankTotal / 4)));
    return (
      <section
        key={player.id}
        className={`player-panel ${player.isMe ? "me" : "opponent"} ${
          compact ? "compact" : ""
        }`}
        data-player={player.id}
      >
        <header className="player-header">
          <div className="player-name">
            {player.name}
            {player.isMe && <span className="player-tag">You</span>}
          </div>
          <button
            type="button"
            className="bank-summary"
            onClick={() => player.isMe && setOpenBank(true)}
            disabled={!player.isMe}
            style={{ ["--stack-depth" as string]: bankDepth }}
            aria-label={`${player.name} bank, ₿${player.bankTotal} in ${player.bankCount} cards`}
          >
            <span className="bank-stack" aria-hidden />
            <span className="bank-stats">
              <span className="bank-total">₿{player.bankTotal}</span>
              <span className="bank-count">{player.bankCount} cards</span>
            </span>
          </button>
        </header>
        <div className="player-properties">
          <PropertySetGrid
            sets={player.propertyVM.sets}
            enableDnD={player.isMe}
            orientation={player.isMe ? "me" : "opponent"}
          />
        </div>
      </section>
    );
  };

  return (
    <div className="playmat-table" data-my-pid={myPID}>
      <div className="table-surface">
        <div className="table-center" aria-label="Discard pile">
          <div className="discard-fan">
            {d1 && <img className="fan-card fan-1" src={d1} alt="" aria-hidden />}
            {d2 && <img className="fan-card fan-2" src={d2} alt="" aria-hidden />}
            {d3 && <img className="fan-card fan-3" src={d3} alt="Most recent discard" />}
          </div>
        </div>

        <div className="table-seat top">
          {seats.top.length > 0 && (
            <div className={`seat-stack ${seats.top.length > 1 ? "stacked" : ""}`}>
              {seats.top.map((player) =>
                renderPlayerPanel(player, seats.top.length > 1)
              )}
            </div>
          )}
        </div>

        <div className="table-seat left">
          {seats.left.map((player) => renderPlayerPanel(player))}
        </div>

        <div className="table-seat right">
          {seats.right.map((player) => renderPlayerPanel(player))}
        </div>

        <div className="table-seat bottom">
          {seats.bottom.map((player) => renderPlayerPanel(player))}
        </div>
      </div>

      {openBank && me && (
        <div className="bank-overlay" role="dialog" aria-modal="true">
          <div className="bank-modal">
            <div className="bank-modal-header">
              <div>
                <div className="bank-modal-title">Your Bank</div>
                <div className="bank-modal-subtitle">
                  Total ₿{me.bankTotal} in {me.bankCount} cards.
                </div>
              </div>
              <button type="button" className="bank-close" onClick={() => setOpenBank(false)}>
                Close
              </button>
            </div>
            <div className="bank-card-grid">
              {me.bankCards.length === 0 ? (
                <div className="bank-empty">No money cards in bank.</div>
              ) : (
                me.bankCards.map((card, idx) => (
                  <div key={`${card.id}-${idx}`} className="bank-card">
                    <img src={assetForCard({ id: card.id })} alt="Money card" draggable={false} />
                    <span className="bank-card-value">₿{card.value ?? 0}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
