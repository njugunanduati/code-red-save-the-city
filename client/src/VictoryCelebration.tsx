import { useEffect, useState, type CSSProperties } from "react";

const colors = ["#ffd36a", "#5ce6c4", "#75cfff", "#ff817b", "#c7a5ff"];
// Stable positions avoid regenerating the burst on ordinary room updates.
const pieces = Array.from({ length: 60 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  color: colors[i % colors.length],
  delay: `${(i % 12) * 0.07}s`,
  duration: `${2.8 + (i % 7) * 0.2}s`,
  drift: `${((i * 53) % 220) - 110}px`,
  rotation: `${180 + (i % 5) * 135}deg`,
}));

export function VictoryCelebration({
  mission,
  resolved,
  total,
}: {
  mission: number;
  resolved: number;
  total: number;
}) {
  const [celebrating, setCelebrating] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setCelebrating(false), 5500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="victory-panel" aria-label="Mission victory">
      {celebrating && (
        <div className="victory-confetti" aria-hidden="true">
          <div className="victory-splash splash-left" />
          <div className="victory-splash splash-right" />
          {pieces.map((piece, i) => (
            <span
              key={i}
              style={
                {
                  left: piece.left,
                  backgroundColor: piece.color,
                  animationDelay: piece.delay,
                  animationDuration: piece.duration,
                  "--confetti-drift": piece.drift,
                  "--confetti-turn": piece.rotation,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="victory-trophy" aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient
              id="victory-gold"
              x1="30"
              y1="18"
              x2="87"
              y2="95"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#fff1a8" />
              <stop offset=".5" stopColor="#ffd05c" />
              <stop offset="1" stopColor="#c77b20" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="58" r="49" fill="#ffd36a" opacity=".08" />
          <path
            d="M34 31H18v12c0 15 10 23 25 23m43-35h16v12c0 15-10 23-25 23"
            stroke="#efb746"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M31 22h58v23c0 22-12 36-29 36S31 67 31 45V22Z"
            fill="url(#victory-gold)"
          />
          <path
            d="M41 30v17c0 11 3 18 8 23"
            stroke="#fff7cd"
            strokeWidth="5"
            strokeLinecap="round"
            opacity=".65"
          />
          <path
            d="m60 34 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2 5-10Z"
            fill="#fff7ce"
          />
          <path d="M55 78h10v15H55z" fill="#eab047" />
          <path d="M43 92h34v8H43z" fill="#ffd36a" />
          <rect x="35" y="100" width="50" height="9" rx="3" fill="#c99239" />
          <path
            d="m16 12 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Zm85 63 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"
            fill="#fff1a8"
          />
        </svg>
      </div>
      <div role="status" aria-live="polite">
        <span className="victory-eyebrow">
          SQUAD VICTORY · MISSION {mission}
        </span>
        <h2>City saved!</h2>
        <p>Your teamwork kept Meridian City standing.</p>
        <p className="victory-score">
          {resolved} of {total} emergencies resolved
        </p>
      </div>
      {celebrating && (
        <button
          className="stop-confetti"
          type="button"
          onClick={() => setCelebrating(false)}
        >
          Stop confetti
        </button>
      )}
    </section>
  );
}
