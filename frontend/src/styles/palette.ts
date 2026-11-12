/**
 * The declared palette. The CSS custom properties in index.css repeat these values. A test (tests/contrast.test.ts) checks
 * that every text and surface pair used for reading meets the contrast thresholds, and that the CSS and this file agree.
 *
 * Direction (Spec 3 section 6): charcoal and near-black surfaces, aged wood, bone and antique ivory text, antique gold detail,
 * and a restrained dark-red accent. Spec 2 section 5.3: the interface must not be excessively dark, so the reading surfaces
 * are charcoal (not black) and the text is ivory.
 */

export const palette = {
  // Surfaces
  void: "#0b0a0c",
  charcoal: "#1a181b",
  charcoalRaised: "#232025",
  woodDark: "#2a1d14",
  wood: "#3a2819",
  // Text
  ivory: "#f1e8d4",
  bone: "#d9ccb2",
  boneDim: "#b3a78f",
  // Accents
  gold: "#c8a14a",
  goldBright: "#e2bd68",
  blood: "#6e1d1d",
  bloodText: "#e07a6a",
  amber: "#d98a2b",
  // States
  ok: "#8fbf86",
  warn: "#e2bd68",
  danger: "#e07a6a",
} as const;

export type PaletteKey = keyof typeof palette;

/** Text and background pairs used for reading, with the minimum contrast ratio each must meet (WCAG 2.2 AA). */
export const readingPairs: { name: string; fg: PaletteKey; bg: PaletteKey; min: number }[] = [
  { name: "body text on charcoal", fg: "ivory", bg: "charcoal", min: 4.5 },
  { name: "body text on raised charcoal", fg: "ivory", bg: "charcoalRaised", min: 4.5 },
  { name: "secondary text on charcoal", fg: "bone", bg: "charcoal", min: 4.5 },
  { name: "secondary text on raised charcoal", fg: "bone", bg: "charcoalRaised", min: 4.5 },
  { name: "dim text on charcoal", fg: "boneDim", bg: "charcoal", min: 4.5 },
  { name: "dim text on raised charcoal", fg: "boneDim", bg: "charcoalRaised", min: 4.5 },
  { name: "gold on charcoal", fg: "gold", bg: "charcoal", min: 4.5 },
  { name: "bright gold on raised charcoal", fg: "goldBright", bg: "charcoalRaised", min: 4.5 },
  { name: "red text on charcoal", fg: "bloodText", bg: "charcoal", min: 4.5 },
  { name: "red text on raised charcoal", fg: "bloodText", bg: "charcoalRaised", min: 4.5 },
  { name: "ivory on wood", fg: "ivory", bg: "wood", min: 4.5 },
  { name: "ivory on dark wood", fg: "ivory", bg: "woodDark", min: 4.5 },
  { name: "ivory on void (scene stage)", fg: "ivory", bg: "void", min: 4.5 },
  { name: "bone on void (scene stage)", fg: "bone", bg: "void", min: 4.5 },
  { name: "ok on charcoal", fg: "ok", bg: "charcoal", min: 4.5 },
  { name: "warn on charcoal", fg: "warn", bg: "charcoal", min: 4.5 },
  { name: "danger on charcoal", fg: "danger", bg: "charcoal", min: 4.5 },
  { name: "focus ring (gold bright) on charcoal", fg: "goldBright", bg: "charcoal", min: 3 },
  { name: "focus ring (gold bright) on void", fg: "goldBright", bg: "void", min: 3 },
];

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a 6-digit hex color: ${hex}`);
  const value = parseInt(match[1] as string, 16);
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
