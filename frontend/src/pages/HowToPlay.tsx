import React from "react";
import { useNavigate } from "react-router-dom";
import "../style/HowToPlay.css";
import lobbyJoinImg from "../assets/how-to-play/lobby-join.png";
import WinnerScreen from "../assets/how-to-play/winner-screen.png";
import boardLabeledImg from "../assets/how-to-play/board-labeled.png";
import boardTopbarImg from "../assets/how-to-play/board-topbar.png";
import handDefaultImg from "../assets/how-to-play/hand-default.png";
import winnerConditionImg from "../assets/how-to-play/winner-condition.png";
import actioncardsImg from "../assets/how-to-play/cards-action.png";
import propertycardsImg from "../assets/how-to-play/cards-properties.png";
import moneycardsImg from "../assets/how-to-play/cards-money.png";
import wildcardsImg from "../assets/how-to-play/cards-wildprops.png";
import lobbyjoinImg from "../assets/how-to-play/lobby-create.png";
import lobbyshareImg from "../assets/how-to-play/lobby-share.png";
import bankinfo from "../assets/how-to-play/board-bank.png";
import propslot from "../assets/how-to-play/board-propslots.png";

type SectionId = "game-room" | "board" | "cards" | "hand" | "win";

const sections: { id: SectionId; title: string; items: string[] }[] = [
  {
    id: "game-room",
    title: "Game Room",
    items: ["Creating a room", "Joining a room", "Sharing room codes"],
  },
  {
    id: "board",
    title: "The Board",
    items: ["Bank overview", "Estate / property collection", "Property slots"],
  },
  {
    id: "cards",
    title: "The Cards",
    items: ["Property cards", "Action cards", "Wild cards", "Money cards"],
  },
  {
    id: "hand",
    title: "Your Hand",
    items: ["Ending your turn", "Positioning cards", "Hand size rules"],
  },
  {
    id: "win",
    title: "How to Win",
    items: ["Winning conditions", "Winner screen"],
  },
];

