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

/** Call at game start, level start, respawn, retry, boss-rush stage change. Resets everything speed-related. */
export function setLevelSpeed(m: number, maxTotalSpeed: number): void {
  const f = levelSpeedFactor(m);
  world.levelBaseSpeedFactor = f;
  world.speedMultiplier = f;
  world.brickHitSpeedAccumulated = 0; // boost target (fraction)
  world.speedBoostApplied = 0; // eased boost actually applied
  world.speedBoostCap = Math.max(0, maxTotalSpeed - m);
}

/** Call once per physics frame before CCD. */
export function easeSpeedBoost(dtSeconds: number): void {
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
