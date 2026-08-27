/**
 * engine/state.ts — Module-level mutable game world.
 *
 * All per-frame entity data lives here. The game loop reads/writes this
 * directly; GameCanvas reads it directly for rendering. React never
 * sees these mutations, so zero reconciliation overhead per frame.
 *
 * PERF: This is a plain object — no Proxy, no getters, no reactivity.
 * Closures that capture `world` always see the latest data because it's
 * a stable module-level reference whose *properties* are mutated in place.
 */

import type {
  Ball,
  Paddle,
  Brick,
  Enemy,
  Bomb,
  Explosion,
  PowerUp,
  Bullet,
  BonusLetter,
  Boss,
  BossAttack,
  ShieldImpact,
} from "@/types/game";
import { explosionPool } from "@/utils/entityPool";
import type { DangerBall } from "@/utils/megaBossAttacks";

// ─── Visual-effect sub-types (inline, no separate file needed) ───

export interface LaserWarning {
  x: number;
  startTime: number;
}

export interface SuperWarning {
  x: number;
  y: number;
  startTime: number;
}

export interface BulletImpact {
  x: number;
  y: number;
  startTime: number;
  isSuper: boolean;
}

// ─── Score Popup ──────────────────────────────────────────────────

/** A single floating score number. Lifetime is wall-clock based so hitstop does not affect it. */
export interface ScorePopup {
  active: boolean;
  x: number;
  y: number;
  value: number;
  text: string;
  startTime: number; // performance.now()
  life: number;      // total lifetime in ms (e.g. 800)
}

const MAX_SCORE_POPUPS = 24;

/** Pre-allocate the full popup pool once; no per-spawn allocation. */
function createPopupPool(): ScorePopup[] {
  const pool: ScorePopup[] = [];
  for (let i = 0; i < MAX_SCORE_POPUPS; i++) {
    pool.push({ active: false, x: 0, y: 0, value: 0, text: "", startTime: 0, life: 800 });
  }
  return pool;
}

export interface PendingPowerUpDrop {
  brickId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  powerUps: PowerUp[];
  createdAtSimMs: number;
  spawnAtSimMs: number;
}

// ─── The World ───────────────────────────────────────────────────

export interface GameWorld {
  // Entity arrays (hot — mutated every frame)
  balls: Ball[];
  paddle: Paddle | null;
  bricks: Brick[];
  enemies: Enemy[];
  bombs: Bomb[];
  explosions: Explosion[];
  powerUps: PowerUp[];
  pendingPowerUpDrops: PendingPowerUpDrop[];
  bullets: Bullet[];
  bonusLetters: BonusLetter[];
  boss: Boss | null;
  resurrectedBosses: Boss[];
  bossAttacks: BossAttack[];
  dangerBalls: DangerBall[];

  // Visual-effect arrays (hot)
  laserWarnings: LaserWarning[];
  superWarnings: SuperWarning[];
  shieldImpacts: ShieldImpact[];
  bulletImpacts: BulletImpact[];

  // Numeric / flag state (hot — mutated every frame)
  screenShake: number;
  backgroundFlash: number;
  highlightFlash: number;
  backgroundPhase: number;
  launchAngle: number;
  speedMultiplier: number;
  brickHitSpeedAccumulated: number;
  enemiesKilled: number;
  enemySpawnCount: number;
  lastEnemySpawnTime: number;
  lastBossSpawnTime: number;
  bossHitCooldown: number;
  bossActive: boolean;
  backgroundHue: number;

  // Accumulated simulation time. Incremented each physics frame by dtSeconds.
  // Use this for game-logic timers that must pause correctly and be FPS-independent.
  simTimeSeconds: number; // floating-point seconds since level start
  simTimeMs: number;      // integer milliseconds (Math.floor(simTimeSeconds * 1000)), for convenience

  // Render-interpolation timing (written by physics loop, read by render loop)
  lastPhysicsUpdateTime: number; // performance.now() timestamp of last physics frame
  lastPhysicsDtMs: number;       // wall-clock ms the last physics step covered

