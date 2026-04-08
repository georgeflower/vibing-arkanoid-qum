/**
 * engine/physics.ts — Pure physics frame processor.
 *
 * Extracted from Game.tsx's checkCollision useCallback.
 * Reads from and writes to the `world` singleton directly.
 * Returns a PhysicsFrameResult with events for Game.tsx to apply side effects.
 */

import { world } from "@/engine/state";
import { processBallWithCCD } from "@/utils/gameCCD";
import { PHYSICS_CONFIG, ENABLE_DEBUG_FEATURES } from "@/constants/game";

import { isMegaBoss, type MegaBoss, isBallInsideMegaBoss, applyGravityWellToBall } from "@/utils/megaBossUtils";
import { MEGA_BOSS_LEVEL } from "@/constants/megaBossConfig";
import { BOSS_LEVELS } from "@/constants/bossConfig";
import { collisionHistory } from "@/utils/collisionHistory";
import { startBallTracking } from "@/utils/ballTracker";
import type { Ball, Brick, Boss, Enemy, EnemyType } from "@/types/game";
import type { CCDPerformanceData } from "@/components/CCDPerformanceOverlay";

// ─── Exported Constants (used by Game.tsx debug info getter too) ───

export const BALL_GRAVITY = 0.015;
export const GRAVITY_DELAY_MS = 10000;

// ─── Internal Constants ───

const BOSS_HIT_COOLDOWN_MS = 1000;

// ─── Types ───

export interface PhysicsConfig {
  dtSeconds: number;
  frameTick: number;
  level: number;
  canvasSize: { w: number; h: number };
  minBrickDimension: number;
  qualityLevel: "potato" | "low" | "medium" | "high";
  difficulty: string;
  maxTotalSpeed: number;
  isBossRush: boolean;
  debugSettings: {
    enableCollisionLogging: boolean;
    enableBossLogging: boolean;
    enablePowerUpLogging: boolean;
  };
  pendingChainExplosions: Array<{ brick: Brick; triggerTime: number }>;
  frameCount: number;
  megaBossTrapJustHappenedTime: number;
}

export interface BossHitEvent {
  isMainBoss: boolean;
  bossId: number;
  canDamage: boolean;
  nowMs: number;
  ballId: number;
}

export type SoundEvent =
  | { type: "bounce" }
  | { type: "brick" }
  | { type: "cracked"; param: number }
  | { type: "explosion" }
  | { type: "bossHit" }
  | { type: "explosiveBrick" }
  | { type: "secondChanceSave" };

export interface ToastEvent {
  level: "info" | "warning" | "success" | "error";
  message: string;
  key?: string;
}

export interface PhysicsFrameResult {
  allBallsLost: boolean;
  scoreIncrease: number;
  bricksDestroyedCount: number;
  allBricksCleared: boolean;

  soundsToPlay: SoundEvent[];
  toastEvents: ToastEvent[];
  screenShakes: Array<{ intensity: number; duration: number }>;

  explosionsToCreate: Array<{ x: number; y: number; type: EnemyType }>;
  bonusLetterDrops: Array<{ x: number; y: number }>;
  largeSphereDrops: Array<{ x: number; y: number }>;
  bombIntervalsToClean: number[];
  enemiesKilledIncrease: number;
  destroyedEnemyData: Array<{ index: number; enemy: Enemy }>;

  powerUpBricks: Brick[];

  explosiveBrickExplosions: Array<{ x: number; y: number }>;
  updatedPendingChainExplosions: Array<{ brick: Brick; triggerTime: number }>;
  highlightFlashCount: number;
  backgroundFlash: boolean;

  bossHits: BossHitEvent[];

  paddleHitBallIds: number[];
  bossHitBallIds: number[];
  enemyHitBallIds: number[];
  ccdPerformance: CCDPerformanceData | null;

  secondChanceSaves: Array<{ x: number; y: number }>;
}

// ─── Reusable result object (zero-alloc per frame) ───
// Arrays are cleared with .length = 0 instead of creating new arrays.

const _reusableResult: PhysicsFrameResult = {
  allBallsLost: false,
  scoreIncrease: 0,
  bricksDestroyedCount: 0,
  allBricksCleared: false,
  soundsToPlay: [],
  toastEvents: [],
  screenShakes: [],
  explosionsToCreate: [],
  bonusLetterDrops: [],
  largeSphereDrops: [],
  bombIntervalsToClean: [],
  enemiesKilledIncrease: 0,
  destroyedEnemyData: [],
  powerUpBricks: [],
  explosiveBrickExplosions: [],
  updatedPendingChainExplosions: [],
  highlightFlashCount: 0,
  backgroundFlash: false,
  bossHits: [],
  paddleHitBallIds: [],
  bossHitBallIds: [],
  enemyHitBallIds: [],
  ccdPerformance: null,
  secondChanceSaves: [],
};

function createEmptyResult(): PhysicsFrameResult {
  // Reset scalar fields
  _reusableResult.allBallsLost = false;
  _reusableResult.scoreIncrease = 0;
  _reusableResult.bricksDestroyedCount = 0;
  _reusableResult.allBricksCleared = false;
  _reusableResult.enemiesKilledIncrease = 0;
  _reusableResult.highlightFlashCount = 0;
  _reusableResult.backgroundFlash = false;
  _reusableResult.ccdPerformance = null;

  // Clear arrays in-place (no new array allocation)
  _reusableResult.soundsToPlay.length = 0;
  _reusableResult.toastEvents.length = 0;
  _reusableResult.screenShakes.length = 0;
  _reusableResult.explosionsToCreate.length = 0;
  _reusableResult.bonusLetterDrops.length = 0;
  _reusableResult.largeSphereDrops.length = 0;
  _reusableResult.bombIntervalsToClean.length = 0;
  _reusableResult.destroyedEnemyData.length = 0;
  _reusableResult.powerUpBricks.length = 0;
  _reusableResult.explosiveBrickExplosions.length = 0;
  _reusableResult.updatedPendingChainExplosions.length = 0;
  _reusableResult.bossHits.length = 0;
  _reusableResult.paddleHitBallIds.length = 0;
  _reusableResult.bossHitBallIds.length = 0;
  _reusableResult.enemyHitBallIds.length = 0;
  _reusableResult.secondChanceSaves.length = 0;

  return _reusableResult;
}

// ─── Boss-First Swept Collision ───
// Performs continuous TOI check along ball's linear path for this dtSeconds.
// Returns true if boss collision found and corrections applied.

