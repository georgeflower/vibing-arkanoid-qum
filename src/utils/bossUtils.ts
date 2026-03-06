import type { Boss, BossType } from "@/types/game";
import { BOSS_CONFIG, BOSS_POSITIONS } from "@/constants/bossConfig";

// Monotonic ID counter for bosses
let nextBossId = 1000; // Start at safe range

export function createBoss(level: number, canvasWidth: number, canvasHeight: number): Boss | null {
  let bossType: BossType;
  let config;
  
  if (level === 5) {
    bossType = 'cube';
    config = BOSS_CONFIG.cube;
  } else if (level === 10) {
    bossType = 'sphere';
    config = BOSS_CONFIG.sphere;
  } else if (level === 15) {
    bossType = 'pyramid';
    config = BOSS_CONFIG.pyramid;
  } else {
    return null;
  }
  
  const positions = BOSS_POSITIONS.map(pos => ({
    x: pos.x * canvasWidth - config.size / 2,
    y: pos.y * canvasHeight - config.size / 2
  }));
  
  // Validate positions length
  if (positions.length < 2) {
    console.error('[BossUtils] BOSS_POSITIONS has fewer than 2 entries');
    return null;
  }
  
  const maxHealth = bossType === 'cube' 
    ? config.health 
    : ('healthPhase1' in config ? config.healthPhase1 : 10);
  
  const currentHealth = bossType === 'cube' 
    ? config.health 
    : ('healthPhase1' in config ? config.healthPhase1 : 10);
  
  return {
    id: nextBossId++, // Monotonic ID
    type: bossType,
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
    maxHealth,
    currentHealth,
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
    lastHitAt: 0
  };
}

export function createResurrectedPyramid(
  parentBoss: Boss, 
  index: number, 
  canvasWidth: number, 
  canvasHeight: number
): Boss {
  const config = BOSS_CONFIG.pyramid;
  const angleOffset = (index * 120) * (Math.PI / 180);
  const spawnRadius = 60;
  
  // Safe random position index
  const randomPosIndex = Math.floor(Math.random() * parentBoss.positions.length);
  
  return {
    id: nextBossId++, // Monotonic ID
    type: 'pyramid',
    x: parentBoss.x + Math.cos(angleOffset) * spawnRadius,
    y: parentBoss.y + Math.sin(angleOffset) * spawnRadius,
    width: config.resurrectedSize,
    height: config.resurrectedSize,
    rotation: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    speed: config.angryMoveSpeed,
    dx: Math.cos(angleOffset) * 2,
    dy: Math.sin(angleOffset) * 2,
    maxHealth: config.resurrectedHealth,
    currentHealth: config.resurrectedHealth,
    phase: 'moving',
    currentStage: 2,
    isAngry: true,
    isSuperAngry: false,
    targetPosition: parentBoss.positions[randomPosIndex],
    currentPositionIndex: randomPosIndex,
    positions: parentBoss.positions,
    waitTimeAtPosition: 0,
    attackCooldown: config.attackInterval * 0.7,
    lastAttackTime: Date.now(),
    isCharging: false,
    parentBossId: parentBoss.id,
    isResurrected: true,
    lastHitAt: 0
  };
}
