/**
 * Light disturbances near the creature, with a hard limit on how fast they may change.
 *
 * Every light holds its state for at least FLICKER_HOLD seconds, so no light changes more than 2.5 times per second. That is
 * below the three-flashes-per-second limit for photosensitive viewers (WCAG 2.3.1), however many lights flicker at once and
 * whatever the seed. The pure function is tested for exactly that.
 */

export const FLICKER_HOLD = 0.4;
/** How dark a light gets in a dropout, as a fraction of its normal brightness. */
export const DROPOUT_LEVEL = 0.2;

/** A deterministic number from 0 to 1 for two integers. */
export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The brightness factor of one light at `time` seconds, when the creature is `near` (0 to 1) it. Far away (near below 0.25)
 * nothing happens. Close, dropouts become likelier, up to a little over half of the time.
 */
export function flickerFactor(time: number, near: number, seed: number): number {
  if (!(near > 0.25)) return 1;
  const slot = Math.floor(time / FLICKER_HOLD);
  return hash(slot, seed) > 1 - 0.55 * Math.min(1, near) ? DROPOUT_LEVEL : 1;
}
