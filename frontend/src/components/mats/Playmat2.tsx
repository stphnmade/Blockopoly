// Playmat2.tsx
/* src/components/mats/Playmat2.tsx */
//  has the 2-player layout and logic for tracking last played card in discard
import React, { useState } from "react";
// createPortal removed - overlay now handles hand
import { DroppableBind } from "../DropZones";
import { useDroppable } from "@dnd-kit/core";

/* ------- images ------- */
import backdrop from "@/assets/Backdrop.svg";

import "@/components/mats/mat_styles/playmat_shared.css";
import "./mat_styles/Playmat2.css";
import PropertySetGrid from "../properties/PropertySetGrid";
import { buildPlayerPropertyGridVM } from "../../lib/adapters/buildPlayerPropertyGridVM";

// import { PLAYER_ID_KEY } from "../../constants/constants";

/** Keep this in sync with PlayScreen's type */
export type PlaymatProps = {
  layout: Partial<Record<"p1" | "p2" | "p3" | "p4" | "p5", string>>; // seat -> playerId
  myPID: string;
  names: Record<string, string>;
  discardImages?: string[]; // newest last
  playerCardMap?: Record<
    string,
    { bank: { images: string[]; total: number; count: number }; properties: unknown }
  >;
  cardImageForId?: (id: number) => string;
};

type PlayerKey = "p1" | "p2";

