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

  // Score & lives live here so the game loop can mutate them
  // without setState. React reads them via hudSnapshot polling.
  score: number;
  lives: number;
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

  score: 0,
  lives: 3,
});

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
  world.score = WORLD_DEFAULTS.score;
  world.lives = WORLD_DEFAULTS.lives;

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