export const HowToPlay: React.FC = () => {
  const [activeSection, setActiveSection] =
    React.useState<SectionId>("game-room");
  const navigate = useNavigate();

  const renderContent = () => {
    switch (activeSection) {
      case "game-room":
        return (
          <>
            <h2>Game Room</h2>
            <p>
              Every Blockopoly session happens inside a room. The room keeps
              track of all players, the shared game state, and the code you use
              to invite friends.
            </p>
            <h3>Creating a room</h3>
            <p>
              From the main menu, enter your name and choose{" "}
              <strong>Create Room</strong>. You&apos;ll become the host and get
              a short room code you can send to other players.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={lobbyjoinImg}
                alt="Main menu and create-room UI showing code and name fields"
                className="howto-image"
              />
              <div className="howto-media-label">
                Example of entering your name and creating a new game room.
              </div>
            </div>
            <h3>Joining a room</h3>
            <p>
              If a friend has already created a room, enter their code on the
              join screen. Once you join, you&apos;ll see their name and any
              other players waiting in the lobby before the game starts.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={lobbyJoinImg}
                alt="Main menu and join-room UI showing code and name fields"
                className="howto-image"
              />
              <div className="howto-media-label">
                Example of entering your name and room code to join a game.
              </div>
            </div>
            <h3>Sharing room codes</h3>
            <p>
              Room codes are short and easy to share in chat or verbally. Anyone
              with the code can join while the room is open, up to the maximum
              player count supported by the game.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={lobbyshareImg}
                alt="Main menu and join-room UI showing code and name fields"
                className="howto-image"
              />
              <div className="howto-media-label">
                Tip: Double-check the room code with your friends to avoid
                joining the wrong game!
              </div>
            </div>
          </>
        );
      case "board":
        return (
          <>
            <h2>The Board</h2>
            <p>
              The main play screen shows a shared board with 2–5 player spaces.
              Each player has a property collection (estate field), a bank, and
              a personal hand at the edge closest to them.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={boardLabeledImg}
                alt="Board labeled with bank, property collection, discard pile and hand"
                className="example-board"
              />
              <div className="howto-media-label">
                Labeled board showing each player space, the central discard
                pile, and the status top bar.
              </div>
            </div>
            <h3>Bank</h3>
            <p>
              Your bank holds money cards and any cards you&apos;ve chosen to
              treat as money. The total value is shown as Bollar (
              {String.fromCharCode(0x20bf)}) at the top of the bank.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={bankinfo}
                alt="Player bank showing money cards and total Bollar value"
                className="example-board"
              />
              <div className="howto-media-label">
                The bank holds your money cards and displays the total Bollar
                value at the top.
              </div>
            </div>

            <h3>Top status bar</h3>
            <p>
              The top bar shows important information about the current game
              state, including whose turn it is, how many plays remain, and
              buttons for positioning cards and ending your turn.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={boardTopbarImg}
                alt="Board top bar showing turn indicator, plays remaining, position and end turn buttons"
                className="example-board"
              />
              <div className="howto-media-label">
                The top status bar highlights the current player, plays left,
                and has quick access to positioning and ending your turn.
              </div>
            </div>
            <h3>Estate / property collection</h3>
            <p>
              The estate field is a 5 × 2 grid of property slots that holds
              every property you own. Properties are grouped by color, and
              completed sets are visually marked so you can see rent potential
              at a glance.
            </p>

            <h3>Property slots</h3>
            <p>
              When you play a property card, it is added to a set. Some cards
              can move between sets, and some can be developed with houses or
              hotels for extra rent. Use the positioning tools to organize your
              properties and optimize your layout to win.
            </p>

            <div className="howto-media-placeholder">
              <img
                src={propslot}
                alt="Example of property slots showing grouped properties and completed sets"
                className="howto-image"
              />
              <div className="howto-media-label">
                Example property slots showing grouped properties and completed
                sets.
              </div>
            </div>
          </>
        );
      case "cards":
        return (
          <>
            <h2>The Cards</h2>
            <p>
              Blockopoly uses a 110-card deck inspired by Monopoly Deal. Each
              turn, you decide whether to grow your bank, build out your
              properties, or play actions that affect other players.
            </p>
            <h3>Property cards</h3>
            <p>
              Property cards belong to one or more colors (for example Green,
              Dark Blue, Turquoise). Completing a color set increases your rent
              and counts toward winning. Some properties are wild and can belong
              to multiple colors.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={propertycardsImg}
                alt="Example property cards showing different colors and values"
                className="howto-image"
              />
              <div className="howto-media-label">
                Example property cards in various colors and values.
              </div>
            </div>
            <h3>Action cards</h3>
            <p>
              Action cards let you charge rent, steal or swap properties, and
              respond to opponents. Examples include Deal Breaker, Sly Deal,
              Forced Deal, Debt Collector, and It&apos;s My Birthday. These
              cards are played from your hand and typically cost one of your
              plays for the turn.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={actioncardsImg}
                alt="Example action cards showing different actions and values"
                className="howto-image"
              />
              <div className="howto-media-label">
                Example action cards with various effects and Bollar values.
              </div>
            </div>
            <h3>Wild cards</h3>
            <p>
              Wild property cards can count as two specific colors (like Red &
              Yellow) or as any color. When you play or reposition them, you
              choose which color they currently represent, as long as you follow
              the set rules described on the card.
            </p>
            <div>
              <img
                src={wildcardsImg}
                alt="Example wild property cards showing different color combinations"
                className="howto-image"
              />
              <div
                className="howto-media-label"
                style={{ justifyContent: "center", display: "flex" }}
              >
                Example wild property cards that can represent multiple colors.
              </div>
            </div>
            <h3>Money cards</h3>
            <p>
              Money cards are pure Bollar ({String.fromCharCode(0x20bf)}) value
              and live in your bank. Many action cards also have a Bollar value
              in the corner and can be banked instead of played. When
              you&apos;re charged rent or targeted by actions like Debt
              Collector or Birthday, you pay using cards from your bank first,
              then from your properties if needed.
            </p>
            <div>
              <img
                src={moneycardsImg}
                alt="Example money cards showing different Bollar values"
                className="howto-image"
              />
              <div
                className="howto-media-label"
                style={{ justifyContent: "center", display: "flex" }}
              >
                Example money cards with various Bollar values for banking.
              </div>
            </div>
            <div className="howto-media-placeholder">
              <div className="howto-media-label">
                Tip: Check card values before banking or playing an action.
                Sometimes keeping a high-value card in your bank is safer than
                using its ability.
              </div>
            </div>
          </>
        );
      case "hand":
        return (
          <>
            <h2>Your Hand</h2>
            <p>
              Your hand is the set of cards you currently hold. On your turn you
              can usually play up to a fixed number of cards, then you must end
              your turn with at most seven cards. Some actions draw extra cards
              or force you to discard down.
            </p>
            <h3>Ending your turn</h3>
            <p>
              When you are done playing cards, tap the End Turn button near your
              hand. If you are above the maximum hand size (7 cards), the game
              will automatically open a discard prompt so you can choose which
              cards to keep.
            </p>
            <h3>Positioning</h3>
            <p>
              Positioning lets you move properties between sets, reorganize
              wilds, and optimize your layout. You can open the positioning
              tools from the Position button in the top bar.
            </p>
            <h3>Card number rules</h3>
            <p>
              There is a maximum number of cards you can hold at the end of your
              turn. If you exceed it, you&apos;ll need to discard down before
              the next player begins.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={handDefaultImg}
                alt="Example of a player hand showing cards and the End Turn button"
                className="howto-image"
              />
              <div className="howto-media-label">
                Your hand sits along the bottom of the board with a clear End
                Turn button and card fan.
              </div>
            </div>
          </>
        );
      case "win":
        return (
          <>
            <h2>How to Win</h2>
            <p>
              The goal of Blockopoly is to complete enough property sets before
              anyone else. When a player meets the winning conditions, the game
              ends and everyone is taken to the winner screen.
            </p>
            <h3>Winning conditions</h3>
            <p>
              A standard game is won by completing a 3 full property sets(for
              example, three complete sets would be Blue, Red and Brown). Houses
              and hotels can make those sets more valuable but do not replace
              the need for completed sets.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={winnerConditionImg}
                alt="Player set approaching winning condition has 2 full sets and 1 partial set"
                className="howto-image"
              />
              <div className="howto-media-label">
                Example player board showing two completed sets (red and Orange)
                and one incomplete set (blue). This player is one set away from
                winning.
              </div>
            </div>

            <h3>Winner screen</h3>
            <p>
              At the end of the game, you&apos;ll see who won, which sets they
              completed, and a summary of their board. You can use this to
              discuss plays and quickly rematch.
            </p>
            <div className="howto-media-placeholder">
              <img
                src={WinnerScreen}
                alt="Winner screen showing completed sets and winning summary"
                className="howto-image"
              />
              <div className="howto-media-label">
                Example winner screen highlighting the winning player and the
                sets that secured the game.
              </div>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="howto-root">
      <header className="howto-header">
        <button
          type="button"
          className="howto-back-button"
          onClick={() => navigate(-1)}
          aria-label="Back to menu"
        >
          ← Back
        </button>
        <div className="howto-header-title">Learn How to Play Blockopoly</div>
      </header>
      <div className="howto-panel">
        <aside className="howto-sidebar">
          <h1 className="howto-title">Learn How to Play</h1>
          <nav aria-label="How to play sections" className="howto-nav">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`howto-nav-item ${
                  activeSection === section.id ? "active" : ""
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="howto-nav-title">{section.title}</span>
                <ul className="howto-nav-subitems">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </button>
            ))}
          </nav>
        </aside>

        <main className="howto-content" aria-live="polite">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
