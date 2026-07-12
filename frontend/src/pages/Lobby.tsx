/* src/pages/Lobby.tsx */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FallingBricks from "../components/FallingBricks";
import "../style/Lobby.css";
import type { Player } from "./Mainmenu.tsx";
import { LoadingSplash } from "../components/LoadingSplash";
import {
  NAME_KEY,
  PLAYER_ID_KEY,
  PLAYERS_KEY,
  ROOM_ID_KEY,
  HOST_ID_KEY,
} from "../constants/constants.ts";
import { getClientId } from "../utils/clientId";
import { ROOM_SERVICE_URL } from "../config/services";

const API = ROOM_SERVICE_URL;

const buildSSEURL = (
  room: string,
  name: string,
  playerId: string | null = null
): string => {
  return `${API}/joinRoom/${encodeURIComponent(room)}/${encodeURIComponent(
    name
  )}${playerId !== null ? `?playerId=${encodeURIComponent(playerId)}` : ""}`;
};

const Lobby: React.FC = () => {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();

  const [myName, setMyName] = useState<string>(
    sessionStorage.getItem(NAME_KEY) || ""
  );
  const [myPID, setMyPID] = useState<string>(
    sessionStorage.getItem(PLAYER_ID_KEY) || ""
  );
  const [roomId, setRoomId] = useState<string>(
    sessionStorage.getItem(ROOM_ID_KEY) ?? ""
  );

  const [players, setPlayers] = useState<Player[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(PLAYERS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [hostID, setHostID] = useState<string | null>(
    sessionStorage.getItem(HOST_ID_KEY) || null
  );
  const [bootstrapChecked, setBootstrapChecked] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<"link" | "code" | null>(
    null
  );

  const esRef = useRef<EventSource | null>(null);
  const closingSseRef = useRef(false);

  const upsert = useCallback((list: Player[], p: Player): Player[] => {
    const i = list.findIndex((x) => x.playerId === p.playerId);
    if (i === -1) return [...list, p];
    const next = [...list];
    next[i] = p;
    return next;
  }, []);

  useEffect(() => {
    sessionStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  }, [players]);

  // Bootstrap lobby state on reload if identity is missing
  useEffect(() => {
    if (!roomCode) {
      setBootstrapChecked(true);
      return;
    }
    if (myPID && myName && roomId) {
      setBootstrapChecked(true);
      return;
    }

    const clientId = getClientId();
    let cancelled = false;
    setBootstrapChecked(false);

    (async () => {
      try {
        const res = await fetch(
          `/api/room/rooms/${encodeURIComponent(
            roomCode
          )}/state?clientId=${encodeURIComponent(clientId)}`
        );
        if (!res.ok) return;
        const data: {
          roomId: string;
          roomCode: string;
          players: { playerId: string; name: string }[];
          hostId: string | null;
          playerId: string | null;
        } = await res.json();

        if (cancelled) return;
        if (!data.playerId || !data.roomId) return;

        const player = data.players.find((p) => p.playerId === data.playerId);
        const resolvedName = player?.name ?? myName;

        setMyPID(data.playerId);
        setRoomId(data.roomId);
        if (resolvedName) {
          setMyName(resolvedName);
          sessionStorage.setItem(NAME_KEY, resolvedName);
        }
        setPlayers(data.players as Player[]);
        if (data.hostId) {
          setHostID(data.hostId);
        }

        sessionStorage.setItem(PLAYER_ID_KEY, data.playerId);
        sessionStorage.setItem(ROOM_ID_KEY, data.roomId);
        sessionStorage.setItem(PLAYERS_KEY, JSON.stringify(data.players));
        if (data.hostId) {
          sessionStorage.setItem(HOST_ID_KEY, data.hostId);
        }
      } catch (e) {
        console.error("[Lobby bootstrap] Failed to load room state", e);
      } finally {
        if (!cancelled) setBootstrapChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // run once per roomCode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) {
      navigate("/");
      return;
    }

    if (!myName || !myPID || !roomId) {
      if (!bootstrapChecked) return;
      console.warn(
        "Lobby: Missing recovered identity. Returning to main menu."
      );
      navigate("/main");
      return;
    }

    const url = buildSSEURL(roomCode, myName, myPID);
    console.log(`Lobby: Attempting to establish new SSE connection to: ${url}`);

    closingSseRef.current = false;
    const es = new EventSource(url);
    esRef.current = es;

    const handleJoin = (ev: MessageEvent) => {
      try {
        const [pid, ...nameParts] = ev.data.split(":");
        if (!pid) {
          console.warn("[SSE JOIN] Received event with no player ID.");
          return;
        }
        const name = nameParts.join(":") || "Player";
        console.log(`[SSE JOIN] Player joined: ${name} (${pid})`);
        setPlayers((cur) => upsert(cur, { playerId: pid, name }));
      } catch (e) {
        console.error("[SSE JOIN parse error]", e);
      }
    };

    const handleLeave = (ev: MessageEvent) => {
      const [pid] = ev.data.split(":");
      if (!pid) {
        console.warn("[SSE LEAVE] Received event with no player ID.");
        return;
      }
      console.log(`[SSE LEAVE] Player left: (${pid})`);
      setPlayers((cur) => cur.filter((p) => p.playerId !== pid));
    };

    const handleHost = (ev: MessageEvent) => {
      const [newHostID] = ev.data.split(":");
      const trimmedHostID = newHostID ? newHostID.trim() : "";
      if (trimmedHostID) {
        console.log(`[SSE HOST] New host ID: ${trimmedHostID}`);
        setHostID(trimmedHostID);
      } else {
        console.warn("[SSE HOST] Malformed host ID:", ev.data);
      }
    };

    const handleGameStart = () => {
      console.log("[SSE START] Game is starting! Navigating...");
      if (!roomCode) {
        console.error("[SSE START] No room code available for navigation.");
        return;
      }
      closingSseRef.current = true;
      navigate(`/play/${roomCode}`);
    };

    es.addEventListener("JOIN", handleJoin);
    es.addEventListener("LEAVE", handleLeave);
    es.addEventListener("HOST", handleHost);
    es.addEventListener("START", handleGameStart);

    es.onopen = () => {
      console.log("[Lobby] SSE open. readyState=", es.readyState);
    };

    es.onerror = (error) => {
      // IMPORTANT: don't close here — let EventSource auto-retry
      if (!closingSseRef.current) {
        console.error("[Lobby] SSE error (auto-retry will continue):", error);
      }
    };

    return () => {
      console.log(
        "Lobby: Cleaning up SSE connection on unmount or effect re-run."
      );
      closingSseRef.current = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [roomCode, myName, navigate, upsert, myPID, roomId, bootstrapChecked]);

  useEffect(() => {
    if (hostID) {
      sessionStorage.setItem(HOST_ID_KEY, hostID);
    }
  }, [hostID]);

  const leaveRoom = () => {
    fetch(`${API}/leaveRoom/${myPID}`, { method: "POST" }).then((r) => {
      if (r.ok) {
        navigate("/");
      }
    });
  };

  const startGame = async () => {
    try {
      const res = await fetch(`${API}/start/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: myPID }),
      });

      if (!res.ok) throw new Error(await res.text());

      // Optional: rely on SSE START for synced navigation
      // navigate(`/play/${roomCode}`);
      console.log("[startGame] Start request sent. Waiting for SSE START…");
    } catch (err) {
      console.error("[startGame] Couldn’t start:", err);
      alert("Could not start the game – check the server log.");
    }
  };

  const hostName =
    Array.isArray(players) && typeof hostID === "string"
      ? players.find((p) => p.playerId === hostID)?.name ?? "The Host"
      : "The Host";

  const iAmHost = myPID && myPID === hostID;

  const inviteLink = (() => {
    if (typeof window === "undefined") return "";
    const code = encodeURIComponent(roomCode);
    if (window.location.protocol === "file:") {
      return `https://playblockopoly.com/join/${code}`;
    }
    return `${window.location.origin}/join/${code}`;
  })();

  const copyText = async (value: string, type: "link" | "code") => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopiedInvite(type);
      window.setTimeout(() => setCopiedInvite(null), 1500);
    } catch (err) {
      console.error("[Lobby] Could not copy invite", err);
      setCopiedInvite(null);
    }
  };

  if (!bootstrapChecked && (!myName || !myPID || !roomId)) {
    return (
      <div className="lobby-wrapper">
        <div className="falling-bricks-wrapper">
          <FallingBricks />
        </div>
        <div className="lobby reconnecting">
          <LoadingSplash inline label="Reconnecting room" />
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-wrapper">
      <div className="falling-bricks-wrapper">
        <FallingBricks />
      </div>

      <div className="lobby">
        <h2>{hostName}&apos;s Room</h2>
        <div className="invite-panel" aria-label="Invite players">
          <div className="invite-code-row">
            <span>Join Code</span>
            <b className="room-code-display">{roomCode}</b>
            <button
              type="button"
              className="copy-code-button"
              onClick={() => copyText(roomCode, "code")}
            >
              {copiedInvite === "code" ? "Copied" : "Copy Code"}
            </button>
          </div>
          <button
            type="button"
            className="copy-link-button"
            onClick={() => copyText(inviteLink, "link")}
          >
            {copiedInvite === "link" ? "Invite Link Copied" : "Copy Invite Link"}
          </button>
        </div>

        <h3>{players.length}/5 players</h3>
        <ol className="player-list">
          {players.map((p) => (
            <li key={p.playerId} className="player-slot">
              {p.playerId === hostID && "👑 "}
              {p.name}
              {p.playerId === myPID && " (You)"}
            </li>
          ))}
          {Array.from({ length: Math.max(0, 5 - players.length) }).map(
            (_, i) => (
              <li key={`empty-${i}`} className="player-slot empty" />
            )
          )}
        </ol>

        <div className="button-row">
          <button className="leave-button" onClick={leaveRoom}>
            Leave
          </button>
          {iAmHost && (
            <button
              className="start-button"
              onClick={startGame}
              disabled={players.length < 2}
            >
              Start&nbsp;Game
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