function performBossFirstSweep(
  ball: Ball,
  bossTarget: Boss,
  config: PhysicsConfig,
  result: PhysicsFrameResult,
): boolean {
  const { minBrickDimension, level, debugSettings, isBossRush, dtSeconds } = config;

  const SPEED = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
  const bossMinDim = Math.min(bossTarget.width, bossTarget.height);
  const samplesRaw = Math.ceil(SPEED / (bossMinDim * 0.08));
  const samples = Math.max(5, Math.min(16, samplesRaw));

  for (let s = 1; s <= samples; s++) {
    const alpha = s / samples;
    const sampleX = ball.x + ball.dx * (dtSeconds * alpha);
    const sampleY = ball.y + ball.dy * (dtSeconds * alpha);
    const sampleBall: Ball = { ...ball, x: sampleX, y: sampleY };

    let collision: {
      newX: number;
      newY: number;
      newVelocityX: number;
      newVelocityY: number;
    } | null = null;

    // ═══ Shape-specific collision checks ═══
    if (bossTarget.type === "cube" || bossTarget.type === "mega") {
      const isMegaBossLevel = level === 20;
      const centerX = bossTarget.x + bossTarget.width / 2;
      const centerY = bossTarget.y + bossTarget.height / 2;
      const HITBOX_EXPAND = 1;
      const dx = sampleBall.x - centerX;
      const dy = sampleBall.y - centerY;

      const megaBossData = bossTarget as any;
      const useInnerShield = isMegaBossLevel && megaBossData.outerShieldRemoved && megaBossData.innerShieldHP > 0;

      if (useInnerShield) {
        const innerShieldRadius = 45 + HITBOX_EXPAND;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const totalRadius = sampleBall.radius + innerShieldRadius;
        if (dist < totalRadius) {
          const penetration = totalRadius - dist;
          const normalX = dx / (dist || 1e-6);
          const normalY = dy / (dist || 1e-6);
          const overlap = penetration + 2;
          const dot = sampleBall.dx * normalX + sampleBall.dy * normalY;
          collision = {
            newX: sampleBall.x + normalX * overlap,
            newY: sampleBall.y + normalY * overlap,
            newVelocityX: sampleBall.dx - 2 * dot * normalX,
            newVelocityY: sampleBall.dy - 2 * dot * normalY,
          };
        }
      } else if (isMegaBossLevel) {
        const outerShieldRadius = bossTarget.width / 2 + HITBOX_EXPAND;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const totalRadius = sampleBall.radius + outerShieldRadius;
        if (dist < totalRadius) {
          const penetration = totalRadius - dist;
          const normalX = dx / (dist || 1e-6);
          const normalY = dy / (dist || 1e-6);
          const overlap = penetration + 2;
          const dot = sampleBall.dx * normalX + sampleBall.dy * normalY;
          collision = {
            newX: sampleBall.x + normalX * overlap,
            newY: sampleBall.y + normalY * overlap,
            newVelocityX: sampleBall.dx - 2 * dot * normalX,
            newVelocityY: sampleBall.dy - 2 * dot * normalY,
          };
        }
      } else {
        // Cube boss — rotated rectangle collision
        const cos = Math.cos(-bossTarget.rotationY);
        const sin = Math.sin(-bossTarget.rotationY);
        const ux = dx * cos - dy * sin;
        const uy = dx * sin + dy * cos;
        const halfW = (bossTarget.width + 2 * HITBOX_EXPAND) / 2;
        const halfH = (bossTarget.height + 2 * HITBOX_EXPAND) / 2;
        const closestX = Math.max(-halfW, Math.min(ux, halfW));
        const closestY = Math.max(-halfH, Math.min(uy, halfH));
        const distX = ux - closestX;
        const distY = uy - closestY;
        const distSq = distX * distX + distY * distY;
        if (distSq <= sampleBall.radius * sampleBall.radius) {
          if (distSq < 0.01) {
            // Ball center is inside the cube — fallback to boss-center-to-ball normal
            const fallbackDist = Math.sqrt(dx * dx + dy * dy) || 1;
            const normalX = dx / fallbackDist;
            const normalY = dy / fallbackDist;
            const correctionDist = Math.max(halfW, halfH) + sampleBall.radius + 5;
            const dot = sampleBall.dx * normalX + sampleBall.dy * normalY;
            collision = {
              newX: centerX + normalX * correctionDist,
              newY: centerY + normalY * correctionDist,
              newVelocityX: sampleBall.dx - 2 * dot * normalX,
              newVelocityY: sampleBall.dy - 2 * dot * normalY,
            };
          } else {
            const dist = Math.sqrt(distSq) || 1e-6;
            const penetration = sampleBall.radius - dist;
            const correctionDist = penetration + 2;
            const pushX = ux + (distX / dist) * correctionDist;
            const pushY = uy + (distY / dist) * correctionDist;
            const rotCos = Math.cos(bossTarget.rotationY);
            const rotSin = Math.sin(bossTarget.rotationY);
            const worldPushX = pushX * rotCos - pushY * rotSin;
            const worldPushY = pushX * rotSin + pushY * rotCos;
            const worldNormalX = (distX / dist) * cos + (distY / dist) * sin;
            const worldNormalY = -(distX / dist) * sin + (distY / dist) * cos;
            const dot = sampleBall.dx * worldNormalX + sampleBall.dy * worldNormalY;
            collision = {
              newX: centerX + worldPushX,
              newY: centerY + worldPushY,
              newVelocityX: sampleBall.dx - 2 * dot * worldNormalX,
              newVelocityY: sampleBall.dy - 2 * dot * worldNormalY,
            };
          }
        }
      }
    } else if (bossTarget.type === "sphere") {
      const centerX = bossTarget.x + bossTarget.width / 2;
      const centerY = bossTarget.y + bossTarget.height / 2;
      const HITBOX_EXPAND = 1;
      const dx = sampleBall.x - centerX;
      const dy = sampleBall.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const bossRadius = bossTarget.width / 2 + HITBOX_EXPAND;
      const totalRadius = sampleBall.radius + bossRadius;
      if (dist < totalRadius) {
        const penetration = totalRadius - dist;
        const normalX = dx / (dist || 1e-6);
        const normalY = dy / (dist || 1e-6);
        const overlap = penetration + 2;
        const dot = sampleBall.dx * normalX + sampleBall.dy * normalY;
        collision = {
          newX: sampleBall.x + normalX * overlap,
          newY: sampleBall.y + normalY * overlap,
          newVelocityX: sampleBall.dx - 2 * dot * normalX,
          newVelocityY: sampleBall.dy - 2 * dot * normalY,
        };
      }
    } else if (bossTarget.type === "pyramid") {
      const centerX = bossTarget.x + bossTarget.width / 2;
      const centerY = bossTarget.y + bossTarget.height / 2;
      const HITBOX_EXPAND = 1;
      const size = bossTarget.width / 2 + HITBOX_EXPAND;
      const v0 = { x: 0, y: -size };
      const v1 = { x: size, y: size };
      const v2 = { x: -size, y: size };
      const cos = Math.cos(bossTarget.rotationY);
      const sin = Math.sin(bossTarget.rotationY);
      const rotatePoint = (p: { x: number; y: number }) => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos,
      });
      const rv0 = rotatePoint(v0);
      const rv1 = rotatePoint(v1);
      const rv2 = rotatePoint(v2);
      const wv0 = { x: centerX + rv0.x, y: centerY + rv0.y };
      const wv1 = { x: centerX + rv1.x, y: centerY + rv1.y };
      const wv2 = { x: centerX + rv2.x, y: centerY + rv2.y };
      const edges = [
        { a: wv0, b: wv1 },
        { a: wv1, b: wv2 },
        { a: wv2, b: wv0 },
      ];
      let closestDist = Infinity;
      let closestNormal = { x: 0, y: 0 };
      for (const edge of edges) {
        const ex = edge.b.x - edge.a.x;
        const ey = edge.b.y - edge.a.y;
        const len = Math.sqrt(ex * ex + ey * ey) || 1e-6;
        const edgeNormX = ex / len;
        const edgeNormY = ey / len;
        const normalX = -edgeNormY;
        const normalY = edgeNormX;
        const toBallX = sampleBall.x - edge.a.x;
        const toBallY = sampleBall.y - edge.a.y;
        const t = Math.max(0, Math.min(len, toBallX * edgeNormX + toBallY * edgeNormY));
        const closestXEdge = edge.a.x + t * edgeNormX;
        const closestYEdge = edge.a.y + t * edgeNormY;
        const distX = sampleBall.x - closestXEdge;
        const distY = sampleBall.y - closestYEdge;
        const dist = Math.sqrt(distX * distX + distY * distY);
        if (dist < closestDist) {
          closestDist = dist;
          const toCenterX = sampleBall.x - centerX;
          const toCenterY = sampleBall.y - centerY;
          const dotProduct = normalX * toCenterX + normalY * toCenterY;
          closestNormal = dotProduct > 0 ? { x: normalX, y: normalY } : { x: -normalX, y: -normalY };
        }
      }
      if (closestDist < sampleBall.radius) {
        const penetration = sampleBall.radius - closestDist;
        const correctionDist = penetration + 2;
        const dot = sampleBall.dx * closestNormal.x + sampleBall.dy * closestNormal.y;
        collision = {
          newX: sampleBall.x + closestNormal.x * correctionDist,
          newY: sampleBall.y + closestNormal.y * correctionDist,
          newVelocityX: sampleBall.dx - 2 * dot * closestNormal.x,
          newVelocityY: sampleBall.dy - 2 * dot * closestNormal.y,
        };
      }
    }

    // ═══ Process collision if found ═══
    if (collision) {
      // Mega Boss: skip reflection when core is exposed (ball passes through)
      if (isMegaBoss(bossTarget)) {
        const megaBoss = bossTarget as MegaBoss;
        if (megaBoss.coreExposed && !megaBoss.trappedBall) {
          if (debugSettings.enableBossLogging) {
            console.log("[MegaBoss] Core exposed - allowing ball to pass through outer shell");
          }
          continue;
        }
      }

      // Debug collision logging
      if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
        const speedBefore = Math.hypot(ball.dx, ball.dy);
        const speedAfter = Math.hypot(collision.newVelocityX, collision.newVelocityY);
        console.log(
          `[Collision Debug] BOSS (${bossTarget.type}) - ` +
            `Before: dx=${ball.dx.toFixed(2)}, dy=${ball.dy.toFixed(2)}, speed=${speedBefore.toFixed(2)} | ` +
            `After: dx=${collision.newVelocityX.toFixed(2)}, dy=${collision.newVelocityY.toFixed(2)}, speed=${speedAfter.toFixed(2)} | Status: reflected`,
        );
      }

      // Apply position & velocity corrections to REAL ball
      const prePosX = ball.x;
      const prePosY = ball.y;
      ball.x = collision.newX;
      ball.y = collision.newY;
      ball.dx = collision.newVelocityX;
      ball.dy = collision.newVelocityY;

      // Ball tracking (debug)
      if (debugSettings.enableBossLogging) {
        const posDiffX = collision.newX - prePosX;
        const posDiffY = collision.newY - prePosY;
        const posDiffLen = Math.sqrt(posDiffX * posDiffX + posDiffY * posDiffY) || 1;
        startBallTracking(
          ball,
          bossTarget.type,
          { x: bossTarget.x + bossTarget.width / 2, y: bossTarget.y + bossTarget.height / 2 },
          { width: bossTarget.width, height: bossTarget.height },
          { x: posDiffX / posDiffLen, y: posDiffY / posDiffLen },
        );
      }

      // Mark ball to suppress paddle resolver
      // Cooldown check (millisecond-based)
      const lastHitMs = bossTarget.lastHitAt || 0;
      const nowMs = world.simTimeMs; // sim-time, not wall-clock
      const canDamage = nowMs - lastHitMs >= BOSS_HIT_COOLDOWN_MS;

      if (debugSettings.enableBossLogging) {
        console.log("[BossSweep] Cooldown check:", {
          nowMs,
          lastHitMs,
          cooldownMs: BOSS_HIT_COOLDOWN_MS,
          diff: nowMs - lastHitMs,
          canDamage,
          bossType: bossTarget.type,
          bossHealth: bossTarget.currentHealth,
        });
      }

      if (canDamage) {
        // Track boss hit ball IDs (for streak + Boss Rush accuracy)
        result.bossHitBallIds.push(ball.id);

        // Push boss hit event for Game.tsx to process damage
        result.bossHits.push({
          isMainBoss: bossTarget === world.boss,
          bossId: bossTarget.id,
          canDamage: true,
          nowMs,
          ballId: ball.id,
        });

        // Write cooldown immediately so other balls in this frame can't double-hit
        bossTarget.lastHitAt = nowMs;

        // Sound and screen shake
        result.soundsToPlay.push({ type: "bossHit" });
        result.screenShakes.push({ intensity: 8, duration: 400 });
      }

      return true; // Collision resolved, exit sample loop
    }
  }

  return false; // No boss collision found
}

