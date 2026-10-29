import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./style.css";
const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:8000");
type Player = {
  id: string;
  name: string;
  ready: boolean;
  online: boolean;
  host: boolean;
  role?: string;
};
type Result = {
  round: number;
  success: boolean;
  points: number;
  target: number;
};
type Mission = {
  round: number;
  totalRounds: number;
  phase: string;
  crisis: {
    title: string;
    description: string;
    specialty: string;
    target: number;
    resource: string;
    cost: number;
  };
  deadline: number | null;
  serverTime: number;
  resources: Record<string, number>;
  submitted: string[];
  history: Result[];
  outcome?: string;
};
type Room = {
  code: string;
  status: string;
  players: Player[];
  mission: Mission | null;
};
function App() {
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [room, setRoom] = useState<Room | null>(null),
    [me, setMe] = useState(""),
    [error, setError] = useState("");
  const [remaining, setRemaining] = useState(45),
    [connected, setConnected] = useState(socket.connected),
    [target, setTarget] = useState(""),
    [resource, setResource] = useState("energy");
  useEffect(() => {
    const onRoom = (r: Room) => setRoom(r),
      onConnect = () => setConnected(true),
      onDisconnect = () => {
        setConnected(false);
        setError(
          "Connection lost. Refresh to join a new lobby. Active missions cannot be rejoined yet.",
        );
      };
    socket.on("room_state", onRoom);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("room_state", onRoom);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);
  useEffect(() => {
    const m = room?.mission;
    if (!m?.deadline) return;
    const received = performance.now(),
      duration = m.deadline - m.serverTime;
    const tick = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil(duration - (performance.now() - received) / 1000),
        ),
      );
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [room]);
  const send = (event: string, payload: object) =>
    socket
      .timeout(5000)
      .emit(
        event,
        payload,
        (
          err: Error | null,
          r: { ok: boolean; error?: string; code?: string; playerId?: string },
        ) => {
          if (err || !r?.ok) {
            setError(r?.error || "Request failed. Check your connection.");
            return;
          }
          setError("");
          if (r.playerId) setMe(r.playerId);
          if (r.code) setCode(r.code);
        },
      );
  const mine = room?.players.find((p) => p.id === me),
    m = room?.mission;
  const locked =
    !connected ||
    !m ||
    m.phase !== "action" ||
    m.submitted.includes(me) ||
    remaining === 0;
  const act = (kind: string) =>
    send("submit_action", { round: m?.round, kind, target, resource });
  return (
    <main>
      <header>
        <span className="eyebrow">EMERGENCY OPERATIONS NETWORK</span>
        <h1>
          CODE <em>RED</em>
        </h1>
        <p>Save the City · Cooperative Multiplayer</p>
      </header>
      <section className="panel">
        {!room ? (
          <>
            <h2>Enter command center</h2>
            <label>
              Callsign
              <input
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <button
              disabled={!connected}
              onClick={() => send("create_room", { name })}
            >
              Create mission room
            </button>
            <div className="divider">OR JOIN A TEAM</div>
            <label>
              Room code
              <input
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
              />
            </label>
            <button
              disabled={!connected}
              className="secondary"
              onClick={() => send("join_room", { name, code })}
            >
              Join room
            </button>
          </>
        ) : (
          <>
            <div className="eyebrow">ROOM CODE</div>
            <h2 className="code">{room.code}</h2>
            <h3>Squad ({room.players.length}/6)</h3>
            {room.players.map((p) => (
              <div className="player" key={p.id}>
                <span>
                  {p.name} {p.host ? "★" : ""} {p.role}
                </span>
                <span>
                  {p.online ? (p.ready ? "READY" : "WAITING") : "OFFLINE"}
                </span>
              </div>
            ))}
            {room.status === "lobby" ? (
              <>
                <p>Share this code with your teammates.</p>
                <button
                  disabled={!connected}
                  onClick={() => send("set_ready", { ready: !mine?.ready })}
                >
                  {mine?.ready ? "Cancel ready" : "I am ready"}
                </button>
                {mine?.host && (
                  <button
                    className="start"
                    disabled={
                      !connected ||
                      room.players.length < 2 ||
                      !room.players.every((p) => p.online && p.ready)
                    }
                    onClick={() => send("start_game", {})}
                  >
                    Start Mission
                  </button>
                )}
                <p className="note">
                  The host can start with 2–6 connected, ready players.
                </p>
              </>
            ) : (
              m && (
                <section aria-label="Mission">
                  <h2>
                    Round {m.round} / {m.totalRounds}
                  </h2>
                  <p>
                    Your role: <strong>{mine?.role}</strong>
                  </p>
                  <div className="resources">
                    {Object.entries(m.resources).map(([key, value]) => (
                      <span key={key}>
                        {key}: <strong>{value}</strong>
                      </span>
                    ))}
                  </div>
                  {m.phase === "action" ? (
                    <>
                      <h3>{m.crisis.title}</h3>
                      <p>{m.crisis.description}</p>
                      <p>
                        Target {m.crisis.target} · {m.crisis.resource} cost{" "}
                        {m.crisis.cost} · Specialty: {m.crisis.specialty}
                      </p>
                      <p
                        className="countdown"
                        role="timer"
                        aria-label="Seconds remaining"
                      >
                        {remaining}s
                      </p>
                      <button disabled={locked} onClick={() => act("respond")}>
                        Respond (+2, specialty +1)
                      </button>
                      <label>
                        Support teammate
                        <select
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        >
                          <option value="">Choose teammate</option>
                          {room.players
                            .filter((p) => p.id !== me)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        disabled={locked || !target}
                        onClick={() => act("support")}
                      >
                        Support (+1, responder bonus +1)
                      </button>
                      <label>
                        Conserve resource
                        <select
                          value={resource}
                          onChange={(e) => setResource(e.target.value)}
                        >
                          {["energy", "medical", "security"].map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </label>
                      <button disabled={locked} onClick={() => act("conserve")}>
                        Conserve (+5 resource)
                      </button>
                      <p aria-live="polite">
                        {m.submitted.includes(me)
                          ? "Action locked. Waiting for the squad."
                          : `Actions submitted: ${m.submitted.length}/${room.players.length}`}
                      </p>
                      <p className="note">
                        One action per round. Missing actions score zero at the
                        deadline.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3>
                        {m.phase === "complete"
                          ? m.outcome === "saved"
                            ? "City saved!"
                            : "City lost"
                          : "Round resolved"}
                      </h3>
                      {m.phase === "resolution" && (
                        <p>Next emergency in {remaining}s</p>
                      )}
                    </>
                  )}
                  <ol>
                    {m.history.map((r) => (
                      <li key={r.round}>
                        Round {r.round}: {r.success ? "Resolved" : "Failed"} ·{" "}
                        {r.points}/{r.target} points
                      </li>
                    ))}
                  </ol>
                </section>
              )
            )}
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