  // Score & lives live here so the game loop can mutate them
  // without setState. React reads them via hudSnapshot polling.
  score: number;
  lives: number;
  levelStartDestructibleCount: number;
  bricksSinceLastPowerUp: number;
  guaranteeNextEligiblePowerUpDrop: boolean;
  halfwayEventTriggered: boolean;
  levelOneOpeningGuaranteedDropPending: boolean;
  levelOneOpeningDropDeadlineMs: number;

  // Hitstop: simulation is frozen for entity movement until simTimeMs reaches this value
  hitstopUntilSimMs: number;

  // Floating score popups (preallocated pool, MAX_SCORE_POPUPS slots)
  scorePopups: ScorePopup[];
}

/** Default values — used by resetWorld() and as initial state. */
const WORLD_DEFAULTS: Readonly<GameWorld> = Object.freeze({
  balls: [],
  paddle: null,
  bricks: [],
  enemies: [],
  bombs: [],
  explosions: [],
  powerUps: [],
  pendingPowerUpDrops: [],
  bullets: [],
  bonusLetters: [],
  boss: null,
  resurrectedBosses: [],
  bossAttacks: [],
  dangerBalls: [],

  laserWarnings: [],
  superWarnings: [],
  shieldImpacts: [],
  bulletImpacts: [],

  screenShake: 0,
  backgroundFlash: 0,
  highlightFlash: 0,
  backgroundPhase: 0,
  launchAngle: -20,
  speedMultiplier: 1.05,
  brickHitSpeedAccumulated: 0,
  enemiesKilled: 0,
  enemySpawnCount: 0,
  lastEnemySpawnTime: 0,
  lastBossSpawnTime: 0,
  bossHitCooldown: 0,
  bossActive: false,
  backgroundHue: 0,

  simTimeSeconds: 0,
  simTimeMs: 0,

  lastPhysicsUpdateTime: 0,
  lastPhysicsDtMs: 1000 / 60,

  score: 0,
  lives: 3,
  levelStartDestructibleCount: 0,
  bricksSinceLastPowerUp: 0,
  guaranteeNextEligiblePowerUpDrop: false,
  halfwayEventTriggered: false,
  levelOneOpeningGuaranteedDropPending: false,
  levelOneOpeningDropDeadlineMs: 0,

  hitstopUntilSimMs: 0,

  scorePopups: [], // replaced with preallocated pool in freshArrays
});

// The actual mutable world instance — below, after WORLD_DEFAULTS is defined.

/**
 * The single mutable game world instance.
 * Import this anywhere — it's always the same object reference.
 */
export const world: GameWorld = { ...WORLD_DEFAULTS } as GameWorld;

// Need mutable arrays (frozen defaults have immutable array refs)
function freshArrays(): void {
  world.balls = [];
  world.paddle = null;
  world.bricks = [];
  world.enemies = [];
  world.bombs = [];
  world.explosions = [];
  world.powerUps = [];
  world.pendingPowerUpDrops = [];
  world.bullets = [];
  world.bonusLetters = [];
  world.boss = null;
  world.resurrectedBosses = [];
  world.bossAttacks = [];
  world.dangerBalls = [];
  world.laserWarnings = [];
  world.superWarnings = [];
  world.shieldImpacts = [];
  world.bulletImpacts = [];
  // Preallocate scorePopups pool once; on subsequent calls just deactivate slots
  if (!world.scorePopups || world.scorePopups.length === 0) {
    world.scorePopups = createPopupPool();
  } else {
    for (const p of world.scorePopups) p.active = false;
  }
}

/**
 * Reset world to clean defaults. Call on new game / level transition.
 * Optionally pass overrides (e.g., `{ lives: 5, speedMultiplier: 1.1 }`).
 */
