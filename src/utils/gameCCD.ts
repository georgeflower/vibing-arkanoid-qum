import { processBallCCD, Ball as CCDBall, Brick as CCDBrick, Paddle as CCDPaddle, CollisionEvent } from './processBallCCD';
import { Brick, Ball, Paddle, Boss, Enemy } from '@/types/game';
import { ENABLE_DEBUG_FEATURES } from '@/constants/game';

export interface CCDResult {
  ball: Ball | null;
  events: CollisionEvent[];
  debug?: any;
  substepsUsed: number;
  maxIterations: number;
  collisionCount: number;
  toiIterationsUsed: number;
  performance?: {
    bossFirstSweepMs: number;
    ccdCoreMs: number;
    postProcessingMs: number;
    totalMs: number;
  };
}

// Pre-allocated brick pool to avoid per-frame allocations
const BRICK_POOL_SIZE = 250;
const reusableCCDBricks: CCDBrick[] = [];

// Initialize pool once
for (let i = 0; i < BRICK_POOL_SIZE; i++) {
  reusableCCDBricks.push({
    id: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
    isIndestructible: false
  });
}

export function processBallWithCCD(
  ball: Ball,
  dtSeconds: number, // Changed from dt (ms) to dtSeconds
  frameTick: number, // Added deterministic frame counter
  gameState: {
    bricks: Brick[];
    paddle: Paddle;
    canvasSize: { w: number; h: number };
    speedMultiplier: number;
    minBrickDimension: number;
    boss?: Boss | null;
    resurrectedBosses?: Boss[];
    enemies?: Enemy[];
    qualityLevel?: 'potato' | 'low' | 'medium' | 'high';
  }
): CCDResult {
  // Only measure timing when debug is enabled (avoid syscall overhead on mobile)
  const shouldMeasurePerf = ENABLE_DEBUG_FEATURES;
  const perfStart = shouldMeasurePerf ? performance.now() : 0;
  
  // Quality-aware substep limits
  const qualitySubstepCaps = {
    low: 8,
    medium: 12,
    high: 20
  };
  const MAX_SUBSTEPS = qualitySubstepCaps[gameState.qualityLevel || 'high'];
  
  // Calculate adaptive substeps based on ball speed
  const ballSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
  const desiredSubsteps = Math.ceil(ballSpeed * gameState.speedMultiplier / (gameState.minBrickDimension * 0.15));
  const PHYSICS_SUBSTEPS = Math.max(2, Math.min(desiredSubsteps, MAX_SUBSTEPS));
  
  // Boss-first sweep timing (only when debug enabled)
  const bossFirstSweepStart = shouldMeasurePerf ? performance.now() : 0;
  const bossFirstSweepEnd = shouldMeasurePerf ? performance.now() : 0;

  // Convert game types to CCD types
  const ccdBall: CCDBall = {
    id: ball.id,
    x: ball.x,
    y: ball.y,
    dx: ball.dx * 60 * gameState.speedMultiplier, // Convert px/frame to px/sec and apply multiplier
    dy: ball.dy * 60 * gameState.speedMultiplier,
    radius: ball.radius,
    lastHitTick: ball.lastHitTime,
    isFireball: !!ball.isFireball // Propagate fireball flag to CCD system
  };

  // Populate reusable brick pool in-place (no new object creation)
  let brickIndex = 0;
  const gameBricks = gameState.bricks;
  for (let i = 0; i < gameBricks.length && brickIndex < BRICK_POOL_SIZE; i++) {
    const b = gameBricks[i];
    if (!b.visible) continue;
    
    const ccdBrick = reusableCCDBricks[brickIndex];
    ccdBrick.id = b.id;
    ccdBrick.x = b.x;
    ccdBrick.y = b.y;
    ccdBrick.width = b.width;
    ccdBrick.height = b.height;
    ccdBrick.visible = true;
    ccdBrick.isIndestructible = b.isIndestructible;
    brickIndex++;
  }
  
  // Use the pool directly - resurrected bosses and enemies will be added after the brick index
  // This avoids creating a new array with slice()
  const ccdBricks = reusableCCDBricks;
  let totalBrickCount = brickIndex;

  // Boss collision is now handled by explicit shape-specific collision checks in Game.tsx
  // (CCD cannot handle rotating shapes like cube and pyramid)
  // Boss has been removed from CCD system

  // Add resurrected bosses as bricks (use negative IDs)
  // Resurrected bosses also use TOP-LEFT coordinates
  if (gameState.resurrectedBosses && totalBrickCount < BRICK_POOL_SIZE) {
    const HITBOX_MARGIN = 2;
    for (let idx = 0; idx < gameState.resurrectedBosses.length && totalBrickCount < BRICK_POOL_SIZE; idx++) {
      const resBoss = gameState.resurrectedBosses[idx];
      const ccdBrick = reusableCCDBricks[totalBrickCount];
      ccdBrick.id = -(idx + 2); // Resurrected boss IDs: -2, -3, -4
      ccdBrick.x = resBoss.x + HITBOX_MARGIN;
      ccdBrick.y = resBoss.y + HITBOX_MARGIN;
      ccdBrick.width = resBoss.width - 2 * HITBOX_MARGIN;
      ccdBrick.height = resBoss.height - 2 * HITBOX_MARGIN;
      ccdBrick.visible = true;
      ccdBrick.isIndestructible = false;
      totalBrickCount++;
    }
  }

  // Add enemies as small bricks (use large positive IDs to avoid collision with brick indices)
  if (gameState.enemies && totalBrickCount < BRICK_POOL_SIZE) {
    for (let idx = 0; idx < gameState.enemies.length && totalBrickCount < BRICK_POOL_SIZE; idx++) {
      const enemy = gameState.enemies[idx];
      const ccdBrick = reusableCCDBricks[totalBrickCount];
      ccdBrick.id = 100000 + idx; // Enemy IDs: 100000+
      ccdBrick.x = enemy.x;
      ccdBrick.y = enemy.y;
      ccdBrick.width = enemy.width;
      ccdBrick.height = enemy.height;
      ccdBrick.visible = true;
      ccdBrick.isIndestructible = false;
      totalBrickCount++;
    }
  }

  // Convert paddle to CCD format
  const ccdPaddle = {
    id: 0,
    x: gameState.paddle.x,
    y: gameState.paddle.y,
    width: gameState.paddle.width,
    height: gameState.paddle.height
  };
  
  // CCD core timing (only when debug enabled)
  const ccdCoreStart = shouldMeasurePerf ? performance.now() : 0;
  
  // Run CCD with paddle included
  // Pass brickCount directly to avoid .slice() allocation
  const result = processBallCCD(ccdBall, {
    dt: dtSeconds, // Pass seconds, not milliseconds
    substeps: PHYSICS_SUBSTEPS,
    maxToiIterations: 3,
    epsilon: 0.5, // Small separation after collision
    minBrickDimension: gameState.minBrickDimension,
    paddle: ccdPaddle, // Re-included in CCD
    bricks: ccdBricks, // Pass full pool
    brickCount: totalBrickCount, // Limit to valid bricks only
    canvasSize: gameState.canvasSize,
    currentTick: frameTick, // Pass deterministic frame tick
    maxSubstepTravelFactor: 0.9,
    debug: ENABLE_DEBUG_FEATURES // Pass debug flag to CCD
  });
  
  const ccdCoreEnd = shouldMeasurePerf ? performance.now() : 0;
  
  // Post-processing timing (only when debug enabled)
  const postProcessingStart = shouldMeasurePerf ? performance.now() : 0;

  // Calculate collision count and max TOI iterations from debug data
  const collisionCount = result.events.length;
  const toiIterationsUsed = ENABLE_DEBUG_FEATURES && result.debug && Array.isArray(result.debug) 
    ? Math.max(...result.debug.map((d: any) => d.iter || 0), 0)
    : 0;

  // Convert result back to game types
  if (!result.ball) {
    const postProcessingEnd = shouldMeasurePerf ? performance.now() : 0;
    const perfEnd = shouldMeasurePerf ? performance.now() : 0;
    
    return {
      ball: null,
      events: result.events,
      debug: result.debug,
      substepsUsed: PHYSICS_SUBSTEPS,
      maxIterations: 3,
      collisionCount,
      toiIterationsUsed,
      performance: shouldMeasurePerf ? {
        bossFirstSweepMs: bossFirstSweepEnd - bossFirstSweepStart,
        ccdCoreMs: ccdCoreEnd - ccdCoreStart,
        postProcessingMs: postProcessingEnd - postProcessingStart,
        totalMs: perfEnd - perfStart
      } : undefined
    };
  }

  const updatedBall: Ball = {
    ...ball,
    x: result.ball.x,
    y: result.ball.y,
    dx: result.ball.dx / (60 * gameState.speedMultiplier), // Convert px/sec back to px/frame
    dy: result.ball.dy / (60 * gameState.speedMultiplier),
    lastHitTime: result.ball.lastHitTick
  };
  
  const postProcessingEnd = shouldMeasurePerf ? performance.now() : 0;
  const perfEnd = shouldMeasurePerf ? performance.now() : 0;

  return {
    ball: updatedBall,
    events: result.events,
    debug: result.debug,
    substepsUsed: PHYSICS_SUBSTEPS,
    maxIterations: 3,
    collisionCount,
    toiIterationsUsed,
    performance: shouldMeasurePerf ? {
      bossFirstSweepMs: bossFirstSweepEnd - bossFirstSweepStart,
      ccdCoreMs: ccdCoreEnd - ccdCoreStart,
      postProcessingMs: postProcessingEnd - postProcessingStart,
      totalMs: perfEnd - perfStart
    } : undefined
  };
}
