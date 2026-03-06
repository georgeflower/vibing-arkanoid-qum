// Mega Boss creation and management utilities
import type { Boss, Ball } from "@/types/game";
import { MEGA_BOSS_CONFIG, MEGA_BOSS_POSITIONS, MEGA_BOSS_LEVEL } from "@/constants/megaBossConfig";

// Phase represents the current stage of the boss fight
export type MegaBossCorePhase = 1 | 2 | 3;

// Extended MegaBoss interface (used internally, extends Boss)
export interface MegaBoss extends Boss {
  isMegaBoss: true;
  
  // Core phase tracking (1 = normal, 2 = angry, 3 = very angry)
  corePhase: MegaBossCorePhase;
  
  // Outer shield HP (depletes to 0, then core is exposed)
  outerShieldHP: number;
  outerShieldMaxHP: number;
  
  // Inner shield (smaller octagon, replaces outer after phase transition)
  innerShieldHP: number;
  innerShieldMaxHP: number;
  outerShieldRemoved: boolean; // If true, use inner shield instead
  
  // Core state
  coreExposed: boolean;
  coreExposedTime: number | null;
  coreHit: boolean; // Ball has hit the core this phase
  
  // Trapped ball state
  trappedBall: Ball | null;
  cannonExtended: boolean;
  cannonExtendedTime: number | null;
  
  // Danger ball tracking - now counts core HITS from reflected balls
  dangerBallsCaught: number; // Legacy - kept for compatibility
  coreHitsFromDangerBalls: number; // NEW: counts hits on core from reflected danger balls
  dangerBallsFired: number;
  scheduledDangerBalls: number[]; // Timestamps for scheduled danger ball spawns
  
  // Legacy compatibility
  hatchOpen: boolean;
  hatchOpenStartTime: number | null;
  lastTrapTime: number;
  hasResurrected: boolean; // For visual indicator only
  isInvulnerable: boolean;
  invulnerableUntil: number;
  
  // Swarm tracking (phase 3)
  lastSwarmSpawnTime: number;
}

// Monotonic ID counter for mega boss
let nextMegaBossId = 2000;

export function createMegaBoss(canvasWidth: number, canvasHeight: number): MegaBoss {
  const config = MEGA_BOSS_CONFIG;
  
  const positions = MEGA_BOSS_POSITIONS.map(pos => ({
    x: pos.x * canvasWidth - config.size / 2,
    y: pos.y * canvasHeight - config.size / 2
  }));
  
  return {
    id: nextMegaBossId++,
    type: 'mega', // Unique type identifier for Mega Boss
    x: positions[0].x,
    y: positions[0].y,
    width: config.size,
    height: config.size,
    rotation: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    speed: config.moveSpeed,
    dx: 0,
    dy: 0,
    maxHealth: config.outerShieldHP,
    currentHealth: config.outerShieldHP,
    phase: 'moving',
    currentStage: 1,
    isAngry: false,
    isSuperAngry: false,
    targetPosition: positions[1],
    currentPositionIndex: 0,
    positions: positions,
    waitTimeAtPosition: 0,
    attackCooldown: config.attackInterval,
    lastAttackTime: Date.now(),
    isCharging: false,
    lastHitAt: 0,
    
    // MegaBoss specific
    isMegaBoss: true,
    corePhase: 1,
    outerShieldHP: config.outerShieldHP,
    outerShieldMaxHP: config.outerShieldHP,
    innerShieldHP: config.innerShieldHP || 6,
    innerShieldMaxHP: config.innerShieldHP || 6,
    outerShieldRemoved: false,
    coreExposed: false,
    coreExposedTime: null,
    coreHit: false,
    trappedBall: null,
    cannonExtended: false,
    cannonExtendedTime: null,
    dangerBallsCaught: 0,
    coreHitsFromDangerBalls: 0,
    dangerBallsFired: 0,
    scheduledDangerBalls: [],
    hatchOpen: false,
    hatchOpenStartTime: null,
    lastTrapTime: 0,
    hasResurrected: false,
    isInvulnerable: false,
    invulnerableUntil: 0,
    lastSwarmSpawnTime: 0
  };
}

