import React, { useEffect, useState, useRef } from "react";
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
type RadioMessage = {
  id: string;
  playerId: string;
  name: string;
  leader: boolean;
  text: string;
  sentAt: number;
  missionNumber: number;
  round: number | null;
};
type Room = {
  messages: RadioMessage[];
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
    color: "#3ee0d2",
    facade: "#fff2b0",
    side: "#b8bb80",
    icon: "+",
  },
  {
    name: "POWER STATION",
    x: 450,
    y: 170,
    w: 125,
    h: 85,
    color: "#f7bb53",
    facade: "#ffd168",
    side: "#bd984c",
    icon: "ϟ",
  },
  {
    name: "NETWORK HUB",
    x: 440,
    y: 370,
    w: 135,
    h: 130,
    color: "#a79cff",
    facade: "#4eafd3",
    side: "#266f9b",
    icon: "⌁",
  },
  {
    name: "DISPATCH HQ",
    x: 125,
    y: 380,
    w: 150,
    h: 75,
    color: "#69c9fa",
    facade: "#e8e9cb",
    side: "#9caeaa",
    icon: "◉",
  },
];
// Orthographic isometric projection; height stays vertical on screen.
function project(x: number, y: number, z = 0) {
  return {
    x: 360 + (x - 355) * (0.38 + y / 650),
    y: 210 + y * 0.48 - z * (0.55 + y / 1000),
  };
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
        fill={b.facade}
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
        fill={b.side}
        stroke="#354e60"
        strokeWidth=".7"
      />
      {Array.from(
        { length: Math.max(1, Math.floor((h - 10) / 25)) },
        (_, i) => i,
      ).map((row) =>
        Array.from(
          { length: Math.max(1, Math.floor((w - 10) / 29)) },
          (_, i) => i,
        ).map((col) => (
          <polygon
            key={`${row}:${col}`}
            points={face([
              [x + 12 + col * 29, y + d + 0.5, 18 + row * 25],
              [x + 25 + col * 29, y + d + 0.5, 18 + row * 25],
              [x + 25 + col * 29, y + d + 0.5, 29 + row * 25],
              [x + 12 + col * 29, y + d + 0.5, 29 + row * 25],
            ])}
            fill={row * 25 + 29 < h - 5 ? "#226885" : "transparent"}
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
        fill="#fff2cd"
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
        fill="#b7cbc4"
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
        fill="#174959"
        stroke="#f8f4d4"
        strokeWidth="3"
        paintOrder="stroke"
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
  const words = (speech || "").replace(/\s+/g, " ").split(" ");
  let firstLine = "";
  while (words.length && (firstLine + " " + words[0]).trim().length <= 26)
    firstLine = (firstLine + " " + words.shift()).trim();
  if (!firstLine && words.length) firstLine = words.shift()!.slice(0, 25) + "…";
  const rest = words.join(" ");
  const secondLine = rest.length > 26 ? rest.slice(0, 25) + "…" : rest;
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
            {firstLine}
          </text>
          <text x="0" y="-39" textAnchor="middle" fill="#193c46" fontSize="10">
            {secondLine}
          </text>
        </g>
      )}
    </g>
  );
}
function CityView({ room }: { room: Room }) {
  const m = room.mission;
  const [visibleMessage, setVisibleMessage] = useState<RadioMessage>();
  const latestMessage = room.messages?.[room.messages.length - 1];
  useEffect(() => {
    setVisibleMessage(latestMessage);
    const timer = setTimeout(() => setVisibleMessage(undefined), 10000);
    return () => clearTimeout(timer);
  }, [latestMessage?.id]);
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
        aria-label={`Daytime city boulevard. ${m ? m.crisis.title : "Squad at dispatch headquarters"}`}
      >
        <defs>
          <linearGradient id="day-sky" x2="0" y2="1">
            <stop stopColor="#29bce5" />
            <stop offset="1" stopColor="#c4f5ec" />
          </linearGradient>
          <linearGradient id="day-grass" x2="0" y2="1">
            <stop stopColor="#abd86f" />
            <stop offset="1" stopColor="#70b856" />
          </linearGradient>
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
            <stop stopColor="#adc291" />
            <stop offset="1" stopColor="#94b77a" />
          </linearGradient>
          <radialGradient id="tree-light" cx=".3" cy=".2">
            <stop stopColor="#b8e843" />
            <stop offset="1" stopColor="#4a9f34" />
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
        <rect width="720" height="580" fill="url(#day-sky)" />
        <g fill="#f1fff6" opacity=".65">
          <ellipse cx="120" cy="78" rx="42" ry="10" />
          <ellipse cx="142" cy="71" rx="22" ry="15" />
          <ellipse cx="570" cy="117" rx="44" ry="9" />
          <ellipse cx="550" cy="110" rx="22" ry="12" />
        </g>
        <circle cx="625" cy="55" r="26" fill="#fff6b1" opacity=".65" />
        {Array.from({ length: 18 }, (_, i) => {
          const x = i * 42,
            height = 40 + ((i * 37) % 100);
          return (
            <g key={i} opacity={i % 3 === 0 ? 0.6 : 0.4}>
              <rect
                x={x}
                y={220 - height}
                width="32"
                height={height}
                fill={i % 2 ? "#65b9ca" : "#c7dfbc"}
              />
              {[0, 1, 2].map((n) => (
                <path
                  key={n}
                  d={`M${x + 6 + n * 9} ${228 - height}v${height - 15}`}
                  stroke="#dcf5e6"
                  strokeWidth="3"
                />
              ))}
            </g>
          );
        })}
        <path d="M355 40v105m-7-20 7-50 8 50" fill="#378da9" stroke="#378da9" />
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
          fill="#8b9c74"
        />
        <polygon
          points={face([
            [650, 0, 0],
            [650, 650, 0],
            [650, 650, -20],
            [650, 0, -20],
          ])}
          fill="#7c926c"
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
          fill="#e4dfbd"
        />
        <polygon
          points={face([
            [0, 270],
            [650, 270],
            [650, 350],
            [0, 350],
          ])}
          fill="#e4dfbd"
        />
        <polygon
          points={face([
            [325, 0],
            [385, 0],
            [385, 650],
            [325, 650],
          ])}
          fill="#60717d"
        />
        <polygon
          points={face([
            [0, 280],
            [650, 280],
            [650, 340],
            [0, 340],
          ])}
          fill="#60717d"
        />
        <polyline
          points={face([
            [355, 0],
            [355, 650],
          ])}
          stroke="#f5f5dc"
          strokeWidth="1.5"
          strokeDasharray="7 10"
        />
        <polyline
          points={face([
            [0, 310],
            [650, 310],
          ])}
          stroke="#f5f5dc"
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
              fill="#fff9e1"
            />
            <polygon
              points={face([
                [327, 360 + i * 5],
                [383, 360 + i * 5],
                [383, 363 + i * 5],
                [327, 363 + i * 5],
              ])}
              fill="#fff9e1"
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
          [285, 40],
          [420, 50],
          [285, 130],
          [420, 135],
          [285, 215],
          [420, 215],
          [290, 405],
          [415, 500],
          [285, 590],
          [420, 590],
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
                cx={top.x - 12}
                cy={top.y + 2}
                rx="12"
                ry="15"
                fill="url(#tree-light)"
              />
              <ellipse
                cx={top.x + 12}
                cy={top.y + 2}
                rx="13"
                ry="16"
                fill="url(#tree-light)"
              />
              <ellipse
                cx={top.x - 4}
                cy={top.y - 7}
                rx="8"
                ry="11"
                fill="#daf476"
                opacity=".4"
              />
            </g>
          );
        })}
        <CityBuilding
          building={{
            ...districts[0],
            name: "",
            icon: "",
            x: 12,
            y: 20,
            w: 100,
            h: 195,
            facade: "#ffe4a0",
            side: "#cdb467",
          }}
          active={false}
        />
        <CityBuilding
          building={{
            ...districts[2],
            name: "",
            icon: "",
            x: 530,
            y: 35,
            w: 105,
            h: 170,
            facade: "#3c91b9",
            side: "#246383",
          }}
          active={false}
        />
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
        <g
          transform={`translate(${project(350, 585).x},${project(350, 585).y})`}
        >
          <ellipse cy="12" rx="16" ry="8" fill="#0003" />
          <path d="M-12-13l19 2 9 13-4 15-23-2-5-13Z" fill="#bc3740" />
          <path d="M-8-9l12 1 7 9-19-2Z" fill="#235970" />
          <path d="M-10 12l19 2" stroke="#ffb29e" strokeWidth="3" />
        </g>
        {room.players.map((p, i) => (
          <SquadActor
            key={`${p.id}:${m?.id}:${m?.round}`}
            player={p}
            index={i}
            mission={m}
            destination={destination}
            speech={
              visibleMessage?.playerId === p.id
                ? visibleMessage.text
                : undefined
            }
          />
        ))}
        <text x="28" y="555" fill="#2b595b" fontSize="10" letterSpacing="2">
          MERIDIAN EMERGENCY RESPONSE NETWORK
        </text>
      </svg>
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
function SquadRadio({
  room,
  me,
  connected,
}: {
  room: Room;
  me: string;
  connected: boolean;
}) {
  const [draft, setDraft] = useState(""),
    [sending, setSending] = useState(false),
    [error, setError] = useState("");
  const active = room.status === "playing";
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (follow.current && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [room.messages?.length, room.messages?.[room.messages.length - 1]?.id]);
  const transmit = (text: string) => {
    if (!active || !text.trim() || sending || !connected) return;
    setSending(true);
    setError("");
    socket
      .timeout(5000)
      .emit(
        "send_message",
        { text },
        (err: Error | null, response: { ok: boolean; error?: string }) => {
          setSending(false);
          if (err || !response?.ok) {
            setError(
              response?.error ||
                "Message could not be confirmed. Check the radio before retrying.",
            );
            return;
          }
          setDraft("");
          follow.current = true;
          if (log.current) log.current.scrollTop = log.current.scrollHeight;
        },
      );
  };
  return (
    <section className="radio-panel" aria-label="Squad communication">
      <div className="radio-header">
        <div>
          <span className="eyebrow">LIVE SQUAD RADIO</span>
          <h3>Talk to your team</h3>
        </div>
        <span className="signal-dot" />
      </div>
      <p className="note">
        {active ? "Coordinate here, then choose your action. The ★ leader is the room host." : room.status === "complete" ? "Mission complete. Chat is closed; conversation history remains below." : "Chat opens when the host starts the mission."}
      </p>
      <div
        className="radio-log"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        ref={log}
        onScroll={() => {
          const el = log.current;
          if (el)
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 35;
        }}
      >
        {!room.messages?.length && (
          <p className="radio-empty">
            {active ? "Your channel is open. Try “Team, do you copy?” or ask your leader what to do." : "No mission messages yet."}
          </p>
        )}
        {room.messages?.map((message) => (
          <article
            className={`radio-message ${message.playerId === me ? "mine" : ""}`}
            key={message.id}
          >
            <div>
              <strong>
                {message.name}
                {message.leader ? " ★ Leader" : ""}
              </strong>
              <time dateTime={new Date(message.sentAt * 1000).toISOString()}>
                {new Date(message.sentAt * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          transmit(draft);
        }}
      >
        <label htmlFor="radio-message">Message your squad</label>
        <textarea
          id="radio-message"
          value={draft}
          maxLength={240}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Copy. What should we do here?"
          disabled={!active || !connected || sending}
        />
        <div className="radio-compose">
          <span>{draft.length}/240</span>
          <button
            disabled={!active || !connected || sending || !draft.trim()}
            type="submit"
          >
            {sending ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>
      <div className="radio-quick">
        <button
          disabled={!active || !connected || sending}
          onClick={() => setDraft("Copy, loud and clear.")}
        >
          Copy
        </button>
        <button
          disabled={!active || !connected || sending}
          onClick={() => setDraft("What should we do here?")}
        >
          Ask for direction
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function RoomCode({ code }: { code: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const manual = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (status === "manual") {
      manual.current?.focus();
      manual.current?.select();
    }
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      setStatus("manual");
      manual.current?.focus();
      manual.current?.select();
    }
  };
  return (
    <div className="room-code-share">
      <div className="eyebrow">ROOM CODE</div>
      <div className="room-code-row">
        <h2 className="code">{code}</h2>
        <button
          type="button"
          className="copy-code"
          onClick={copy}
          aria-label="Copy room code"
          title={status === "copied" ? "Copied!" : "Copy room code"}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {status === "copied" ? <path d="m6 14 5 5L22 8"/> : <><rect x="10" y="3" width="15" height="18" rx="4"/><rect x="3" y="10" width="15" height="15" rx="4" className="copy-icon-front"/></>}
          </svg>
        </button>
      </div>
      <span className="copy-feedback" role="status">
        {status === "copied"
          ? "Room code copied. Share it with your squad."
          : ""}
      </span>
      {status === "manual" && (
        <label className="manual-copy">
          Clipboard unavailable. Copy the selected code:
          <input
            ref={manual}
            value={code}
            readOnly
            aria-label="Room code for manual copying"
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </div>
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
      {room && (
        <div className="city-column">
          <CityView room={room} />
          <SquadRadio room={room} me={me} connected={connected} />
        </div>
      )}
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
            <RoomCode key={room.code} code={room.code} />
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
