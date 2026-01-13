/*  src/pages/MainMenu.tsx  */
import React, { useEffect, useRef, useState } from "react";
import "../style/Mainmenu.css";
import FallingBricks from "../components/FallingBricks";
import { useNavigate } from "react-router-dom";
import {
  NAME_KEY,
  PLAYER_ID_KEY,
  PLAYERS_KEY,
  ROOM_ID_KEY,
} from "../constants/constants.ts";
import { getClientId } from "../utils/clientId";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export type initialRoomState = {
  playerId: string;
  name: string;
  roomId: string;
  roomCode: string;
  players: Player[];
};

export interface Player {
  playerId: string;
  name: string;
}

const MainMenu: React.FC = () => {
  sessionStorage.removeItem(PLAYER_ID_KEY);
  const [name, setName] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const esRef = useRef<EventSource | null>(null);
  const navigatedRef = useRef(false);

  const isValidName = name.trim().length > 0 && name.trim().length <= 28;
  const isValidCode = /^[A-Za-z0-9]{6}$/.test(codeInput);

  const goLobby = (code: string, state: initialRoomState) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    sessionStorage.setItem(PLAYER_ID_KEY, state.playerId);
    sessionStorage.setItem(PLAYERS_KEY, JSON.stringify(state.players));
    sessionStorage.setItem(ROOM_ID_KEY, state.roomId);
    sessionStorage.setItem(NAME_KEY, state.name);
    console.log("[NAV] → /lobby/" + code);
    navigate(`/lobby/${code}`);
  };

  const openStream = (url: string) => {
    esRef.current?.close();
    console.log("[SSE] open", url);

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("open", () => console.log("[SSE] connected"));

    es.addEventListener("INITIAL", (ev) => {
      console.log("[SSE] INITIAL", ev.data);
      try {
        let payload: initialRoomState = JSON.parse(ev.data);

        if (!payload.roomCode || !payload.playerId) {
          setError("Server response malformed.");
          return;
        }

        if (payload.roomCode) {
          goLobby(payload.roomCode, payload);
        }
      } catch {
        console.warn("[SSE] INITIAL not JSON");
      }
    });

    es.onerror = () => {
      console.error("[SSE] error");
      es.close();
      setError("Lost connection to server.");
    };
  };

  const handleJoin = () => {
    setError("");
    if (!isValidName || !isValidCode) {
      setError("Enter a name and 6-character room code.");
      return;
    }
    const clientId = getClientId();
    const url = `${API}/joinRoom/${codeInput}/${encodeURIComponent(
      name.trim()
    )}?clientId=${encodeURIComponent(clientId)}`;
    openStream(url);
  };

  const handleCreate = () => {
    setError("");
    if (!isValidName) {
      setError("Please enter a name.");
      return;
    }
    const clientId = getClientId();
    const url = `${API}/createRoom/${encodeURIComponent(
      name.trim()
    )}?clientId=${encodeURIComponent(clientId)}`;
    openStream(url);
  };

  useEffect(() => () => esRef.current?.close(), []);

  return (
    <div className="main-menu">
      <div className="form-container">
        <h2>Welcome to Blockopoly</h2>

        <input
          className="name-input"
          placeholder="Enter your name"
          value={name}
          maxLength={28}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="roompin-input"
          placeholder="Room Code (6 characters)"
          value={codeInput}
          maxLength={6}
          onChange={(e) =>
            setCodeInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))
          }
        />

        {error && <div className="error-message">{error}</div>}

        <div className="button-row">
          <button
            className="primary-button"
            onClick={handleJoin}
            disabled={!isValidName || !isValidCode}
          >
            Join Room
          </button>
          <button
            className="secondary-button"
            onClick={handleCreate}
            disabled={!isValidName}
          >
            Create Room
          </button>
        </div>
      </div>

      <div className="falling-bricks-wrapper">
        <FallingBricks />
      </div>
    </div>
  );
};

export default MainMenu;