export function isMegaBoss(boss: Boss | null): boss is MegaBoss {
  return boss !== null && 'isMegaBoss' in boss && (boss as MegaBoss).isMegaBoss === true;
}

// Handle damage to outer/inner shield - returns new state info
export function handleMegaBossOuterDamage(boss: MegaBoss, damage: number): {
  newOuterHP: number;
  newInnerHP: number;
  shouldExposeCore: boolean;
} {
  // Check invulnerability
  if (boss.isInvulnerable && Date.now() < boss.invulnerableUntil) {
    return { 
      newOuterHP: boss.outerShieldHP, 
      newInnerHP: boss.innerShieldHP,
      shouldExposeCore: false 
    };
  }
  
  // Don't damage if core is already exposed
  if (boss.coreExposed) {
    return { 
      newOuterHP: boss.outerShieldHP, 
      newInnerHP: boss.innerShieldHP,
      shouldExposeCore: false 
    };
  }
  
  // Route damage to inner shield if outer is removed
  if (boss.outerShieldRemoved) {
    const newInnerHP = Math.max(0, boss.innerShieldHP - damage);
    const shouldExposeCore = newInnerHP <= 0;
    return { newOuterHP: boss.outerShieldHP, newInnerHP, shouldExposeCore };
  }
  
  // Otherwise damage outer shield
  const newOuterHP = Math.max(0, boss.outerShieldHP - damage);
  const shouldExposeCore = newOuterHP <= 0;
  
  return { newOuterHP, newInnerHP: boss.innerShieldHP, shouldExposeCore };
}

// Increment core hits from reflected danger balls
export function incrementCoreHit(boss: MegaBoss): MegaBoss {
  return {
    ...boss,
    coreHitsFromDangerBalls: boss.coreHitsFromDangerBalls + 1
  };
}

// Check if all core hits are complete
export function hasSufficientCoreHits(boss: MegaBoss): boolean {
  const config = MEGA_BOSS_CONFIG;
  return boss.coreHitsFromDangerBalls >= config.dangerBallsToComplete;
}

// Expose the core (hatch opens)
export function exposeMegaBossCore(boss: MegaBoss): MegaBoss {
  const now = Date.now();
  return {
    ...boss,
    coreExposed: true,
    coreExposedTime: now,
    hatchOpen: true,
    hatchOpenStartTime: now
  };
}

// Handle core hit (ball enters and hits the core)
export function handleMegaBossCoreHit(boss: MegaBoss, ball: Ball): MegaBoss {
  const config = MEGA_BOSS_CONFIG;
  const now = Date.now();
  
  // Schedule danger ball spawns
  const scheduledDangerBalls: number[] = [];
  let nextTime = now + 1000; // First one after 1 second
  
  for (let i = 0; i < config.dangerBallCount; i++) {
    const interval = config.dangerBallIntervalMin + 
      Math.random() * (config.dangerBallIntervalMax - config.dangerBallIntervalMin);
    nextTime += interval;
    scheduledDangerBalls.push(nextTime);
  }
  
  return {
    ...boss,
    coreHit: true,
    trappedBall: { ...ball } as Ball,
    cannonExtended: true,
    cannonExtendedTime: now,
    scheduledDangerBalls,
    dangerBallsFired: 0,
    dangerBallsCaught: 0,
    coreHitsFromDangerBalls: 0, // Reset core hits for new danger ball phase
    hatchOpen: false, // Close hatch after ball trapped
    coreExposed: false, // Core no longer exposed
    lastTrapTime: now
  };
}

// Increment danger balls caught
export function catchDangerBall(boss: MegaBoss): MegaBoss {
  return {
    ...boss,
    dangerBallsCaught: boss.dangerBallsCaught + 1
  };
}

// Check if all core hits are complete and player ball should be released
export function shouldReleaseBall(boss: MegaBoss): boolean {
  const config = MEGA_BOSS_CONFIG;
  return (
    boss.trappedBall !== null &&
    boss.coreHitsFromDangerBalls >= config.dangerBallsToComplete &&
    boss.scheduledDangerBalls.length === 0
  );
}

