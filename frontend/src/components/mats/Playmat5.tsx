import React, { useState } from "react";
import type { PlaymatProps } from "./Playmat2";
import PropertySetGrid from "../properties/PropertySetGrid";
import { buildPlayerPropertyGridVM } from "../../lib/adapters/buildPlayerPropertyGridVM";

import backdrop from "@/assets/Backdrop.svg";

import "@/components/mats/mat_styles/playmat_shared.css";
import "./mat_styles/Playmat5.css";

type PlayerKey = "p1" | "p2" | "p3" | "p4" | "p5";

const Playmat5: React.FC<PlaymatProps> = ({
  layout,
  myPID,
  names,
  discardImages = [],
  playerCardMap,
  cardImageForId,
}) => {
  const pidMap: Record<PlayerKey, string> = {
    p1: layout.p1 ?? "",
    p2: layout.p2 ?? "",
    p3: layout.p3 ?? "",
    p4: layout.p4 ?? "",
    p5: layout.p5 ?? "",
  };

  const [bankOpen, setBankOpen] = useState(false);
  const myBank = playerCardMap?.[myPID]?.bank;
  const myBankImages = myBank?.images ?? [];
  const myBankTotal = myBank?.total ?? 0;
  const myBankCount = myBank?.count ?? 0;

  const lastThree = discardImages.slice(-3);
  const [d1, d2, d3] = [
    lastThree[0] ?? null,
    lastThree[1] ?? null,
    lastThree[2] ?? null,
  ];

  const nameFor = (pid?: string) => (pid && names[pid]) || "Opponent";

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

  const renderBank = (pid: string) => {
    const bank = playerCardMap?.[pid]?.bank;
    const canOpen = pid === myPID;
    return (
      <div className="money-collection-bank">
        <div
          className="bank-pile"
          role={canOpen ? "button" : undefined}
          tabIndex={canOpen ? 0 : -1}
          onClick={canOpen ? openMyBank : undefined}
          onKeyDown={(event) => handleBankKeyDown(event, canOpen)}
          aria-label={`${nameFor(pid)} bank`}
        >
          <div className="bank-summary" aria-hidden>
            <div className="bank-total">{bank?.total ?? 0}M</div>
            <div className="bank-count">{bank?.count ?? 0} cards</div>
          </div>
        </div>
      </div>
    );
  };

  const renderProperties = (
    pid: string,
    seat: PlayerKey,
    orientation: "me" | "opponent"
  ) => {
    const entry = playerCardMap?.[pid];
    return (
      <div className="property-collection-zone" aria-label={`${nameFor(pid)} property collection`}>
        <div className="property-collection" id={`${seat}-properties`}>
          <PropertySetGrid
            sets={buildPlayerPropertyGridVM(entry?.properties ?? {}, cardImageForId).sets}
            enableDnD={pid === myPID}
            onOpenSet={() => {}}
            orientation={orientation}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="playing-mat-outline-5-players" data-my-pid={myPID}>
      <img className="backdrop" src={backdrop} alt="5-player backdrop" />

      <div className="mat-stage">
        <div className="player-1-space">
          {renderProperties(pidMap.p1, "p1", pidMap.p1 === myPID ? "me" : "opponent")}
          {renderBank(pidMap.p1)}
        </div>

        <div className="player-2-space">
          {renderProperties(pidMap.p2, "p2", "opponent")}
          {renderBank(pidMap.p2)}
        </div>

        <div className="player-3-space">
          {renderProperties(pidMap.p3, "p3", "opponent")}
          {renderBank(pidMap.p3)}
        </div>

        <div className="player-4-space">
          {renderProperties(pidMap.p4, "p4", "opponent")}
          {renderBank(pidMap.p4)}
        </div>

        <div className="player-5-space">
          {renderProperties(pidMap.p5, "p5", "opponent")}
          {renderBank(pidMap.p5)}
        </div>

        <div className="center-pile" aria-label="discard pile">
          <div className="discard-pile">
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
                  Total {myBankTotal}M in {myBankCount} cards.
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
    </div>
  );
};

export default Playmat5;