const Playmat2: React.FC<PlaymatProps> = ({
  layout,
  myPID,
  names,
  discardImages = [],
  playerCardMap,
  cardImageForId,
}) => {
  // hand modal removed; overlay shows the hand
  // pull the true pids from layout
  const pidMap: Record<PlayerKey, string> = {
    p1: layout.p1 ?? "",
    p2: layout.p2 ?? "",
  };

  const [bankOpen, setBankOpen] = useState(false);
  const myBank = playerCardMap?.[myPID]?.bank;
  const myBankImages = myBank?.images ?? [];
  const myBankTotal = myBank?.total ?? 0;
  const myBankCount = myBank?.count ?? 0;
  const p1Bank = playerCardMap?.[pidMap.p1]?.bank;
  const p2Bank = playerCardMap?.[pidMap.p2]?.bank;
  const p1Props = playerCardMap?.[pidMap.p1]?.properties ?? {};
  const p2Props = playerCardMap?.[pidMap.p2]?.properties ?? {};
  const canOpenP1Bank = pidMap.p1 === myPID;
  const canOpenP2Bank = pidMap.p2 === myPID;

  const openMyBank = () => {
    if (!myPID || !myBank) return;
    setBankOpen(true);
  };

  const handleBankKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    canOpen: boolean
  ) => {
    if (!canOpen) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMyBank();
    }
  };

  // ---- dnd-kit droppable zones (per seat) ---------------------------
  const { setNodeRef: setP1BankRef, isOver: p1BankOver } = useDroppable({
    id: `bank:pid:${pidMap.p1}`,
  });
  const { setNodeRef: setP1PropsRef, isOver: p1PropsOver } = useDroppable({
    id: `collect:pid:${pidMap.p1}`,
  });

  const { setNodeRef: setP2BankRef, isOver: p2BankOver } = useDroppable({
    id: `bank:pid:${pidMap.p2}`,
  });
  const { setNodeRef: setP2PropsRef, isOver: p2PropsOver } = useDroppable({
    id: `collect:pid:${pidMap.p2}`,
  });

  const { setNodeRef: setDiscardRef, isOver: discardOver } = useDroppable({
    id: "discard",
  });

  // compute three visible discard images: 1 = oldest, 3 = newest
  const lastThree = discardImages.slice(-3);
  const [d1, d2, d3] = [
    lastThree[0] ?? null, // oldest of visible
    lastThree[1] ?? null,
    lastThree[2] ?? null, // newest
  ];

  const nameFor = (pid?: string) => (pid && names[pid]) || "Opponent";

  return (
  <div className="playing-mat-outline-2-players" data-my-pid={myPID}>
      {/* board backdrop */}
      <img className="backdrop" src={backdrop} alt="2-player backdrop" />

      <div className="mat-stage">
        {/* -------- Player 1 area -------------------------------------- */}
        <div className="player-1-space player-space">
          <div className="player-name-tag" aria-hidden>
            {nameFor(pidMap.p1)}
          </div>
          <div
            className={`property-collection-zone droppable ${
              p1PropsOver ? "is-over" : ""
            }`}
            ref={setP1PropsRef}
            aria-label={`${nameFor(pidMap.p1)} property collection`}
          >
            <div className="property-collection" id="p1-properties">
              <DroppableBind zoneId="p1-properties" />
              <PropertySetGrid
                sets={buildPlayerPropertyGridVM(p1Props, cardImageForId).sets}
                enableDnD={true}
                onOpenSet={() => {}}
              />
            </div>
          </div>

          <div className="money-collection-bank">
            <div
              className={`bank-pile droppable ${p1BankOver ? "is-over" : ""}`}
              id="p1-bank"
              ref={setP1BankRef}
              aria-label={`${nameFor(pidMap.p1)} bank`}
              role={canOpenP1Bank ? "button" : undefined}
              tabIndex={canOpenP1Bank ? 0 : -1}
              onClick={canOpenP1Bank ? openMyBank : undefined}
              onKeyDown={(event) => handleBankKeyDown(event, canOpenP1Bank)}
            >
              <DroppableBind zoneId="p1-bank" />
              <div className="bank-summary" aria-hidden>
                <div className="bank-total">₿{p1Bank?.total ?? 0}</div>
                <div className="bank-count">{p1Bank?.count ?? 0} cards</div>
              </div>
            </div>
            {/* hand button removed - overlay shows cards */}
          </div>
        </div>

        {/* -------- Player 2 area -------------------------------------- */}
        <div className="player-2-space player-space">
          <div className="player-name-tag" aria-hidden>
            {nameFor(pidMap.p2)}
          </div>
            <div
              className={`player-2-property-collection-zone droppable ${
              p2PropsOver ? "is-over" : ""
            }`}
            ref={setP2PropsRef}
            aria-label={`${nameFor(pidMap.p2)} property collection`}
          >
            <div className="property-collection2" id="p2-properties">
              <DroppableBind zoneId="p2-properties" />
              <PropertySetGrid
                sets={buildPlayerPropertyGridVM(p2Props, cardImageForId).sets}
                enableDnD={false}
                onOpenSet={() => {}}
                orientation="opponent"
              />
            </div>
          </div>

          <div className="player-2-money-collection-bank">
            <div
              className={`bank-pile2 droppable ${p2BankOver ? "is-over" : ""}`}
              id="p2-bank"
              ref={setP2BankRef}
              aria-label={`${nameFor(pidMap.p2)} bank`}
              role={canOpenP2Bank ? "button" : undefined}
              tabIndex={canOpenP2Bank ? 0 : -1}
              onClick={canOpenP2Bank ? openMyBank : undefined}
              onKeyDown={(event) => handleBankKeyDown(event, canOpenP2Bank)}
            >
              <DroppableBind zoneId="p2-bank" />
              <div className="bank-summary" aria-hidden>
                <div className="bank-total">₿{p2Bank?.total ?? 0}</div>
                <div className="bank-count">{p2Bank?.count ?? 0} cards</div>
              </div>
            </div>
            {/* hand button removed - overlay shows cards */}
          </div>
        </div>

        {/* -------------------- Draw / discard piles ------------------- */}
        <div className="center-pile">
          <div
            className={`discard-pile droppable ${discardOver ? "is-over" : ""}`}
            ref={setDiscardRef}
            aria-label="discard pile"
          >
            {/* dynamic discard thumbnails; newest on top/right */}
            {d1 && <img className="card-1" src={d1} alt="" aria-hidden />}
            {d2 && <img className="card-2" src={d2} alt="" aria-hidden />}
            {d3 && <img className="card-3" src={d3} alt="Most recent discard" />}
          </div>
        </div>
      </div>

      {bankOpen && (
        <div className="bank-overlay" role="dialog" aria-modal="true">
          <div className="bank-modal">
            <div className="bank-modal-header">
              <div>
                <div className="bank-modal-title">Your Bank</div>
                <div className="bank-modal-subtitle">
                  Total ₿{myBankTotal} in {myBankCount} cards.
                </div>
              </div>
              <button type="button" className="bank-close" onClick={() => setBankOpen(false)}>
                Close
              </button>
            </div>
            <div className="bank-card-grid">
              {myBankImages.length === 0 ? (
                <div className="bank-empty">No money cards in bank.</div>
              ) : (
                myBankImages.map((src, idx) => (
                  <div key={`bank-${idx}`} className="bank-card">
                    <img src={src} alt="Money card" draggable={false} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

  {/* hand modal removed - overlay serves as the hand */}
    </div>
  );
};

export default Playmat2;
