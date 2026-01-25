import React, { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import FallingBricks from "../components/FallingBricks";
import logo from "../assets/Blockopoly-logo.svg";
import {
  HOST_ID_KEY,
  NAME_KEY,
  PLAYER_ID_KEY,
  ROOM_ID_KEY,
} from "../constants/constants";
import "../style/WinnerScreen.css";

type WinnerNavState = {
  winnerId?: string;
  winnerName?: string;
  winningColors?: string[];
};

const GAME_API =
  import.meta.env.VITE_GAME_SERVICE ?? "http://localhost:8081";

const toWs = (base: string) =>
  base
    .replace(/^http(s?):\/\//, (_: string, s: string) =>
      s ? "wss://" : "ws://"
    )
    .replace(/\/+$/, "");

const WinnerScreen: React.FC = () => {
  const { roomCode = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { winnerId, winnerName, winningColors }: WinnerNavState =
    (location.state as WinnerNavState) || {};

  const myPID = sessionStorage.getItem(PLAYER_ID_KEY) || "";
  const myName = (sessionStorage.getItem(NAME_KEY) || "").trim();
  const hostId = sessionStorage.getItem(HOST_ID_KEY) || "";
  const roomId = sessionStorage.getItem(ROOM_ID_KEY) || "";

  const isHost = hostId !== "" && hostId === myPID;
  const effectiveWinnerName = winnerName || (winnerId === myPID ? myName || "You" : "Winner");

  const autoJoinedRef = useRef(false);

  // One-shot winner sound when the screen mounts
  useEffect(() => {
    if (typeof Audio === "undefined") return;
    try {
      const audio = new Audio("/sfx/winner_sound.mp3");
      audio.volume = 0.9;
      void audio.play().catch(() => {
        // ignore autoplay errors
      });
    } catch {
      // ignore audio errors
    }
  }, []);

  // Listen for a fresh game STATE and auto-join when the game is restarted
  useEffect(() => {
    if (!roomId || !myPID) return;
    if (autoJoinedRef.current) return;

    const wsUrl = `${toWs(GAME_API)}/ws/play/${encodeURIComponent(
      roomId
    )}/${encodeURIComponent(myPID)}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === "STATE" && msg.gameState) {
          const nextWinner = msg.gameState.winningPlayer as string | null;
          if (nextWinner === null && !autoJoinedRef.current) {
            autoJoinedRef.current = true;
            ws.close();
            navigate(`/play/${roomCode || "current"}`, { replace: true, state: null });
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      // best-effort only; players can still use the button below
    };

    return () => {
      ws.close();
    };
  }, [myPID, navigate, roomCode, roomId]);

  const handlePlayAgain = () => {
    if (!isHost) return;
    navigate(`/play/${roomCode || "current"}`, {
      state: { restart: true },
    });
  };

  const handleBackToMain = () => {
    navigate("/main");
  };

  const formattedColors = useMemo(
    () =>
      (winningColors || [])
        .filter(Boolean)
        .map((c) => c.charAt(0) + c.slice(1).toLowerCase()),
    [winningColors]
  );

  const confettiPieces = useMemo(
    () => Array.from({ length: 80 }, (_, i) => i),
    []
  );

  return (
    <div className="winner-screen">
      <div className="falling-bricks-wrapper">
        <FallingBricks />
      </div>

      <div className="winner-confetti-layer">
        {confettiPieces.map((i) => (
          <span key={i} className="confetti-piece" />
        ))}
      </div>

      <motion.div
        className="winner-card"
        initial={{ y: "-100vh", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
      >
        <img className="winner-logo" src={logo} alt="Blockopoly logo" />

        <div className="winner-icon" aria-hidden>
          ★
        </div>

        <h1 className="winner-title">Winner!</h1>
        <p className="winner-name">{effectiveWinnerName}</p>

        {formattedColors.length > 0 && (
          <p className="winner-colors">
            Winning set
            {formattedColors.length > 1 ? "s" : ""}:{" "}
            {formattedColors.join(", ")}
          </p>
        )}

        <div className="winner-buttons">
          {isHost && (
            <button
              className="winner-button primary"
              onClick={handlePlayAgain}
            >
              Play Again with This Room
            </button>
          )}
          {!isHost && (
            <button
              className="winner-button primary"
              onClick={() => navigate(`/play/${roomCode || "current"}`)}
            >
              Join New Game
            </button>
          )}
          <button className="winner-button secondary" onClick={handleBackToMain}>
            Back to Main Menu
          </button>
        </div>

        {!isHost && (
          <p className="winner-hint">
            Waiting for the host to start a new game, or return to the main
            menu.
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default WinnerScreen;