// Release trapped ball and transition to next phase
export function releaseBallAndNextPhase(boss: MegaBoss): { boss: MegaBoss; releasedBall: Ball | null; isDefeated: boolean } {
  const config = MEGA_BOSS_CONFIG;
  
  if (!boss.trappedBall) {
    return { boss, releasedBall: null, isDefeated: false };
  }
  
  // Check if boss is in top third of screen - if so, release ball downward
  const canvasHeight = boss.y + boss.height + 200; // Estimate canvas height from boss position
  const isInTopThird = boss.y < canvasHeight / 3;
  
  let releasedBall: Ball;
  
  if (isInTopThird) {
    // Release downward with random angle to avoid getting stuck
    const randomAngle = (Math.random() - 0.5) * Math.PI / 3; // Random angle ±30 degrees from vertical
    const speed = 4;
    releasedBall = {
      ...boss.trappedBall,
      x: boss.x + boss.width / 2,
      y: boss.y + boss.height + 15, // Release below the boss
      dx: Math.sin(randomAngle) * speed,
      dy: Math.cos(randomAngle) * speed, // Positive = downward
      waitingToLaunch: false,
      releasedFromBossTime: Date.now()
    };
  } else {
    // Release upward normally
    releasedBall = {
      ...boss.trappedBall,
      x: boss.x + boss.width / 2,
      y: boss.y - 15, // Release above the boss
      dx: 0,
      dy: -4, // Release upwards
      waitingToLaunch: false,
      releasedFromBossTime: Date.now()
    };
  }
  
  const nextPhase = (boss.corePhase + 1) as MegaBossCorePhase;
  
  // Check if boss is defeated (completed phase 3)
  if (boss.corePhase >= 3) {
    return {
      boss: {
        ...boss,
        trappedBall: null,
        cannonExtended: false,
        currentHealth: 0
      },
      releasedBall,
      isDefeated: true
    };
  }
  
  // Transition to next phase - outer shield is now REMOVED, inner shield becomes active
  const isAngry = nextPhase >= 2;
  const isVeryAngry = nextPhase >= 3;
  const newSpeed = isVeryAngry ? config.veryAngryMoveSpeed : (isAngry ? config.angryMoveSpeed : config.moveSpeed);
  const newAttackInterval = isVeryAngry ? config.veryAngryAttackInterval : (isAngry ? config.angryAttackInterval : config.attackInterval);
  
  // After completing phase 1, outer shield is removed and inner shield becomes the target
  const newInnerShieldHP = config.innerShieldHP || 6;
  
  return {
    boss: {
      ...boss,
      corePhase: nextPhase,
      // Outer shield is now removed - inner octagon becomes the shield
      outerShieldRemoved: true,
      outerShieldHP: 0,
      outerShieldMaxHP: config.outerShieldHP,
      innerShieldHP: newInnerShieldHP,
      innerShieldMaxHP: newInnerShieldHP,
      currentHealth: newInnerShieldHP, // For health bar display
      maxHealth: newInnerShieldHP,
      coreExposed: false,
      coreHit: false,
      trappedBall: null,
      cannonExtended: false,
      cannonExtendedTime: null,
      dangerBallsCaught: 0,
      coreHitsFromDangerBalls: 0,
      dangerBallsFired: 0,
      scheduledDangerBalls: [],
      isAngry,
      isSuperAngry: isVeryAngry,
      hasResurrected: nextPhase >= 2, // Visual indicator
      speed: newSpeed,
      attackCooldown: newAttackInterval,
      isInvulnerable: true,
      invulnerableUntil: Date.now() + 1500 // Brief invuln after phase change
    },
    releasedBall,
    isDefeated: false
  };
}

export function getMegaBossPhase(boss: MegaBoss): 1 | 2 | 3 {
  return boss.corePhase;
}

// Check if ball enters hatch/core area
export function isBallInHatchArea(ball: Ball, boss: MegaBoss): boolean {
  if (!boss.coreExposed) return false;
  
  // Core is at center of boss
  const coreX = boss.x + boss.width / 2;
  const coreY = boss.y + boss.height / 2;
  const coreRadius = 60; // LARGER hit area for easier core hit
  
  const dx = ball.x - coreX;
  const dy = ball.y - coreY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  return dist < coreRadius + ball.radius;
}

