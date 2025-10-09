// Playmat2.tsx
/* src/components/mats/Playmat2.tsx */
//  has the 2-player layout and logic for tracking last played card in discard
import React from "react";
// createPortal removed — overlay now handles hand
import { DroppableBind } from "../DropZones";
import { useDroppable } from "@dnd-kit/core";

/* ------- images ------- */
import backdrop from "@/assets/Backdrop.svg";

const cardBack = new URL("../../assets/cards/card-back.svg", import.meta.url).href;

import "@/components/mats/mat_styles/playmat_shared.css";
import "./mat_styles/Playmat2.css";

// import { PLAYER_ID_KEY } from "../../constants/constants";

/** Keep this in sync with PlayScreen's type */
export type PlaymatProps = {
  layout: Partial<Record<"p1" | "p2", string>>; // seat -> playerId
  myPID: string;
  names: Record<string, string>;
  discardImages?: string[]; // newest last
  playerCardMap?: Record<string, { bank: string[]; properties: Record<string, string[]> }>;
};

type PlayerKey = "p1" | "p2";

const Playmat2: React.FC<PlaymatProps> = ({
  layout,
  myPID,
  names,
  discardImages = [],
  playerCardMap,
}) => {
  // hand modal removed; overlay shows the hand
  // pull the true pids from layout
  const pidMap: Record<PlayerKey, string> = {
    p1: layout.p1 ?? "",
    p2: layout.p2 ?? "",
  };

  // hand modal removed

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
        <div className="player-1-space">
          <div
            className={`property-collection-zone droppable ${
              p1PropsOver ? "is-over" : ""
            }`}
            ref={setP1PropsRef}
            aria-label={`${nameFor(pidMap.p1)} property collection`}
          >
            <div className="property-collection" id="p1-properties">
              <DroppableBind zoneId="p1-properties" />
              {playerCardMap && playerCardMap[pidMap.p1] && (
                <div className="properties-sets">
                  {Object.entries(playerCardMap[pidMap.p1].properties).map(
                    ([setId, cards]) => {
                      // split into vertical columns of up to 2 cards each (2 rows tall)
                      const cols: string[][] = [];
                      for (let i = 0; i < cards.length; i += 2) cols.push(cards.slice(i, i + 2));
                      return (
                        <div key={setId} id={`p1-set-${setId}`} className="property-set zone p-2">
                          <DroppableBind zoneId={`p1-set-${setId}`} />
                          <div className="property-set-cards">
                            {cols.map((col, ci) => (
                              <div className="property-col" key={`col-${ci}`}>
                                {col.map((src: string, ri: number) => (
                                  <img
                                    key={`${setId}-${ci}-${ri}`}
                                    src={src}
                                    className={`prop-card ${ri === 1 ? "prop-card-bottom" : ""}`}
                                    alt="property"
                                    draggable={false}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                          {cards.length > 1 && (
                            <div className="set-count-badge" aria-hidden>
                              {cards.length}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="money-collection-bank">
            <div
              className={`bank-pile droppable ${p1BankOver ? "is-over" : ""}`}
              id="p1-bank"
              ref={setP1BankRef}
              aria-label={`${nameFor(pidMap.p1)} bank`}
            >
              <DroppableBind zoneId="p1-bank" />
            </div>
            {/* render bank cards if provided */}
            {playerCardMap && playerCardMap[pidMap.p1] && (
              <div className="bank-cards mt-2 flex gap-1 flex-wrap" aria-hidden>
                {playerCardMap[pidMap.p1].bank.map((src: string, i: number) => (
                  <img key={`p1-bank-${i}`} src={src} className="bank-card" alt="bank card" draggable={false} />
                ))}
              </div>
            )}
            {/* hand button removed - overlay shows cards */}
          </div>
        </div>

        {/* -------- Player 2 area -------------------------------------- */}
        <div className="player-2-space">
            <div
              className={`player-2-property-collection-zone droppable ${
              p2PropsOver ? "is-over" : ""
            }`}
            ref={setP2PropsRef}
            aria-label={`${nameFor(pidMap.p2)} property collection`}
          >
            <div className="property-collection2" id="p2-properties">
              <DroppableBind zoneId="p2-properties" />
              {playerCardMap && playerCardMap[pidMap.p2] && (
                <div className="properties-sets">
                  {Object.entries(playerCardMap[pidMap.p2].properties).map(
                    ([setId, cards]) => {
                      const cols: string[][] = [];
                      for (let i = 0; i < cards.length; i += 2) cols.push(cards.slice(i, i + 2));
                      return (
                        <div key={setId} id={`p2-set-${setId}`} className="property-set zone p-2">
                          <DroppableBind zoneId={`p2-set-${setId}`} />
                          <div className="property-set-cards">
                            {cols.map((col, ci) => (
                              <div className="property-col" key={`col-${ci}`}>
                                {col.map((src: string, ri: number) => (
                                  <img
                                    key={`${setId}-${ci}-${ri}`}
                                    src={src}
                                    className={`prop-card ${ri === 1 ? "prop-card-bottom" : ""}`}
                                    alt="property"
                                    draggable={false}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                          {cards.length > 1 && (
                            <div className="set-count-badge" aria-hidden>
                              {cards.length}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="player-2-money-collection-bank">
            <div
              className={`bank-pile2 droppable ${p2BankOver ? "is-over" : ""}`}
              id="p2-bank"
              ref={setP2BankRef}
              aria-label={`${nameFor(pidMap.p2)} bank`}
            >
              <DroppableBind zoneId="p2-bank" />
            </div>
            {/* hand button removed - overlay shows cards */}
              {playerCardMap && playerCardMap[pidMap.p2] && (
                <div className="bank-cards mt-2 flex gap-1 flex-wrap" aria-hidden>
                  {playerCardMap[pidMap.p2].bank.map((src: string, i: number) => (
                    <img key={`p2-bank-${i}`} src={src} className="bank-card" alt="bank card" draggable={false} />
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* -------------------- Draw / discard piles ------------------- */}
        <div className="center-pile">
          <div className="draw-pile">
            <img className="deck-top" src={cardBack} alt="draw pile" />
          </div>

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

  {/* hand modal removed — overlay serves as the hand */}
    </div>
  );
};

export default Playmat2;
