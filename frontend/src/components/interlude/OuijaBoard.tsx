/**
 * The Ouija board and its planchette (Spec 4 section 9). An original SVG: nothing here is a trademarked board.
 *
 * The planchette is driven by the interlude machine, never by chance: it follows PLANCHETTE_ROUTE, one waypoint per step. The
 * letters are only decoration of the fiction. They are not evidence and carry no information about the repository.
 */

import { PLANCHETTE_ROUTE } from "../../features/interlude/interludeMachine";

const ROW_ONE = "ABCDEFGHIJKLM".split("");
const ROW_TWO = "NOPQRSTUVWXYZ".split("");
const NUMBERS = "1234567890".split("");
const CENTER_X = 450;
const ARC_CENTER_Y = 600;

function onArc(index: number, count: number, radius: number): { x: number; y: number } {
  const angle = ((150 - (index * 120) / (count - 1)) * Math.PI) / 180;
  return { x: CENTER_X + radius * Math.cos(angle), y: ARC_CENTER_Y - radius * Math.sin(angle) };
}

export const REST = { x: 450, y: 392 };

export function waypoint(name: string): { x: number; y: number } {
  if (name === "rest") return REST;
  const one = ROW_ONE.indexOf(name);
  if (one >= 0) return onArc(one, ROW_ONE.length, 360);
  const two = ROW_TWO.indexOf(name);
  if (two >= 0) return onArc(two, ROW_TWO.length, 285);
  return REST;
}

export interface OuijaBoardProps {
  step: number;
  /** True once the board has settled. */
  settled: boolean;
  /** The board is dimmed while something interrupts it. */
  dim: boolean;
  reducedMotion: boolean;
}

export function OuijaBoard({ step, settled, dim, reducedMotion }: OuijaBoardProps) {
  const target = waypoint(PLANCHETTE_ROUTE[Math.min(step, PLANCHETTE_ROUTE.length - 1)] ?? "rest");
  return (
    <svg
      className="il-board"
      viewBox="0 0 900 600"
      role="img"
      aria-label="A spirit board with the alphabet in two arcs, numbers, YES, NO and GOODBYE. A planchette rests on it."
      data-testid="board"
      data-settled={settled}
      data-dim={dim}
      data-reduced={reducedMotion}
    >
      <defs>
        <linearGradient id="il-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a2819" />
          <stop offset="0.5" stopColor="#2a1d14" />
          <stop offset="1" stopColor="#33231a" />
        </linearGradient>
        <radialGradient id="il-glow" cx="0.5" cy="0.62" r="0.7">
          <stop offset="0" stopColor="#d98a2b" stopOpacity="0.22" />
          <stop offset="1" stopColor="#d98a2b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="10" y="10" width="880" height="580" rx="26" fill="url(#il-wood)" stroke="#c8a14a" strokeOpacity="0.55" strokeWidth="3" />
      <rect x="28" y="28" width="844" height="544" rx="18" fill="none" stroke="#c8a14a" strokeOpacity="0.28" strokeWidth="1.5" />
      <rect x="10" y="10" width="880" height="580" rx="26" fill="url(#il-glow)" className="il-candle" />

      <g className="il-ink" fontFamily="Palatino Linotype, Palatino, Georgia, serif" textAnchor="middle" fill="#d9ccb2">
        <text x="150" y="130" fontSize="44" letterSpacing="4">YES</text>
        <text x="750" y="130" fontSize="44" letterSpacing="4">NO</text>
        <circle cx="450" cy="92" r="26" fill="none" stroke="#c8a14a" strokeOpacity="0.7" strokeWidth="2" />
        <path d="M450 70 L458 90 L480 92 L463 106 L468 128 L450 116 L432 128 L437 106 L420 92 L442 90 Z" fill="#c8a14a" fillOpacity="0.55" />
        {ROW_ONE.map((letter, index) => {
          const p = onArc(index, ROW_ONE.length, 360);
          return <text key={letter} x={p.x} y={p.y + 11} fontSize="32">{letter}</text>;
        })}
        {ROW_TWO.map((letter, index) => {
          const p = onArc(index, ROW_TWO.length, 285);
          return <text key={letter} x={p.x} y={p.y + 11} fontSize="32">{letter}</text>;
        })}
        {NUMBERS.map((digit, index) => (
          <text key={digit} x={250 + index * 44} y={500} fontSize="30">{digit}</text>
        ))}
        <text x="450" y="560" fontSize="34" letterSpacing="8">GOODBYE</text>
      </g>

      <g
        className="il-planchette"
        data-testid="planchette"
        data-step={step}
        style={{ transform: `translate(${target.x}px, ${target.y}px)` }}
      >
        <path d="M0 -62 C44 -62 62 -12 50 34 C38 68 -38 68 -50 34 C-62 -12 -44 -62 0 -62 Z" fill="#1c140e" stroke="#c8a14a" strokeWidth="3" strokeOpacity="0.8" />
        <circle cx="0" cy="-8" r="19" fill="#0b0a0c" fillOpacity="0.55" stroke="#e2bd68" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