// Check if ball is inside the mega boss bounding box (for gravity well effect)
export function isBallInsideMegaBoss(ball: Ball, boss: MegaBoss): boolean {
  const bossLeft = boss.x;
  const bossRight = boss.x + boss.width;
  const bossTop = boss.y;
  const bossBottom = boss.y + boss.height;
  
  return ball.x > bossLeft && ball.x < bossRight && ball.y > bossTop && ball.y < bossBottom;
}

// Apply gravity well effect to pull ball toward core
export function applyGravityWellToBall(ball: Ball, boss: MegaBoss): Ball {
  const coreX = boss.x + boss.width / 2;
  const coreY = boss.y + boss.height / 2;
  
  const dx = coreX - ball.x;
  const dy = coreY - ball.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < 5) {
    // Ball is essentially at core
    return ball;
  }
  
  // Normalize direction and apply attraction
  const attractionStrength = 0.5;
  const newDx = ball.dx + (dx / dist) * attractionStrength;
  const newDy = ball.dy + (dy / dist) * attractionStrength;
  
  // Limit max speed
  const speed = Math.sqrt(newDx * newDx + newDy * newDy);
  const maxSpeed = 6;
  
  if (speed > maxSpeed) {
    return {
      ...ball,
      dx: (newDx / speed) * maxSpeed,
      dy: (newDy / speed) * maxSpeed
    };
  }
  
  return {
    ...ball,
    dx: newDx,
    dy: newDy
  };
}

// Check if danger ball phase should end (all danger balls dealt with)
export function shouldEndDangerBallPhase(boss: MegaBoss): boolean {
  const config = MEGA_BOSS_CONFIG;
  // Phase ends when all 5 danger balls have been fired AND there are no more scheduled
  return (
    boss.trappedBall !== null &&
    boss.dangerBallsFired >= config.dangerBallCount &&
    boss.scheduledDangerBalls.length === 0
  );
}

// Reset phase progress after failing to catch all danger balls
export function resetMegaBossPhaseProgress(boss: MegaBoss): { boss: MegaBoss; releasedBall: Ball | null } {
  const config = MEGA_BOSS_CONFIG;
  
  if (!boss.trappedBall) {
    return { boss, releasedBall: null };
  }
  
  // Release the ball
  const releasedBall: Ball = {
    ...boss.trappedBall,
    x: boss.x + boss.width / 2,
    y: boss.y + boss.height + 15,
    dx: 0,
    dy: 4,
    waitingToLaunch: false,
    releasedFromBossTime: Date.now() // Track when ball was released for paddle collision grace period
  };
  
  // Reset shield HP for another attempt - use inner shield if outer is removed
  const shieldHP = boss.outerShieldRemoved ? (config.innerShieldHP || 6) : config.outerShieldHP;
  
  return {
    boss: {
      ...boss,
      outerShieldHP: boss.outerShieldRemoved ? 0 : config.outerShieldHP,
      outerShieldMaxHP: config.outerShieldHP,
      innerShieldHP: boss.outerShieldRemoved ? shieldHP : boss.innerShieldHP,
      innerShieldMaxHP: config.innerShieldHP || 6,
      currentHealth: shieldHP,
      maxHealth: shieldHP,
      coreExposed: false,
      coreExposedTime: null,
      coreHit: false,
      trappedBall: null,
      cannonExtended: false,
      cannonExtendedTime: null,
      dangerBallsCaught: 0,
      coreHitsFromDangerBalls: 0,
      dangerBallsFired: 0,
      scheduledDangerBalls: [],
      hatchOpen: false
    },
    releasedBall
  };
}

// Check if should spawn swarm enemies (phase 3)
export function shouldSpawnSwarm(boss: MegaBoss): boolean {
  if (boss.corePhase < 3) return false;
  
  const config = MEGA_BOSS_CONFIG;
  const now = Date.now();
  
  return now - boss.lastSwarmSpawnTime >= config.swarmSpawnInterval;
}

export function markSwarmSpawned(boss: MegaBoss): MegaBoss {
  return {
    ...boss,
    lastSwarmSpawnTime: Date.now()
  };
}
