/**
 * engine/hudSnapshot.ts — Throttled bridge between engine and React HUD.
 *
 * The game loop writes to `hudSnapshot` every frame (cheap — just scalar
 * assignments). React polls this object on a setInterval (100-166 ms ≈
 * 6-10 fps) and batch-updates its own state only when `dirty` is true.
 *
 * This avoids per-frame setState while keeping the HUD visually responsive
 * enough for human perception (~100 ms latency is imperceptible for score
 * and timer displays).
 */

import { getEffectiveSpeedFactor } from "@/engine/ballSpeed";

export interface HUDSnapshot {
  // Core HUD values
  score: number;
  lives: number;
  level: number;
  speedPercent: number;
  timer: number;

  // Boss state
  bossHealth: number;
  bossMaxHealth: number;
  bossHitCooldown: number;
  bossActive: boolean;

  // Paddle info
  turretShots: number;
  hasTurrets: boolean;
  hasShield: boolean;
  hasReflectShield: boolean;

  // Dirty flag — flipped by engine, cleared by React after reading
  dirty: boolean;
}

/**
 * Singleton snapshot. Engine writes, React reads.
 */
export const hudSnapshot: HUDSnapshot = {
  score: 0,
  lives: 0,
  level: 1,
  speedPercent: 105,
  timer: 0,

  bossHealth: 0,
  bossMaxHealth: 0,
  bossHitCooldown: 0,
  bossActive: false,

  turretShots: 0,
  hasTurrets: false,
  hasShield: false,
  hasReflectShield: false,

  dirty: false,
};

/**
 * Call from the game loop after mutating world state.
 * Cheap: just scalar assignments, no allocations.
 */
export function writeHUD(
  score: number,
  lives: number,
  level: number,
  _speedMultiplier: number, // ignored: HUD shows getEffectiveSpeedFactor()
  timer: number,
  bossHealth: number,
  bossMaxHealth: number,
  bossHitCooldown: number,
  bossActive: boolean,
  turretShots: number,
  hasTurrets: boolean,
  hasShield: boolean,
  hasReflectShield: boolean,
): void {
  hudSnapshot.score = score;
  hudSnapshot.lives = lives;
  hudSnapshot.level = level;
  hudSnapshot.speedPercent = Math.round(getEffectiveSpeedFactor() * 100);
  hudSnapshot.timer = timer;
  hudSnapshot.bossHealth = bossHealth;
  hudSnapshot.bossMaxHealth = bossMaxHealth;
  hudSnapshot.bossHitCooldown = bossHitCooldown;
  hudSnapshot.bossActive = bossActive;
  hudSnapshot.turretShots = turretShots;
  hudSnapshot.hasTurrets = hasTurrets;
  hudSnapshot.hasShield = hasShield;
  hudSnapshot.hasReflectShield = hasReflectShield;
  hudSnapshot.dirty = true;
}

/**
 * React hook helper — call after reading snapshot to clear dirty flag.
 */
export function clearHUDDirty(): void {
  hudSnapshot.dirty = false;
}
