import React from "react";
import { useNavigate } from "react-router-dom";
import "../style/HowToPlay.css";

type SectionId =
  | "game-room"
  | "board"
  | "cards"
  | "hand"
  | "win";

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
  const [activeSection, setActiveSection] = React.useState<SectionId>("game-room");
  const navigate = useNavigate();

  const renderContent = () => {
    switch (activeSection) {
      case "game-room":
        return (
          <>
            <h2>Game Room</h2>
            <p>
              Every Blockopoly game starts in a room. The room holds the list of
              players, the shared game state, and the code you can share with
              friends so they can join you.
            </p>
            <h3>Creating a room</h3>
            <p>
              From the main menu, choose to create a new room. You&apos;ll become
              the host and get a short room code you can send to other players.
            </p>
            <h3>Joining a room</h3>
            <p>
              If a friend has already created a room, enter their code on the
              join screen. Once you join, you&apos;ll see their name and any other
              players waiting in the lobby.
            </p>
            <h3>Sharing room codes</h3>
            <p>
              Room codes are short and easy to share in chat or verbally. Anyone
              with the code can join while the room is open, up to the maximum
              player count supported by the game.
            </p>
            <div className="howto-media-placeholder">
              {/* Place gameplay screenshots for lobby and room creation here */}
              <div className="howto-media-label">
                Lobby &amp; room setup screenshots (coming soon)
              </div>
            </div>
          </>
        );
      case "board":
        return (
          <>
            <h2>The Board</h2>
            <p>
              The main play screen shows the shared board. Each player has a
              property collection, a bank, and slots where new cards are played.
            </p>
            <h3>Bank</h3>
            <p>
              Your bank holds money cards and any cards you&apos;ve chosen to treat
              as money. The total value is shown as Bollar ({String.fromCharCode(0x20BF)})
              at the top of the bank.
            </p>
            <h3>Estate / property collection</h3>
            <p>
              Property sets are grouped by color. Completing sets increases the
              rent you can charge with your action cards.
            </p>
            <h3>Property slots</h3>
            <p>
              When you play a property card, it is added to a set. Some cards
              can move between sets, and some can be developed with houses or
              hotels for extra power.
            </p>
            <div className="howto-media-placeholder">
              {/* Place screenshots of the board layout and player mats here */}
              <div className="howto-media-label">
                Board &amp; player mat screenshots (coming soon)
              </div>
            </div>
          </>
        );
      case "cards":
        return (
          <>
            <h2>The Cards</h2>
            <p>
              Cards are the core of Blockopoly. Every turn, you decide whether
              to grow your bank, build out your properties, or play actions that
              affect other players.
            </p>
            <h3>Property cards</h3>
            <p>
              Property cards belong to one or more colors. Matching colors into
              sets is how you build toward winning. Some cards are wild and can
              change colors.
            </p>
            <h3>Action cards</h3>
            <p>
              Action cards let you charge rent, steal properties, swap sets, and
              more. They are played from your hand and usually cost one of your
              allowed plays for the turn.
            </p>
            <h3>Wild cards</h3>
            <p>
              Wild property cards can count as multiple colors. You choose which
              color they represent when you play or move them, subject to the
              game&apos;s set rules.
            </p>
            <h3>Money cards</h3>
            <p>
              Every card with a Bollar value ({String.fromCharCode(0x20BF)}) can be banked
              as money instead of being used for its printed effect. Banked
              money can be used to pay charges against you.
            </p>
            <div className="howto-media-placeholder">
              {/* Place card close-ups or card type overview images here */}
              <div className="howto-media-label">
                Card type images &amp; callouts (coming soon)
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
              can usually play up to a fixed number of cards. Some actions draw
              extra cards or force you to discard down.
            </p>
            <h3>Ending your turn</h3>
            <p>
              When you are done playing cards, tap the End Turn button near your
              hand. If you are above the maximum hand size, the game will prompt
              you to discard.
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
              turn. If you exceed it, you&apos;ll need to discard down before the
              next player begins.
            </p>
            <div className="howto-media-placeholder">
              {/* Place hand overlay screenshots or short clips here */}
              <div className="howto-media-label">
                Hand &amp; turn flow media (coming soon)
              </div>
            </div>
          </>
        );
      case "win":
        return (
          <>
            <h2>How to Win</h2>
            <p>
              The goal of Blockopoly is to complete enough powerful property
              sets before anyone else. When a player meets the winning
              conditions, the game ends and everyone is taken to the winner
              screen.
            </p>
            <h3>Winning conditions</h3>
            <p>
              A typical win condition is completing a certain number of full
              sets in different colors. Some variants may add extra objectives,
              like holding specific developments.
            </p>
            <h3>Winner screen</h3>
            <p>
              At the end of the game, you&apos;ll see who won, which sets they
              completed, and a summary of their board. You can use this to
              discuss plays and quickly rematch.
            </p>
            <div className="howto-media-placeholder">
              {/* Place winner screen screenshots or recap videos here */}
              <div className="howto-media-label">
                Winner screen screenshots (coming soon)
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
