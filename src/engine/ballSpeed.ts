import { world } from "@/engine/state";
import type { Ball } from "@/types/game";

export const BALL_BASE_SPEED = 4.5; // px per 60 Hz frame at factor 1.0
export const SLOWDOWN_SCALE = 0.85; // slowdown power-up: base factor x0.85
export const SLOWDOWN_FLOOR = 0.8; // never below 0.8 x level base factor
export const BOOST_EASE_SECONDS = 0.15; // brick-hit boost eases in instead of jumping

/** Legacy-compatible level factor: today's real speed is m*m. */
export const levelSpeedFactor = (m: number) => m * m;

/** The ONE number CCD, substeps and HUD use. */
export const getEffectiveSpeedFactor = () => world.speedMultiplier * (1 + world.speedBoostApplied);

export const START_FACTOR_L1 = 1.15;
export const START_FACTOR_L17 = 2.25;
export const END_BOOST_RATIO_L1 = 1.5; // end-of-level total factor = start x this (level 1)
export const END_BOOST_RATIO_L17 = 1.2; // ... at level 17+

/** End-of-level boost ratio: linear L1 -> L17, clamped. */
export function endBoostRatio(level: number): number {
  const t = Math.min(1, Math.max(0, (level - 1) / 16));
  return END_BOOST_RATIO_L1 + (END_BOOST_RATIO_L17 - END_BOOST_RATIO_L1) * t;
}
export const SLOWDOWN_RECOVER_SECONDS = 10;

export type SpeedMode = "normal" | "godlike" | "daily" | "bossRush";

/**
 * Start speed factor for a level. Normal: linear L1 -> L17 (clamped).
 * Other modes keep their legacy result (legacyMultiplier squared).
 */
export function levelStartFactor(level: number, mode: SpeedMode, legacyMultiplier = 1): number {
  if (mode !== "normal") return levelSpeedFactor(legacyMultiplier);
  const t = Math.min(1, Math.max(0, (level - 1) / 16));
  return START_FACTOR_L1 + (START_FACTOR_L17 - START_FACTOR_L1) * t;
}

let slowdownRecoverRate = 0; // scale units per second while a slowdown is recovering

/**
 * Call at game start, level start, respawn, retry, boss-rush stage change. Resets everything speed-related.
 * startFactor is the level start factor. Non-normal modes pass maxTotalSpeed (legacy cap logic).
 */
export function setLevelSpeed(startFactor: number, maxTotalSpeed: number | null = null, level = 1): void {
  world.levelBaseSpeedFactor = startFactor;
  world.speedMultiplier = startFactor;
  world.brickHitSpeedAccumulated = 0; // boost target (fraction)
  world.speedBoostApplied = 0; // eased boost actually applied
  world.speedBoostCap =
    maxTotalSpeed === null
      ? Math.max(0, endBoostRatio(level) - 1)
      : Math.max(0, maxTotalSpeed - Math.sqrt(startFactor));
  slowdownRecoverRate = 0;
  console.log(
    `[BallSpeed] level start: startFactor=${startFactor.toFixed(3)} cap=${world.speedBoostCap.toFixed(3)}`,
  );
}

/** Call once per physics frame before CCD. */
export function easeSpeedBoost(dtSeconds: number): void {
  if (slowdownRecoverRate > 0) {
    const base = world.levelBaseSpeedFactor;
    if (world.speedMultiplier < base) {
      world.speedMultiplier = Math.min(base, world.speedMultiplier + slowdownRecoverRate * dtSeconds);
    }
    if (world.speedMultiplier >= base) slowdownRecoverRate = 0;
  }
  const diff = world.brickHitSpeedAccumulated - world.speedBoostApplied;
  if (Math.abs(diff) < 1e-4) {
    world.speedBoostApplied = world.brickHitSpeedAccumulated;
    return;
  }
  world.speedBoostApplied += diff * (1 - Math.exp(-dtSeconds / BOOST_EASE_SECONDS));
}

export function applySlowdown(): void {
  world.speedMultiplier = Math.max(
    world.speedMultiplier * SLOWDOWN_SCALE,
    world.levelBaseSpeedFactor * SLOWDOWN_FLOOR,
  );
  // Restart linear recovery to the base factor from the new (lower) value
  slowdownRecoverRate = (world.levelBaseSpeedFactor - world.speedMultiplier) / SLOWDOWN_RECOVER_SECONDS;
}

/** Set |v| to BASE * rampScale, keeping direction. Skips waitingToLaunch balls and zero vectors. */
export function normalizeBallSpeed(ball: Ball, rampScale = 1): void {
  if (ball.waitingToLaunch) return;
  const mag = Math.hypot(ball.dx, ball.dy);
  if (mag < 1e-6) return;
  const k = (BALL_BASE_SPEED * rampScale) / mag;
  ball.dx *= k;
  ball.dy *= k;
}

/** Multiball: rotate the direction, never change |v|. */
export function splitDirection(dx: number, dy: number, degrees: number): { dx: number; dy: number } {
  const a = (degrees * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return { dx: dx * c - dy * s, dy: dx * s + dy * c };
}
