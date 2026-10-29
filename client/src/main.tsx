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
// Orthographic isometric projection; height stays vertical on screen.
function project(x: number, y: number, z = 0) {
  return { x: 360 + (x - y) * 0.54, y: 105 + (x + y) * 0.31 - z };
}
function face(points: number[][]) {
  return points
    .map(([x, y, z = 0]) => {
      const p = project(x, y, z);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}
function CityBuilding({
  building: b,
  active,
}: {
  building: (typeof districts)[number];
  active: boolean;
}) {
  const { x, y, w, h, color } = b,
    d = 85;
  const roof = project(x + w / 2, y + d / 2, h);
  const label = project(x + w / 2, y + d / 2, h + 36);
  return (
    <g>
      <polygon
        points={face([
          [x + 10, y + 10],
          [x + w + 60, y + 10],
          [x + w + 60, y + d + 45],
          [x + 10, y + d + 45],
        ])}
        fill="#000"
        opacity=".24"
      />
      <polygon
        points={face([
          [x - 10, y - 10],
          [x + w + 10, y - 10],
          [x + w + 10, y + d + 10],
          [x - 10, y + d + 10],
        ])}
        fill="#344958"
        stroke="#577180"
        strokeWidth="1"
      />
      {active && (
        <polygon
          className="emergency-ring"
          points={face([
            [x - 17, y - 17],
            [x + w + 17, y - 17],
            [x + w + 17, y + d + 17],
            [x - 17, y + d + 17],
          ])}
          fill="none"
          stroke="#ff776a"
          strokeWidth="3"
        />
      )}
      <polygon
        points={face([
          [x, y + d],
          [x + w, y + d],
          [x + w, y + d, h],
          [x, y + d, h],
        ])}
        fill="url(#wall-front)"
        stroke="#517082"
        strokeWidth=".7"
      />
      <polygon
        points={face([
          [x + w, y],
          [x + w, y + d],
          [x + w, y + d, h],
          [x + w, y, h],
        ])}
        fill="url(#wall-side)"
        stroke="#354e60"
        strokeWidth=".7"
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <polygon
            key={`${row}:${col}`}
            points={face([
              [x + 12 + col * 29, y + d + 0.5, 18 + row * 25],
              [x + 25 + col * 29, y + d + 0.5, 18 + row * 25],
              [x + 25 + col * 29, y + d + 0.5, 29 + row * 25],
              [x + 12 + col * 29, y + d + 0.5, 29 + row * 25],
            ])}
            fill={row * 25 + 29 < h - 5 ? color : "transparent"}
            opacity={col % 3 === 0 ? 0.3 : 0.8}
          />
        )),
      )}
      {[0, 1, 2].map((col) => (
        <polygon
          key={col}
          points={face([
            [x + w + 0.5, y + 12 + col * 23, 25],
            [x + w + 0.5, y + 24 + col * 23, 25],
            [x + w + 0.5, y + 24 + col * 23, 40],
            [x + w + 0.5, y + 12 + col * 23, 40],
          ])}
          fill={color}
          opacity=".35"
        />
      ))}
      <polygon
        points={face([
          [x, y, h],
          [x + w, y, h],
          [x + w, y + d, h],
          [x, y + d, h],
        ])}
        fill="url(#roof-light)"
        stroke="#8499a3"
        strokeWidth="1"
      />
      <polygon
        points={face([
          [x + 7, y + 7, h + 1],
          [x + w - 7, y + 7, h + 1],
          [x + w - 7, y + d - 7, h + 1],
          [x + 7, y + d - 7, h + 1],
        ])}
        fill="#20394b"
        stroke={color}
        strokeOpacity=".5"
      />
      <polygon
        points={face([
          [x + 14, y + 12, h + 1],
          [x + 43, y + 12, h + 1],
          [x + 43, y + 36, h + 1],
          [x + 14, y + 36, h + 1],
        ])}
        fill="#0e2635"
      />
      <polygon
        points={face([
          [x + 14, y + 12, h + 10],
          [x + 43, y + 12, h + 10],
          [x + 43, y + 36, h + 10],
          [x + 14, y + 36, h + 10],
        ])}
        fill="#69818c"
      />
      <polygon
        points={face([
          [x + 43, y + 12, h + 1],
          [x + 43, y + 36, h + 1],
          [x + 43, y + 36, h + 10],
          [x + 43, y + 12, h + 10],
        ])}
        fill="#3b5364"
      />
      <ellipse
        cx={roof.x + 15}
        cy={roof.y + 6}
        rx="19"
        ry="10"
        fill={color}
        opacity=".15"
      />
      <text
        x={roof.x + 15}
        y={roof.y + 10}
        textAnchor="middle"
        fill={color}
        fontSize="27"
        fontWeight="bold"
      >
        {b.icon}
      </text>
      <path d={`M${label.x} ${label.y + 8}v16`} stroke={color} opacity=".5" />
      <text
        x={label.x}
        y={label.y}
        textAnchor="middle"
        fill={color}
        fontSize="9"
        fontWeight="bold"
        letterSpacing=".7"
      >
        {b.name}
      </text>
      <polygon
        points={face([
          [x + 50, y + d + 0.7, 0],
          [x + 73, y + d + 0.7, 0],
          [x + 73, y + d + 0.7, 24],
          [x + 50, y + d + 0.7, 24],
        ])}
        fill="#102839"
        stroke={color}
        strokeWidth=".8"
      />
    </g>
  );
}
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
  const home = project(100 + index * 80, 555);
  const scene = project(
    destination.x + 15 + (index % 3) * 48,
    destination.y + 110 + Math.floor(index / 3) * 35,
  );
  const roadStart = project(355, 555),
    roadEnd = project(355, destination.y + 110 + Math.floor(index / 3) * 35);
  const color = districts[index % 4].color;
  return (
    <g
      className={`city-actor ${dispatched ? "actor-deployed" : "actor-home"}`}
      style={
        {
          "--home-x": `${home.x}px`,
          "--home-y": `${home.y}px`,
          "--road-x": `${roadStart.x}px`,
          "--road-y": `${roadStart.y}px`,
          "--turn-x": `${roadEnd.x}px`,
          "--turn-y": `${roadEnd.y}px`,
          "--scene-x": `${scene.x}px`,
          "--scene-y": `${scene.y}px`,
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
        <path d="M2-5h4v13H2Z" fill="#000" opacity=".2" />
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
          <linearGradient id="wall-front" x2="0" y2="1">
            <stop stopColor="#43627a" />
            <stop offset="1" stopColor="#1a3449" />
          </linearGradient>
          <linearGradient id="wall-side">
            <stop stopColor="#142839" />
            <stop offset="1" stopColor="#30485d" />
          </linearGradient>
          <linearGradient id="roof-light" x2="1" y2="1">
            <stop stopColor="#94aab1" />
            <stop offset="1" stopColor="#4e687b" />
          </linearGradient>
          <linearGradient id="ground-light" x2="0" y2="1">
            <stop stopColor="#2a4b50" />
            <stop offset="1" stopColor="#172f3f" />
          </linearGradient>
          <radialGradient id="tree-light" cx=".3" cy=".2">
            <stop stopColor="#62977b" />
            <stop offset="1" stopColor="#234c46" />
          </radialGradient>
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
        <ellipse
          cx="360"
          cy="380"
          rx="300"
          ry="130"
          fill="#000"
          opacity=".3"
          filter="url(#shadow)"
        />
        <polygon
          points={face([
            [0, 0, -20],
            [650, 0, -20],
            [650, 650, -20],
            [0, 650, -20],
          ])}
          fill="#0b1b29"
          stroke="#345163"
        />
        <polygon
          points={face([
            [0, 650, 0],
            [650, 650, 0],
            [650, 650, -20],
            [0, 650, -20],
          ])}
          fill="#203b4c"
        />
        <polygon
          points={face([
            [650, 0, 0],
            [650, 650, 0],
            [650, 650, -20],
            [650, 0, -20],
          ])}
          fill="#102838"
        />
        <polygon
          points={face([
            [0, 0],
            [650, 0],
            [650, 650],
            [0, 650],
          ])}
          fill="url(#ground-light)"
          stroke="#496675"
        />
        {[0, 100, 200, 300, 400, 500, 600].map((n) => (
          <g key={n} opacity=".12">
            <polyline
              points={face([
                [n, 0],
                [n, 650],
              ])}
              stroke="#9abac4"
            />
            <polyline
              points={face([
                [0, n],
                [650, n],
              ])}
              stroke="#9abac4"
            />
          </g>
        ))}
        <polygon
          points={face([
            [315, 0],
            [395, 0],
            [395, 650],
            [315, 650],
          ])}
          fill="#657781"
        />
        <polygon
          points={face([
            [0, 270],
            [650, 270],
            [650, 350],
            [0, 350],
          ])}
          fill="#657781"
        />
        <polygon
          points={face([
            [325, 0],
            [385, 0],
            [385, 650],
            [325, 650],
          ])}
          fill="#182c3c"
        />
        <polygon
          points={face([
            [0, 280],
            [650, 280],
            [650, 340],
            [0, 340],
          ])}
          fill="#182c3c"
        />
        <polyline
          points={face([
            [355, 0],
            [355, 650],
          ])}
          stroke="#b2baa9"
          strokeWidth="1.5"
          strokeDasharray="7 10"
        />
        <polyline
          points={face([
            [0, 310],
            [650, 310],
          ])}
          stroke="#b2baa9"
          strokeWidth="1.5"
          strokeDasharray="7 10"
        />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <polygon
              points={face([
                [290 + i * 5, 282],
                [293 + i * 5, 282],
                [293 + i * 5, 338],
                [290 + i * 5, 338],
              ])}
              fill="#a0adb0"
            />
            <polygon
              points={face([
                [327, 360 + i * 5],
                [383, 360 + i * 5],
                [383, 363 + i * 5],
                [327, 363 + i * 5],
              ])}
              fill="#a0adb0"
            />
          </g>
        ))}
        {[
          [70, 100],
          [300, 80],
          [590, 150],
          [620, 420],
          [70, 470],
          [280, 490],
          [610, 600],
        ].map(([x, y], i) => {
          const base = project(x, y),
            top = project(x, y, 30);
          return (
            <g key={i}>
              <ellipse
                cx={base.x + 8}
                cy={base.y + 4}
                rx="18"
                ry="7"
                fill="#0004"
              />
              <path
                d={`M${base.x} ${base.y}V${top.y}`}
                stroke="#6b6654"
                strokeWidth="4"
              />
              <ellipse
                cx={top.x}
                cy={top.y}
                rx="15"
                ry="20"
                fill="url(#tree-light)"
              />
              <ellipse
                cx={top.x - 4}
                cy={top.y - 7}
                rx="8"
                ry="11"
                fill="#75ab80"
                opacity=".4"
              />
            </g>
          );
        })}
        {[0, 1].map((i) => (
          <CityBuilding
            key={i}
            building={districts[i]}
            active={active === i && m?.phase !== "complete"}
          />
        ))}
        {[
          [305, 230],
          [405, 410],
          [305, 560],
        ].map(([x, y], i) => {
          const p = project(x, y);
          return (
            <g key={i}>
              <ellipse cx={p.x} cy={p.y} rx="14" ry="6" fill="#f2cf7418" />
              <path
                d={`M${p.x} ${p.y}v-33h8`}
                fill="none"
                stroke="#7b8e97"
                strokeWidth="2"
              />
              <circle cx={p.x + 8} cy={p.y - 33} r="3" fill="#ffe1a0" />
              <circle
                cx={p.x + 8}
                cy={p.y - 33}
                r="9"
                fill="#ffd885"
                opacity=".08"
              />
            </g>
          );
        })}
        <g
          className="iso-ambulance"
          style={
            {
              "--vehicle-x": `${project(360, 310).x}px`,
              "--vehicle-y": `${project(360, 310).y}px`,
            } as React.CSSProperties
          }
        >
          <ellipse cy="8" rx="23" ry="8" fill="#0005" />
          <path d="M-21-6l13-8 30 10-13 9Z" fill="#f0f6f3" />
          <path d="M-21-6v13l30 11V5Z" fill="#91adb9" />
          <path d="M9 5l13-9v13L9 18Z" fill="#506f84" />
          <path d="M-13-1v9m-4-6 8 3" stroke="#ff766a" strokeWidth="3" />
          <path d="M4-9l8 3-5 4-8-3Z" fill="#ff766a" />
          <ellipse cx="-13" cy="12" rx="4" ry="5" fill="#0b1b27" />
          <ellipse cx="5" cy="18" rx="4" ry="5" fill="#0b1b27" />
        </g>
        {[3, 2].map((i) => (
          <CityBuilding
            key={i}
            building={districts[i]}
            active={active === i && m?.phase !== "complete"}
          />
        ))}
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