export function resetWorld(overrides?: Partial<GameWorld>): void {
  // Copy scalar defaults
  world.screenShake = WORLD_DEFAULTS.screenShake;
  world.backgroundFlash = WORLD_DEFAULTS.backgroundFlash;
  world.highlightFlash = WORLD_DEFAULTS.highlightFlash;
  world.backgroundPhase = WORLD_DEFAULTS.backgroundPhase;
  world.launchAngle = WORLD_DEFAULTS.launchAngle;
  world.speedMultiplier = WORLD_DEFAULTS.speedMultiplier;
  world.brickHitSpeedAccumulated = WORLD_DEFAULTS.brickHitSpeedAccumulated;
  world.enemiesKilled = WORLD_DEFAULTS.enemiesKilled;
  world.enemySpawnCount = WORLD_DEFAULTS.enemySpawnCount;
  world.lastEnemySpawnTime = WORLD_DEFAULTS.lastEnemySpawnTime;
  world.lastBossSpawnTime = WORLD_DEFAULTS.lastBossSpawnTime;
  world.bossHitCooldown = WORLD_DEFAULTS.bossHitCooldown;
  world.bossActive = WORLD_DEFAULTS.bossActive;
  world.backgroundHue = WORLD_DEFAULTS.backgroundHue;
  world.simTimeSeconds = WORLD_DEFAULTS.simTimeSeconds;
  world.simTimeMs = WORLD_DEFAULTS.simTimeMs;
  world.lastPhysicsUpdateTime = WORLD_DEFAULTS.lastPhysicsUpdateTime;
  world.lastPhysicsDtMs = WORLD_DEFAULTS.lastPhysicsDtMs;
  world.score = WORLD_DEFAULTS.score;
  world.lives = WORLD_DEFAULTS.lives;
  world.levelStartDestructibleCount = WORLD_DEFAULTS.levelStartDestructibleCount;
  world.bricksSinceLastPowerUp = WORLD_DEFAULTS.bricksSinceLastPowerUp;
  world.guaranteeNextEligiblePowerUpDrop = WORLD_DEFAULTS.guaranteeNextEligiblePowerUpDrop;
  world.halfwayEventTriggered = WORLD_DEFAULTS.halfwayEventTriggered;
  world.levelOneOpeningGuaranteedDropPending = WORLD_DEFAULTS.levelOneOpeningGuaranteedDropPending;
  world.levelOneOpeningDropDeadlineMs = WORLD_DEFAULTS.levelOneOpeningDropDeadlineMs;
  world.hitstopUntilSimMs = WORLD_DEFAULTS.hitstopUntilSimMs;

  // Fresh mutable arrays
  freshArrays();

  // Release pooled explosions back to pool
  explosionPool.releaseAll();

  // Apply caller overrides last
  if (overrides) {
    Object.assign(world, overrides);
  }
}

// Initialise with fresh arrays on module load
freshArrays();

// ─── Hitstop helper ──────────────────────────────────────────────

/**
 * Freeze entity movement for `ms` milliseconds.
 * The simulation clock still advances; only entity movement/collision is skipped.
 * Safe to call multiple times — takes the longer of current and new duration.
 */
export function triggerHitstop(ms: number): void {
  const end = world.simTimeMs + ms;
  if (end > world.hitstopUntilSimMs) {
    world.hitstopUntilSimMs = end;
  }
}

export function isHitstopActive(): boolean {
  return world.simTimeMs < world.hitstopUntilSimMs;
}

// ─── Score popup helpers ─────────────────────────────────────────

/**
 * Spawn a floating score popup at (x, y).
 * Uses the preallocated pool; evicts the oldest active slot if full.
 * `text` is displayed as-is (e.g. "+250" or "+250 ×3!").
 */
export function spawnScorePopup(x: number, y: number, value: number, text: string): void {
  const pool = world.scorePopups;
  // Find an inactive slot first
  let slot: ScorePopup | null = null;
  let oldestSlot: ScorePopup | null = null;
  let oldestStart = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.active) {
      slot = p;
      break;
    }
    if (p.startTime < oldestStart) {
      oldestStart = p.startTime;
      oldestSlot = p;
    }
  }
  if (!slot) slot = oldestSlot;
  if (!slot) return;

  slot.active = true;
  slot.x = x;
  slot.y = y;
  slot.value = value;
  slot.text = text;
  slot.startTime = performance.now();
  slot.life = 800;
}