// ─── Main Physics Frame ───

export function runPhysicsFrame(config: PhysicsConfig): PhysicsFrameResult {
  const { balls, paddle, boss, resurrectedBosses, bricks, enemies, speedMultiplier } = world;

  const result = createEmptyResult();

  if (!paddle || balls.length === 0) {
    result.allBallsLost = balls.length === 0 && paddle !== null;
    return result;
  }

  const { dtSeconds, frameTick, level, debugSettings, maxTotalSpeed, isBossRush } = config;

  // ═══ Advance simulation clock ═══
  world.simTimeSeconds += dtSeconds;
  world.simTimeMs = Math.floor(world.simTimeSeconds * 1000);

  // ═══ Phase 0: Store previousY ═══
  for (const ball of balls) {
    ball.previousY = ball.y;
  }

  // ═══ Phase 0: Boss-First Swept Collision ═══
  const bossFirstStart = ENABLE_DEBUG_FEATURES ? performance.now() : 0;

  if (boss) {
    for (const ball of balls) {
      performBossFirstSweep(ball, boss, config, result);
    }
  }
  for (const resBoss of resurrectedBosses) {
    for (const ball of balls) {
      performBossFirstSweep(ball, resBoss, config, result);
    }
  }

  const bossFirstTimeMs = ENABLE_DEBUG_FEATURES ? performance.now() - bossFirstStart : 0;

  // ═══ Phase 1: CCD for Bricks/Enemies/Walls/Paddle ═══
  const ballStatesBeforeCCD =
    ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging
      ? new Map(
          balls.map((b) => [
            b.id,
            {
              dx: b.dx,
              dy: b.dy,
              speed: Math.hypot(b.dx, b.dy),
              x: b.x,
              y: b.y,
              isFireball: b.isFireball || false,
            },
          ]),
        )
      : null;

  const ballResults = balls.map((ball) => {
    // Skip CCD for balls waiting to launch — they are pinned to the paddle by the
    // game loop and must not be moved by the physics engine while in that state.
    if (ball.waitingToLaunch) {
      return { ball, events: [], substepsUsed: 0, maxIterations: 0, collisionCount: 0, toiIterationsUsed: 0 };
    }
    return processBallWithCCD(ball, dtSeconds, frameTick, {
      bricks,
      paddle,
      canvasSize: config.canvasSize,
      speedMultiplier,
      minBrickDimension: config.minBrickDimension,
      boss: null, // Boss handled in Phase 0
      resurrectedBosses: [],
      enemies,
      qualityLevel: config.qualityLevel,
    });
  });

  // CCD performance data
  if (ballResults.length > 0 && ballResults[0].performance) {
    const perf = ballResults[0].performance;
    result.ccdPerformance = {
      bossFirstSweepUs: bossFirstTimeMs * 1000,
      ccdCoreUs: perf.ccdCoreMs * 1000,
      postProcessingUs: perf.postProcessingMs * 1000,
      totalUs: perf.totalMs * 1000,
      substepsUsed: ballResults[0].substepsUsed,
      collisionCount: ballResults[0].collisionCount,
      toiIterationsUsed: ballResults[0].toiIterationsUsed,
    } as CCDPerformanceData;
  }

  // ═══ Phase 2: Event Deduplication & Processing ═══
  const EPS_TOI = PHYSICS_CONFIG.EPS_TOI;
  const processedObjects = new Map<string, number>();
  const brickUpdates = new Map<number, { hitsRemaining: number; visible: boolean }>();
  let scoreIncrease = 0;
  let bricksDestroyedCount = 0;
  const powerUpBricks: Brick[] = [];
  const explosiveBricksToDetonate: Brick[] = [];

  // Enemy batched updates
  const enemiesToUpdate = new Map<number, Partial<Enemy>>();
  const enemiesToDestroy = new Set<number>();
  let enemiesKilledIncrease = 0;

  // Process pending chain explosions from previous frames
  const now = world.simTimeMs; // sim-time, not wall-clock
  result.updatedPendingChainExplosions = config.pendingChainExplosions.filter((p) => now < p.triggerTime);
  const readyExplosions = config.pendingChainExplosions.filter((p) => now >= p.triggerTime);
  for (const pending of readyExplosions) {
    const brick = bricks.find((b) => b.id === pending.brick.id);
    if (brick && brick.visible) explosiveBricksToDetonate.push(brick);
  }

  // Process collision events from each ball result
  for (let bi = 0; bi < ballResults.length; bi++) {
    const ccdResult = ballResults[bi];
    if (!ccdResult.ball) continue;

    const ballBefore = ballStatesBeforeCCD?.get(ccdResult.ball.id);
    const sortedEvents = ccdResult.events.sort((a, b) => a.t - b.t);

    for (const event of sortedEvents) {
      const objectKey = `${event.objectType}-${event.objectId}`;
      const lastTOI = processedObjects.get(objectKey);
      const isDuplicate =
        event.objectType !== "wall" &&
        event.objectType !== "paddle" &&
        event.objectType !== "paddleCorner" &&
        lastTOI !== undefined &&
        Math.abs(event.t - lastTOI) < EPS_TOI;

      if (!isDuplicate) {
        processedObjects.set(objectKey, event.t);
      }

      switch (event.objectType) {
        case "wall":
          if (!isDuplicate) {
            if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging && ballBefore) {
              const speedAfter = Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy);
              collisionHistory.addEntry({
                timestamp: performance.now(),
                frameNumber: config.frameCount,
                objectType: "wall",
                objectId: "wall",
                ballBefore,
                ballAfter: {
                  x: ccdResult.ball.x,
                  y: ccdResult.ball.y,
                  dx: ccdResult.ball.dx,
                  dy: ccdResult.ball.dy,
                  speed: speedAfter,
                },
                collisionPoint: event.point,
                collisionNormal: event.normal,
                reflectionApplied: true,
                isDuplicate: false,
                soundPlayed: "bounce",
              });
            }
            result.soundsToPlay.push({ type: "bounce" });
          }
          break;

        case "paddle": {
          // Anti-rescue paddle collision validation
          const TOP_NORMAL_THRESHOLD = -0.5;
          const normalY = event.normal.y ?? 0;
          if (normalY > TOP_NORMAL_THRESHOLD) break;
          if (event.point.y > paddle.y + 1) break;

          const previousBallY = ccdResult.ball.previousY ?? ccdResult.ball.y;
          if (previousBallY >= paddle.y) break;

          const checkDx = event.originalDx ?? ccdResult.ball.dx;
          const checkDy = event.originalDy ?? ccdResult.ball.dy;
          const dot = checkDx * event.normal.x + checkDy * event.normal.y;
          const isRecentlyReleasedFromBoss =
            ccdResult.ball.releasedFromBossTime && Date.now() - ccdResult.ball.releasedFromBossTime < 2000;
          if (dot >= 0 && !isRecentlyReleasedFromBoss) break;

          const nowPerf = performance.now();
          if (
            ccdResult.ball.lastPaddleHitTime !== undefined &&
            nowPerf - ccdResult.ball.lastPaddleHitTime < PHYSICS_CONFIG.PADDLE_HIT_COOLDOWN_MS
          )
            break;

          // Apply paddle angle remapping physics
          const hitPos = (event.point.x - paddle.x) / paddle.width;
          const angle = (hitPos - 0.5) * Math.PI * 0.6;
          const speedBefore = Math.sqrt(ccdResult.ball.dx * ccdResult.ball.dx + ccdResult.ball.dy * ccdResult.ball.dy);
          ccdResult.ball.dx = speedBefore * Math.sin(angle);
          ccdResult.ball.dy = -Math.abs(speedBefore * Math.cos(angle));
          ccdResult.ball.lastPaddleHitTime = performance.now();
          ccdResult.ball.lastGravityResetTime = performance.now();

          // Normalize speed bidirectionally to remove gravity contribution and prevent permanent slowdowns
          const currentSpd = Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy);
          const targetSpd = ccdResult.ball.speed;
          if (currentSpd > 0 && Math.abs(currentSpd - targetSpd) > 0.01) {
            const scale = targetSpd / currentSpd;
            ccdResult.ball.dx *= scale;
            ccdResult.ball.dy *= scale;
          }

          if (!isDuplicate) {
            if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging && ballBefore) {
              const speedAfter = Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy);
              collisionHistory.addEntry({
                timestamp: performance.now(),
                frameNumber: config.frameCount,
                objectType: "paddle",
                objectId: "paddle",
                ballBefore,
                ballAfter: {
                  x: ccdResult.ball.x,
                  y: ccdResult.ball.y,
                  dx: ccdResult.ball.dx,
                  dy: ccdResult.ball.dy,
                  speed: speedAfter,
                },
                collisionPoint: event.point,
                collisionNormal: event.normal,
                reflectionApplied: true,
                isDuplicate: false,
                soundPlayed: "bounce",
              });
            }
            result.soundsToPlay.push({ type: "bounce" });
            // Track paddle hit ball IDs (for streak + Boss Rush accuracy)
            result.paddleHitBallIds.push(ccdResult.ball.id);
          }
          break;
        }

        case "paddleCorner": {
          const dotCorner = ccdResult.ball.dx * event.normal.x + ccdResult.ball.dy * event.normal.y;
          if (dotCorner >= 0) break;

          const nowCorner = performance.now();
          if (
            ccdResult.ball.lastPaddleHitTime !== undefined &&
            nowCorner - ccdResult.ball.lastPaddleHitTime < PHYSICS_CONFIG.PADDLE_HIT_COOLDOWN_MS
          )
            break;

          ccdResult.ball.lastPaddleHitTime = nowCorner;
          ccdResult.ball.lastGravityResetTime = nowCorner;

          // Normalize speed
          const currentSpdCorner = Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy);
          const targetSpdCorner = ccdResult.ball.speed;
          if (currentSpdCorner > 0 && currentSpdCorner > targetSpdCorner) {
            const scaleCorner = targetSpdCorner / currentSpdCorner;
            ccdResult.ball.dx *= scaleCorner;
            ccdResult.ball.dy *= scaleCorner;
          }

          if (!isDuplicate) {
            if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging && ballBefore) {
              const speedAfter = Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy);
              collisionHistory.addEntry({
                timestamp: performance.now(),
                frameNumber: config.frameCount,
                objectType: "paddle",
                objectId: "paddleCorner",
                ballBefore,
                ballAfter: {
                  x: ccdResult.ball.x,
                  y: ccdResult.ball.y,
                  dx: ccdResult.ball.dx,
                  dy: ccdResult.ball.dy,
                  speed: speedAfter,
                },
                collisionPoint: event.point,
                collisionNormal: event.normal,
                reflectionApplied: true,
                isDuplicate: false,
                soundPlayed: "bounce",
              });
            }
            result.soundsToPlay.push({ type: "bounce" });
            // Track paddle corner hit ball IDs (for streak + Boss Rush accuracy)
            result.paddleHitBallIds.push(ccdResult.ball.id);
          }
          break;
        }

        case "brick":
        case "corner": {
          const objectId = typeof event.objectId === "number" ? event.objectId : -1;

          // ─── Enemy collision (ID >= 100000) ───
          if (objectId >= 100000) {
            const enemyIndex = objectId - 100000;
            const enemy = enemies[enemyIndex];
            if (enemy && !isDuplicate) {
              ccdResult.ball.lastGravityResetTime = performance.now();

              if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging && ballBefore) {
                const speedAfter = Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy);
                collisionHistory.addEntry({
                  timestamp: performance.now(),
                  frameNumber: config.frameCount,
                  objectType: "corner",
                  objectId: enemy.id ?? enemyIndex,
                  objectMeta: { enemyType: enemy.type },
                  ballBefore,
                  ballAfter: {
                    x: ccdResult.ball.x,
                    y: ccdResult.ball.y,
                    dx: ccdResult.ball.dx,
                    dy: ccdResult.ball.dy,
                    speed: speedAfter,
                  },
                  collisionPoint: event.point,
                  collisionNormal: event.normal,
                  reflectionApplied: true,
                  isDuplicate: false,
                });
              }

              // Enemy type-specific multi-hit logic
              if (enemy.type === "pyramid") {
                const currentHits = enemy.hits || 0;
                if (currentHits < 2) {
                  result.soundsToPlay.push({ type: "bounce" });
                  enemiesToUpdate.set(enemy.id!, {
                    hits: currentHits + 1,
                    isAngry: true,
                    speed: enemy.speed * 1.3,
                    dx: enemy.dx * 1.3,
                    dy: enemy.dy * 1.3,
                  });
                  result.toastEvents.push({
                    level: "warning",
                    message: currentHits === 0 ? "Pyramid hit! 2 more hits needed" : "Pyramid is angry! 1 more hit!",
                    key: "pyramid_hit",
                  });
                  result.screenShakes.push({ intensity: 5, duration: 500 });
                  result.enemyHitBallIds.push(ccdResult.ball.id); // Count non-killing pyramid hit for streak
                } else {
                  enemiesToDestroy.add(enemyIndex);
                  result.enemyHitBallIds.push(ccdResult.ball.id);
                  result.explosionsToCreate.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height / 2,
                    type: enemy.type,
                  });
                  scoreIncrease += 300;
                  result.toastEvents.push({
                    level: "success",
                    message: "Pyramid destroyed! +300 points",
                    key: "enemy_destroyed",
                  });
                  result.soundsToPlay.push({ type: "explosion" });
                  enemiesKilledIncrease++;
                  result.bonusLetterDrops.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height / 2,
                  });
                  if (enemy.id !== undefined) result.bombIntervalsToClean.push(enemy.id);
                }
              } else if (enemy.type === "sphere") {
                const currentHits = enemy.hits || 0;
                const maxHits = enemy.isLargeSphere ? 2 : 1;
                if (currentHits < maxHits) {
                  result.soundsToPlay.push({ type: "bounce" });
                  enemiesToUpdate.set(enemy.id!, {
                    hits: currentHits + 1,
                    isAngry: true,
                    speed: enemy.speed * 1.3,
                    dx: enemy.dx * 1.3,
                    dy: enemy.dy * 1.3,
                  });
                  const hitsLeft = maxHits - currentHits;
                  result.toastEvents.push({
                    level: "warning",
                    message: enemy.isLargeSphere
                      ? `Large sphere hit! ${hitsLeft} more hits!`
                      : "Sphere enemy is angry!",
                    key: "sphere_hit",
                  });
                  result.screenShakes.push({ intensity: 5, duration: 500 });
                  result.enemyHitBallIds.push(ccdResult.ball.id); // Count first hit for streak
                } else {
                  enemiesToDestroy.add(enemyIndex);
                  result.enemyHitBallIds.push(ccdResult.ball.id);
                  result.explosionsToCreate.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height / 2,
                    type: enemy.type,
                  });
                  const points = enemy.isLargeSphere ? 400 : 200;
                  scoreIncrease += points;
                  result.toastEvents.push({
                    level: "success",
                    message: `${enemy.isLargeSphere ? "Large sphere" : "Sphere enemy"} destroyed! +${points} points`,
                    key: "enemy_destroyed",
                  });
                  result.soundsToPlay.push({ type: "explosion" });
                  enemiesKilledIncrease++;
                  result.bonusLetterDrops.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height / 2,
                  });
                  if (enemy.isLargeSphere) {
                    result.largeSphereDrops.push({
                      x: enemy.x + enemy.width / 2,
                      y: enemy.y + enemy.height / 2,
                    });
                  }
                  if (enemy.id !== undefined) result.bombIntervalsToClean.push(enemy.id);
                }
              } else if (enemy.type === "crossBall") {
                const currentHits = enemy.hits || 0;
                if (currentHits === 0) {
                  result.soundsToPlay.push({ type: "bounce" });
                  enemiesToUpdate.set(enemy.id!, {
                    hits: 1,
                    isAngry: true,
                    speed: enemy.speed * 1.3,
                    dx: enemy.dx * 1.3,
                    dy: enemy.dy * 1.3,
                  });
                  result.toastEvents.push({
                    level: "warning",
                    message: "CrossBall is angry!",
                    key: "crossball_hit",
                  });
                  result.screenShakes.push({ intensity: 5, duration: 500 });
                  result.enemyHitBallIds.push(ccdResult.ball.id);
                } else {
                  enemiesToDestroy.add(enemyIndex);
                  result.enemyHitBallIds.push(ccdResult.ball.id);
                  result.explosionsToCreate.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height / 2,
                    type: enemy.type,
                  });
                  scoreIncrease += 250;
                  result.toastEvents.push({
                    level: "success",
                    message: "CrossBall destroyed! +250 points",
                    key: "enemy_destroyed",
                  });
                  result.soundsToPlay.push({ type: "explosion" });
                  enemiesKilledIncrease++;
                  result.bonusLetterDrops.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height / 2,
                  });
                  if (enemy.id !== undefined) result.bombIntervalsToClean.push(enemy.id);
                }
              } else if (enemy.type === "star") {
                // Star enemy: 1 hit to destroy, 150 points
                enemiesToDestroy.add(enemyIndex);
                result.enemyHitBallIds.push(ccdResult.ball.id);
                result.explosionsToCreate.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                  type: enemy.type,
                });
                scoreIncrease += 150;
                result.toastEvents.push({
                  level: "success",
                  message: "Star destroyed! +150 points",
                  key: "enemy_destroyed",
                });
                result.soundsToPlay.push({ type: "explosion" });
                enemiesKilledIncrease++;
                result.bonusLetterDrops.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                });
                if (enemy.id !== undefined) result.bombIntervalsToClean.push(enemy.id);
              } else {
                // Cube enemy — one hit kill
                enemiesToDestroy.add(enemyIndex);
                result.enemyHitBallIds.push(ccdResult.ball.id);
                result.explosionsToCreate.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                  type: enemy.type,
                });
                scoreIncrease += 100;
                result.toastEvents.push({
                  level: "success",
                  message: "Cube enemy destroyed! +100 points",
                  key: "enemy_destroyed",
                });
                result.soundsToPlay.push({ type: "explosion" });
                enemiesKilledIncrease++;
                result.screenShakes.push({ intensity: 3, duration: 300 });
                result.bonusLetterDrops.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                });
                if (enemy.id !== undefined) result.bombIntervalsToClean.push(enemy.id);
              }
            }
            if (enemy) break;
          }

          // ─── Brick collision ───
          const brick = bricks.find((b) => b.id === objectId);
          if (!brick || !brick.visible) break;
          if (brickUpdates.has(brick.id)) break;

          // Indestructible (metal) bricks
          if (brick.isIndestructible) {
            if (!isDuplicate) result.soundsToPlay.push({ type: "bounce" });
            break;
          }

          // Fireball instantly destroys
          if (ccdResult.ball.isFireball) {
            if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging && ballBefore) {
              collisionHistory.addEntry({
                timestamp: performance.now(),
                frameNumber: config.frameCount,
                objectType: "brick",
                objectId: brick.id,
                objectMeta: {
                  type: brick.type,
                  isIndestructible: brick.isIndestructible,
                  hitsRemaining: brick.hitsRemaining,
                },
                ballBefore,
                ballAfter: {
                  x: ccdResult.ball.x,
                  y: ccdResult.ball.y,
                  dx: ccdResult.ball.dx,
                  dy: ccdResult.ball.dy,
                  speed: Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy),
                },
                collisionPoint: event.point,
                collisionNormal: event.normal,
                reflectionApplied: false,
                isDuplicate: false,
                soundPlayed: "brick",
              });
            }
            brickUpdates.set(brick.id, { visible: false, hitsRemaining: 0 });
            if (!isDuplicate) {
              result.soundsToPlay.push({ type: "brick" });
              scoreIncrease += brick.points;
              bricksDestroyedCount++;
              powerUpBricks.push(brick);
              if (brick.type === "explosive") explosiveBricksToDetonate.push(brick);
            }
          } else {
            // Normal brick damage
            if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging && ballBefore) {
              collisionHistory.addEntry({
                timestamp: performance.now(),
                frameNumber: config.frameCount,
                objectType: "brick",
                objectId: brick.id,
                objectMeta: {
                  type: brick.type,
                  isIndestructible: brick.isIndestructible,
                  hitsRemaining: brick.hitsRemaining,
                },
                ballBefore,
                ballAfter: {
                  x: ccdResult.ball.x,
                  y: ccdResult.ball.y,
                  dx: ccdResult.ball.dx,
                  dy: ccdResult.ball.dy,
                  speed: Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy),
                },
                collisionPoint: event.point,
                collisionNormal: event.normal,
                reflectionApplied: true,
                isDuplicate: false,
              });
            }

            if (!isDuplicate) {
              ccdResult.ball.lastGravityResetTime = performance.now();
            }
            const newHitsRemaining = brick.hitsRemaining - 1;
            const brickDestroyed = newHitsRemaining <= 0;

            if (!isDuplicate) {
              if (brickDestroyed) {
                result.soundsToPlay.push({ type: "brick" });
              } else if (brick.type === "cracked") {
                result.soundsToPlay.push({ type: "cracked", param: brick.hitsRemaining });
              } else {
                result.soundsToPlay.push({ type: "brick" });
              }
            }

            if (brickDestroyed) {
              brickUpdates.set(brick.id, { visible: false, hitsRemaining: 0 });
              if (!isDuplicate) {
                scoreIncrease += brick.points;
                bricksDestroyedCount++;
              }

              // Speed increase — cap based on total speed
              const brickHitSpeedAccumulated = world.brickHitSpeedAccumulated;
              const currentTotalSpeed = speedMultiplier + brickHitSpeedAccumulated;
              if (currentTotalSpeed < maxTotalSpeed) {
                const remainingBrickCount = bricks.filter(
                  (b) => b.visible && !b.isIndestructible && (!brickUpdates.has(b.id) || brickUpdates.get(b.id)!.visible),
                ).length;
                let baseSpeedIncrease = 0.01;
                if (remainingBrickCount <= 10) {
                  // Scale from 0.021 (10 left) up to 0.063 (1 left) — 5% above previous values
                  baseSpeedIncrease = 0.021 + (10 - remainingBrickCount) * 0.00462;
                }
                const speedIncrease = Math.min(baseSpeedIncrease, maxTotalSpeed - currentTotalSpeed);
                world.brickHitSpeedAccumulated = Math.min(
                  maxTotalSpeed - speedMultiplier,
                  world.brickHitSpeedAccumulated + speedIncrease,
                );
                ccdResult.ball.dx *= 1 + speedIncrease;
                ccdResult.ball.dy *= 1 + speedIncrease;
                // Sync ball.speed so paddle normalization preserves the increase
                ccdResult.ball.speed = Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy);
              }

              if (!isDuplicate) {
                powerUpBricks.push(brick);
                if (brick.type === "explosive") explosiveBricksToDetonate.push(brick);
              }
            } else {
              brickUpdates.set(brick.id, { visible: true, hitsRemaining: newHitsRemaining });
            }
          }
          break;
        }
      }
    }
  }

  // ═══ Explosive brick detonation ═══
  for (const brick of explosiveBricksToDetonate) {
    if (!brickUpdates.has(brick.id)) {
      brickUpdates.set(brick.id, { visible: false, hitsRemaining: 0 });
      scoreIncrease += brick.points;
      bricksDestroyedCount++;
    }

    const explosionRadius = 70;
    const brickCenterX = brick.x + brick.width / 2;
    const brickCenterY = brick.y + brick.height / 2;

    result.explosiveBrickExplosions.push({ x: brickCenterX, y: brickCenterY });
    result.highlightFlashCount++;

    // Destroy nearby bricks
    for (const otherBrick of bricks) {
      if (otherBrick.id === brick.id || !otherBrick.visible) continue;
      const dx = otherBrick.x + otherBrick.width / 2 - brickCenterX;
      const dy = otherBrick.y + otherBrick.height / 2 - brickCenterY;
      if (Math.sqrt(dx * dx + dy * dy) <= explosionRadius) {
        if (!brickUpdates.has(otherBrick.id)) {
          if (otherBrick.type === "explosive") {
            const alreadyPending = result.updatedPendingChainExplosions.some((p) => p.brick.id === otherBrick.id);
            if (!alreadyPending) {
              result.updatedPendingChainExplosions.push({
                brick: otherBrick,
                triggerTime: world.simTimeMs + 200,
              });
            }
          } else {
            brickUpdates.set(otherBrick.id, { visible: false, hitsRemaining: 0 });
            scoreIncrease += otherBrick.points;
            bricksDestroyedCount++;
          }
        }
      }
    }

    // Destroy nearby enemies within blast radius
    for (let ei = 0; ei < enemies.length; ei++) {
      const enemy = enemies[ei];
      if (enemiesToDestroy.has(ei)) continue;
      const enemyCenterX = enemy.x + enemy.width / 2;
      const enemyCenterY = enemy.y + enemy.height / 2;
      const dx = enemyCenterX - brickCenterX;
      const dy = enemyCenterY - brickCenterY;
      if (Math.sqrt(dx * dx + dy * dy) <= explosionRadius) {
        enemiesToDestroy.add(ei);
        result.explosionsToCreate.push({
          x: enemyCenterX,
          y: enemyCenterY,
          type: enemy.type,
        });
        scoreIncrease += 150;
        result.toastEvents.push({
          level: "success",
          message: `${enemy.type} enemy caught in explosion! +150`,
          key: "enemy_destroyed",
        });
        result.soundsToPlay.push({ type: "explosion" });
        enemiesKilledIncrease++;
        result.bonusLetterDrops.push({ x: enemyCenterX, y: enemyCenterY });
        if (enemy.id !== undefined) result.bombIntervalsToClean.push(enemy.id);
      }
    }

    result.soundsToPlay.push({ type: "explosiveBrick" });
    result.backgroundFlash = true;
  }

  // ═══ Apply brick updates to world.bricks ═══
  for (const [id, update] of brickUpdates) {
    const brick = bricks.find((b) => b.id === id);
    if (brick) {
      brick.visible = update.visible;
      brick.hitsRemaining = update.hitsRemaining;
    }
  }

  // Check all bricks cleared (win condition flag)
  const allGone = bricks.every((b) => !b.visible || b.isIndestructible);
  if (allGone && brickUpdates.size > 0) {
    const hasDestructible = bricks.some((b) => !b.isIndestructible);
    if (hasDestructible || !BOSS_LEVELS.includes(level)) {
      result.allBricksCleared = true;
    }
  }

  // ═══ Apply enemy updates to world.enemies ═══
  for (const [id, update] of enemiesToUpdate) {
    const enemy = enemies.find((e) => e.id === id);
    if (enemy) Object.assign(enemy, update);
  }

  // Capture destroyed enemy data before removal
  const sortedDestroyIndices = Array.from(enemiesToDestroy).sort((a, b) => b - a);
  for (const idx of sortedDestroyIndices) {
    if (idx < enemies.length) {
      result.destroyedEnemyData.push({ index: idx, enemy: { ...enemies[idx] } });
    }
  }
  // Remove destroyed enemies (reverse order preserves indices)
  for (const idx of sortedDestroyIndices) {
    if (idx < enemies.length) {
      enemies.splice(idx, 1);
    }
  }

  // Set result accumulations
  result.scoreIncrease = scoreIncrease;
  result.bricksDestroyedCount = bricksDestroyedCount;
  result.powerUpBricks = powerUpBricks;
  result.enemiesKilledIncrease = enemiesKilledIncrease;

  // ═══ Phase 3: Homing ball physics ═══
  for (const r of ballResults) {
    if (!r.ball || !r.ball.isHoming || r.ball.waitingToLaunch) continue;
    const targetBoss = boss || resurrectedBosses[0];
    if (!targetBoss) continue;

    const bossCenterX = targetBoss.x + targetBoss.width / 2;
    const bossCenterY = targetBoss.y + targetBoss.height / 2;
    const toBossX = bossCenterX - r.ball.x;
    const toBossY = bossCenterY - r.ball.y;
    const currentAngle = Math.atan2(r.ball.dy, r.ball.dx);
    const targetAngle = Math.atan2(toBossY, toBossX);

    let angleDiff = targetAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const HOMING_MAX_TURN = 0.1;
    const HOMING_STRENGTH = 0.15;
    const turnAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), HOMING_MAX_TURN);
    const newAngle = currentAngle + turnAmount * HOMING_STRENGTH;

    const speed = Math.sqrt(r.ball.dx * r.ball.dx + r.ball.dy * r.ball.dy);
    r.ball.dx = Math.cos(newAngle) * speed;
    r.ball.dy = Math.sin(newAngle) * speed;
  }

  // ═══ Phase 3: Gravity ═══
  for (const r of ballResults) {
    if (r.ball && !r.ball.waitingToLaunch) {
      const timeSinceCollision = performance.now() - (r.ball.lastGravityResetTime ?? 0);
      if (timeSinceCollision > GRAVITY_DELAY_MS) {
        r.ball.dy += BALL_GRAVITY;
      }
    }
  }

  // ═══ Phase 4: Ball filtering ═══
  const SAFETY_NET_Y = paddle.y + 40;

  const updatedBalls = ballResults
    .map((r) => r.ball)
    .filter((ball): ball is NonNullable<typeof ball> => {
      if (!ball) return false;

      // Second Chance save — before any mega boss logic
      if (paddle.hasSecondChance && ball.y > SAFETY_NET_Y && ball.dy > 0) {
        ball.dy = -Math.abs(ball.dy);
        ball.y = SAFETY_NET_Y - ball.radius - 5;
        paddle.hasSecondChance = false; // Consume immediately
        result.secondChanceSaves.push({ x: ball.x, y: SAFETY_NET_Y });
        result.soundsToPlay.push({ type: "secondChanceSave" });
        return true;
      }

      // Mega boss gravity well
      if (level === MEGA_BOSS_LEVEL && boss && isMegaBoss(boss)) {
        const megaBoss = boss as MegaBoss;
        if (megaBoss.coreExposed && isBallInsideMegaBoss(ball, megaBoss)) {
          const pulledBall = applyGravityWellToBall(ball, megaBoss);
          ball.dx = pulledBall.dx;
          ball.dy = pulledBall.dy;
          const bossBottom = megaBoss.y + megaBoss.height;
          if (ball.y > bossBottom - ball.radius) {
            ball.y = bossBottom - ball.radius - 5;
            ball.dy = -Math.abs(ball.dy) * 0.5;
          }
          return true;
        }
      }

      // Top boundary safety
      if (ball.y < ball.radius) {
        ball.y = ball.radius + 2;
        ball.dy = Math.abs(ball.dy) || 3;
      }

      // Lost ball
      if (ball.y > config.canvasSize.h + ball.radius) {
        // DEBUG: Log when ball is lost on level 20
        if (level === MEGA_BOSS_LEVEL) {
          console.log(`[MEGA BOSS DEBUG] ⚠️ BALL ${ball.id} LOST! Position: (${ball.x.toFixed(1)}, ${ball.y.toFixed(1)})`);
          if (boss && isMegaBoss(boss)) {
            const megaBoss = boss as MegaBoss;
            console.log(`[MEGA BOSS DEBUG] Boss state at ball loss:`, {
              coreExposed: megaBoss.coreExposed,
              trappedBall: megaBoss.trappedBall ? 'YES' : 'NO',
              bossPosition: { x: megaBoss.x.toFixed(1), y: megaBoss.y.toFixed(1) }
            });
          }
        }
        return false;
      }

      return true;
    });

  // ═══ Phase 4b: Speed ramp for balls released from Mega Boss ═══
  const RAMP_DURATION_MS = 1500;
  const TARGET_SPEED = 4;
  const rampNow = Date.now();
  for (const ball of updatedBalls) {
    if (ball.releaseSpeedScale != null && ball.releasedFromBossTime) {
      const elapsed = rampNow - ball.releasedFromBossTime;
      if (elapsed >= RAMP_DURATION_MS) {
        const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        if (currentSpeed > 0) {
          ball.dx = (ball.dx / currentSpeed) * TARGET_SPEED;
          ball.dy = (ball.dy / currentSpeed) * TARGET_SPEED;
        }
        delete ball.releaseSpeedScale;
        delete ball.releasedFromBossTime;
      } else {
        const t = elapsed / RAMP_DURATION_MS;
        const scale = ball.releaseSpeedScale + (1 - ball.releaseSpeedScale) * t;
        const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        if (currentSpeed > 0) {
          const desiredSpeed = TARGET_SPEED * scale;
          ball.dx = (ball.dx / currentSpeed) * desiredSpeed;
          ball.dy = (ball.dy / currentSpeed) * desiredSpeed;
        }
      }
    }
  }

  // Write updated balls to world
  world.balls = updatedBalls;
  (window as any).currentBalls = updatedBalls;

  // Check all balls lost (with mega boss trap guard)
  const megaBossHasTrappedBall =
    level === MEGA_BOSS_LEVEL && boss && isMegaBoss(boss) && (boss as MegaBoss).trappedBall !== null;
  const justTrappedRecently = level === MEGA_BOSS_LEVEL && Date.now() - config.megaBossTrapJustHappenedTime < 1500;
  result.allBallsLost = updatedBalls.length === 0 && !megaBossHasTrappedBall && !justTrappedRecently;

  return result;
}
