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
  id: string;
  number: number;
  round: number;
  totalRounds: number;
  phase: string;
  crisis: {
    key: string;
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
  missionNumber: number;
  status: string;
  players: Player[];
  mission: Mission | null;
};
const districts = [
  {
    name: "CENTRAL HOSPITAL",
    x: 130,
    y: 185,
    w: 145,
    h: 105,
    color: "#36cbb2",
    icon: "+",
  },
  {
    name: "POWER STATION",
    x: 450,
    y: 170,
    w: 125,
    h: 85,
    color: "#f7bb53",
    icon: "ϟ",
  },
  {
    name: "NETWORK HUB",
    x: 440,
    y: 370,
    w: 135,
    h: 130,
    color: "#a79cff",
    icon: "⌁",
  },
  {
    name: "DISPATCH HQ",
    x: 125,
    y: 380,
    w: 150,
    h: 75,
    color: "#69c9fa",
    icon: "◉",
  },
];
function SquadActor({
  player,
  index,
  mission,
  destination,
  speech,
}: {
  player: Player;
  index: number;
  mission: Mission | null;
  destination: (typeof districts)[number];
  speech?: string;
}) {
  const dispatched = !!mission?.submitted.includes(player.id);
  const [walking, setWalking] = useState(false);
  useEffect(() => {
    if (!dispatched) {
      setWalking(false);
      return;
    }
    setWalking(true);
    const timer = setTimeout(() => setWalking(false), 5000);
    return () => clearTimeout(timer);
  }, [dispatched]);
  const home = 100 + index * 80;
  const x = destination.x + 15 + (index % 3) * 60;
  const y = destination.y + destination.h + 25 + Math.floor(index / 3) * 40;
  const color = districts[index % 4].color;
  return (
    <g
      className={`city-actor ${dispatched ? "actor-deployed" : "actor-home"}`}
      style={
        {
          "--home-x": `${home}px`,
          "--scene-x": `${x}px`,
          "--scene-y": `${y}px`,
          opacity: player.online ? 1 : 0.35,
        } as React.CSSProperties
      }
    >
      <ellipse cy="15" rx="10" ry="4" fill="#0008" />
      <g className={walking ? "actor-walking" : "actor-standing"}>
        <path
          className="leg-left"
          d="M-4 6l-2 9"
          stroke="#9aaec0"
          strokeWidth="3"
        />
        <path
          className="leg-right"
          d="M4 6l2 9"
          stroke="#9aaec0"
          strokeWidth="3"
        />
        <path
          className="actor-arms"
          d="M-7-3l-5 9m19-9 5 9"
          stroke={color}
          strokeWidth="3"
        />
        <rect x="-7" y="-6" width="14" height="16" rx="5" fill={color} />
        <circle cy="-11" r="6" fill="#e6bf9c" />
        <path d="M-7-13q7-10 14 0" fill={color} />
      </g>
      <text y="31" textAnchor="middle" fill="#d9e8f2" fontSize="10">
        {player.name.slice(0, 10)}
      </text>
      {speech && (
        <g className="speech-bubble" aria-hidden="true">
          <rect
            x="-82"
            y="-69"
            width="164"
            height="39"
            rx="9"
            fill="#e0f5f0"
            stroke={color}
          />
          <path d="M-5-30l5 9 6-9" fill="#e0f5f0" />
          <text
            x="0"
            y="-53"
            textAnchor="middle"
            fill="#193c46"
            fontSize="10"
            fontWeight="700"
          >
            {speech.split("|")[0]}
          </text>
          <text x="0" y="-39" textAnchor="middle" fill="#193c46" fontSize="10">
            {speech.split("|")[1] || ""}
          </text>
        </g>
      )}
    </g>
  );
}
function CityView({ room }: { room: Room }) {
  const m = room.mission;
  const [radioTurn, setRadioTurn] = useState(0);
  const online = room.players.filter((p) => p.online);
  const radioKey = `${m?.id}:${m?.round}:${m?.phase}:${m?.submitted.join(",")}:${online.map((p) => p.id).join(",")}`;
  useEffect(() => {
    setRadioTurn(0);
    const timer = setInterval(() => setRadioTurn((turn) => turn + 1), 4500);
    return () => clearInterval(timer);
  }, [radioKey]);
  const speaker = online[radioTurn % Math.max(1, online.length)];
  const teammate = online[(radioTurn + 1) % Math.max(1, online.length)];
  const latest = m?.history[m.history.length - 1];
  const callout = !m
    ? radioTurn % 2 === 0
      ? "Radio check.|Squad, do you copy?"
      : "Loud and clear.|Standing by at HQ."
    : m.phase === "complete"
      ? m.outcome === "saved"
        ? "City secured!|Great work, team."
        : "Regroup at HQ.|We'll try again together."
      : m.phase === "resolution"
        ? latest?.success
          ? "Emergency contained.|Nice teamwork!"
          : "We need to regroup.|Stay with me, squad."
        : speaker && m.submitted.includes(speaker.id)
          ? radioTurn % 2 === 0
            ? "Orders confirmed.|Team, keep me updated."
            : "I'm in position.|Stay on the radio."
          : radioTurn % 2 === 0
            ? "New emergency.|Team, check your orders."
            : "Copy that.|Ready when you are.";
  const active = !m
    ? -1
    : ["blackout", "surge", "ransomware"].includes(m.crisis.key)
      ? 0
      : ["grid", "storm"].includes(m.crisis.key)
        ? 1
        : m.crisis.key === "breach"
          ? 2
          : 3;
  const destination = districts[Math.max(0, active)];
  return (
    <section className="city-panel" aria-label="Live city mission map">
      <div className="city-heading">
        <div>
          <span className="eyebrow">LIVE OPERATIONS / SECTOR 01</span>
          <h2>Meridian City</h2>
        </div>
        <span className="live-indicator">
          {m?.phase === "complete"
            ? "MISSION COMPLETE"
            : m
              ? "SQUAD DEPLOYED"
              : "AWAITING DEPLOYMENT"}
        </span>
      </div>
      <svg
        viewBox="0 0 720 580"
        role="img"
        aria-label={`City map. ${m ? m.crisis.title : "Squad at dispatch headquarters"}`}
      >
        <defs>
          <pattern
            id="grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M32 0H0V32"
              fill="none"
              stroke="#203346"
              strokeWidth=".6"
            />
          </pattern>
          <radialGradient id="glow">
            <stop stopColor="#2d777c" stopOpacity=".3" />
            <stop offset="1" stopColor="#07131f" stopOpacity="0" />
          </radialGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="12" stdDeviation="8" floodOpacity=".4" />
          </filter>
        </defs>
        <rect width="720" height="580" fill="url(#grid)" />
        <ellipse cx="360" cy="270" rx="350" ry="270" fill="url(#glow)" />
        <path d="M0 310H720 M355 60V580" stroke="#142537" strokeWidth="62" />
        <path
          d="M0 310H720 M355 60V580"
          stroke="#5c6c72"
          strokeWidth="2"
          strokeDasharray="12 14"
        />
        <path
          d="M0 345H720 M390 60V580"
          stroke="#426471"
          strokeOpacity=".4"
          fill="none"
        />
        {[
          [65, 130],
          [305, 130],
          [630, 145],
          [640, 410],
          [70, 445],
          [305, 475],
          [620, 505],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y + 12} rx="18" ry="7" fill="#07131c" />
            <path d={`M${x} ${y}v18`} stroke="#698071" strokeWidth="4" />
            <circle cx={x} cy={y - 6} r="16" fill="#23554e" />
            <circle cx={x - 4} cy={y - 12} r="10" fill="#337365" />
          </g>
        ))}
        {districts.map((b, i) => (
          <g key={b.name} filter="url(#shadow)">
            {active === i && m?.phase !== "complete" && (
              <ellipse
                className="emergency-ring"
                cx={b.x + b.w / 2}
                cy={b.y + 25}
                rx="102"
                ry="55"
                fill="none"
                stroke="#ff7666"
                strokeWidth="2"
              />
            )}
            <path
              d={`M${b.x} ${b.y}l18 -18h${b.w}v${b.h}l-18 18Z`}
              fill="#2a4256"
            />
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="3"
              fill="#1d3447"
              stroke={active === i ? "#ff7666" : b.color}
              strokeOpacity=".7"
            />
            <path d={`M${b.x} ${b.y}l18 -18h${b.w}l-18 18Z`} fill="#425c6c" />
            <rect
              x={b.x + 12}
              y={b.y + 14}
              width={b.w - 24}
              height="6"
              rx="2"
              fill={b.color}
            />
            {Array.from({ length: 8 }, (_, n) => (
              <rect
                key={n}
                x={b.x + 15 + (n % 4) * 29}
                y={b.y + 36 + Math.floor(n / 4) * 24}
                width="12"
                height="12"
                rx="1"
                fill={n % 3 === 0 ? "#365161" : b.color}
                opacity=".7"
              />
            ))}
            <text
              x={b.x + b.w / 2}
              y={b.y - 30}
              textAnchor="middle"
              fill={b.color}
              fontSize="11"
              letterSpacing="1"
            >
              {b.name}
            </text>
            <circle
              cx={b.x + b.w - 12}
              cy={b.y - 8}
              r="18"
              fill="#112334"
              stroke={b.color}
            />
            <text
              x={b.x + b.w - 12}
              y={b.y - 2}
              textAnchor="middle"
              fill={b.color}
              fontSize="22"
            >
              {b.icon}
            </text>
          </g>
        ))}
        <g className="ambulance">
          <rect x="302" y="285" width="36" height="18" rx="4" fill="#dce8e9" />
          <rect x="327" y="288" width="8" height="8" fill="#54a4bd" />
          <path d="M312 288v10m-5-5h10" stroke="#f56d64" strokeWidth="3" />
          <rect x="308" y="282" width="12" height="3" fill="#ff776a" />
        </g>
        {room.players.map((p, i) => (
          <SquadActor
            key={`${p.id}:${m?.id}:${m?.round}`}
            player={p}
            index={i}
            mission={m}
            destination={destination}
            speech={speaker?.id === p.id ? callout : undefined}
          />
        ))}
        <text x="28" y="555" fill="#7194a6" fontSize="10" letterSpacing="2">
          MERIDIAN EMERGENCY RESPONSE NETWORK
        </text>
      </svg>
      <div className="squad-radio" aria-label="Automatic squad dialogue">
        <span className="eyebrow">SQUAD RADIO · AUTO CALLOUTS</span>
        <p role="status" aria-live="polite">
          <strong>{speaker?.name || "Dispatch"}</strong>
          {teammate && teammate.id !== speaker?.id
            ? ` → ${teammate.name}`
            : " → Squad"}
          : {callout.replace("|", " ")}
        </p>
      </div>
      <div className="city-caption">
        <span className="signal-dot" />
        <p>
          {m
            ? m.phase === "complete"
              ? m.outcome === "saved"
                ? "City secured. Your squad is ready for its next assignment."
                : "Regroup at headquarters and try again."
              : m.crisis.description
            : "Your city is counting on you. Assemble the squad at dispatch HQ."}
        </p>
      </div>
    </section>
  );
}
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
    send("submit_action", {
      missionId: m?.id,
      round: m?.round,
      kind,
      target,
      resource,
    });
  return (
    <main className={room ? "operations" : ""}>
      <header>
        <span className="eyebrow">EMERGENCY OPERATIONS NETWORK</span>
        <h1>
          CODE <em>RED</em>
        </h1>
        <p>Save the City · Cooperative Multiplayer</p>
      </header>
      {room && <CityView room={room} />}
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
                <p>
                  Mission {room.missionNumber} · Ready up to deploy. Share this
                  code with your teammates.
                </p>
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
                    Mission {m.number} · Round {m.round} / {m.totalRounds}
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
                  {m.phase === "complete" &&
                    (mine?.host ? (
                      <div className="mission-controls">
                        {m.outcome === "saved" && (
                          <button
                            disabled={!connected}
                            onClick={() => send("reset_game", { mode: "next" })}
                          >
                            Next mission →
                          </button>
                        )}
                        <button
                          className="secondary"
                          disabled={!connected}
                          onClick={() =>
                            send("reset_game", { mode: "restart" })
                          }
                        >
                          Start over
                        </button>
                        <p className="note">
                          Return the squad to the lobby to ready up. Start over
                          begins at Mission 1.
                        </p>
                      </div>
                    ) : (
                      <p>Waiting for the host to choose the next deployment.</p>
                    ))}
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
