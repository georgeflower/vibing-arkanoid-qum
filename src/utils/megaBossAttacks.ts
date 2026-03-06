// Mega Boss attack patterns and danger ball system
import type { Boss, BossAttack, Ball } from "@/types/game";
import { MEGA_BOSS_CONFIG, CORNER_TARGETS } from "@/constants/megaBossConfig";
import { ATTACK_PATTERNS } from "@/constants/bossConfig";
import { MegaBoss, getMegaBossPhase, isMegaBoss } from "./megaBossUtils";
import { soundManager } from "./sounds";
import { debugToast as toast } from "@/utils/debugToast";

export interface DangerBall {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  speed: number;
  targetCorner: typeof CORNER_TARGETS[number];
  flashPhase: number; // For white/red flashing animation
  spawnTime: number;
  isReflected: boolean; // Has this ball been reflected by paddle?
  isHoming: boolean; // Is this ball now homing toward the core?
}

let nextDangerBallId = 3000;

// Spawn a danger ball from the cannon (shoots downward toward paddle)
export function spawnDangerBall(boss: MegaBoss): DangerBall {
  const config = MEGA_BOSS_CONFIG;
  
  // Pick random corner as general direction target
  const targetCorner = CORNER_TARGETS[Math.floor(Math.random() * CORNER_TARGETS.length)];
  
  // Shoot mostly downward with some spread toward corners
  const bossX = boss.x + boss.width / 2;
  const bossY = boss.y + boss.height;
  
  // Random angle between 60 and 120 degrees (downward spread)
  const baseAngle = Math.PI / 2; // Straight down
  const spread = (Math.random() - 0.5) * (Math.PI / 3); // ±30 degrees
  const angle = baseAngle + spread;
  
  return {
    id: nextDangerBallId++,
    x: bossX,
    y: bossY + 30, // Below cannon muzzle
    dx: Math.cos(angle) * config.dangerBallSpeed,
    dy: Math.sin(angle) * config.dangerBallSpeed,
    radius: config.dangerBallSize,
    speed: config.dangerBallSpeed,
    targetCorner,
    flashPhase: 0,
    spawnTime: Date.now(),
    isReflected: false,
    isHoming: false
  };
}

// Update danger ball position and animation, with wall bouncing
export function updateDangerBall(ball: DangerBall, canvasWidth: number = 800, deltaTimeSeconds: number = 1 / 60): DangerBall {
  let newX = ball.x + ball.dx * deltaTimeSeconds;
  let newY = ball.y + ball.dy * deltaTimeSeconds;
  let newDx = ball.dx;
  
  // Bounce off side walls (only for non-reflected balls to keep them catchable)
  if (!ball.isReflected) {
    if (newX - ball.radius < 0) {
      newX = ball.radius;
      newDx = Math.abs(ball.dx); // Bounce right
    } else if (newX + ball.radius > canvasWidth) {
      newX = canvasWidth - ball.radius;
      newDx = -Math.abs(ball.dx); // Bounce left
    }
  }
  
  return {
    ...ball,
    x: newX,
    y: newY,
    dx: newDx,
    flashPhase: (ball.flashPhase + 9 * deltaTimeSeconds) % (Math.PI * 2) // 9 rad/s = 0.15 rad/frame at 60fps
  };
}

// Check if danger ball reached bottom (player loses life if not caught)
export function isDangerBallAtBottom(ball: DangerBall, canvasHeight: number): boolean {
  return ball.y + ball.radius >= canvasHeight - 10;
}

// Check if danger ball was caught by paddle (collision = catch)
export function isDangerBallIntercepted(
  ball: DangerBall,
  paddleX: number,
  paddleY: number,
  paddleWidth: number,
  paddleHeight: number
): boolean {
  return (
    ball.x + ball.radius > paddleX &&
    ball.x - ball.radius < paddleX + paddleWidth &&
    ball.y + ball.radius > paddleY &&
    ball.y - ball.radius < paddleY + paddleHeight
  );
}

// Reflect danger ball off paddle and enable homing toward core
export function reflectDangerBall(ball: DangerBall, paddleX: number, paddleWidth: number): DangerBall {
  // Calculate hit position on paddle (-1 to 1)
  const hitPos = ((ball.x - paddleX) / paddleWidth) * 2 - 1;
  
  // Reflect angle based on hit position - steeper angle for better homing
  const reflectAngle = hitPos * (Math.PI / 3); // ±60 degrees spread
  const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy) * 1.2; // Speed boost on reflect
  
  return {
    ...ball,
    dx: Math.sin(reflectAngle) * speed,
    dy: -Math.abs(Math.cos(reflectAngle)) * speed, // Always go up
    isReflected: true,
    isHoming: true,
    speed: speed
  };
}

// Apply homing steering toward boss core
export function applyHomingToDangerBall(ball: DangerBall, bossX: number, bossY: number, bossWidth: number, bossHeight: number): DangerBall {
  if (!ball.isHoming) return ball;
  
  // Target the core center
  const coreX = bossX + bossWidth / 2;
  const coreY = bossY + bossHeight / 2;
  
  // Calculate direction to core
  const toTargetX = coreX - ball.x;
  const toTargetY = coreY - ball.y;
  const distToTarget = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);
  
  if (distToTarget < 5) return ball; // Already at target
  
  // Normalize target direction
  const normTargetX = toTargetX / distToTarget;
  const normTargetY = toTargetY / distToTarget;
  
  // Current direction
  const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
  const normDirX = ball.dx / currentSpeed;
  const normDirY = ball.dy / currentSpeed;
  
  // Steering strength - stronger homing for danger balls
  const steeringStrength = 0.12;
  
  // Blend current direction with target direction
  let newDx = normDirX * (1 - steeringStrength) + normTargetX * steeringStrength;
  let newDy = normDirY * (1 - steeringStrength) + normTargetY * steeringStrength;
  
  // Normalize and apply speed
  const newMag = Math.sqrt(newDx * newDx + newDy * newDy);
  newDx = (newDx / newMag) * ball.speed;
  newDy = (newDy / newMag) * ball.speed;
  
  return {
    ...ball,
    dx: newDx,
    dy: newDy
  };
}

// Check if danger ball has hit the boss core
export function isDangerBallAtCore(ball: DangerBall, bossX: number, bossY: number, bossWidth: number, bossHeight: number): boolean {
  if (!ball.isReflected) return false;
  
  const coreX = bossX + bossWidth / 2;
  const coreY = bossY + bossHeight / 2;
  const coreRadius = 50; // Generous hit area for the core
  
  const dx = ball.x - coreX;
  const dy = ball.y - coreY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  return dist < coreRadius + ball.radius;
}

// Check if reflected danger ball has missed (gone off screen)
export function hasReflectedBallMissed(ball: DangerBall, canvasWidth: number, canvasHeight: number): boolean {
  if (!ball.isReflected) return false;
  
  // Check if off screen (top, sides)
  return ball.y < -50 || ball.x < -50 || ball.x > canvasWidth + 50;
}

// Mega Boss attack types
export type MegaBossAttackType = 'hatchSalvo' | 'sweepTurret' | 'phaseBurst' | 'shot' | 'super' | 'laser' | 'cross';

// Perform a Mega Boss attack
export function performMegaBossAttack(
  boss: MegaBoss,
  paddleX: number,
  paddleY: number,
  setBossAttacks: React.Dispatch<React.SetStateAction<BossAttack[]>>,
  setLaserWarnings: React.Dispatch<React.SetStateAction<Array<{ x: number; startTime: number }>>>,
  setSuperWarnings: React.Dispatch<React.SetStateAction<Array<{ x: number; y: number; startTime: number }>>>
): MegaBossAttackType {
  const phase = getMegaBossPhase(boss);
  const weights = MEGA_BOSS_CONFIG.attackWeights[`phase${phase}` as keyof typeof MEGA_BOSS_CONFIG.attackWeights];
  
  // Weighted random selection
  const rand = Math.random();
  let cumulative = 0;
  let selectedAttack: MegaBossAttackType = 'shot';
  
  for (const [attack, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (rand < cumulative) {
      selectedAttack = attack as MegaBossAttackType;
      break;
    }
  }
  
  soundManager.playBombDropSound();
  
  switch (selectedAttack) {
    case 'hatchSalvo':
      performHatchSalvo(boss, setBossAttacks);
      break;
    case 'sweepTurret':
      performSweepTurret(boss, paddleX, paddleY, setBossAttacks);
      break;
    case 'phaseBurst':
      performPhaseBurst(boss, setBossAttacks);
      break;
    case 'super':
      performSuperAttack(boss, setBossAttacks, setSuperWarnings);
      break;
    case 'laser':
      performLaserAttack(boss, setBossAttacks, setLaserWarnings);
      break;
    case 'cross':
      performCrossAttack(boss, paddleX, paddleY, setBossAttacks);
      break;
    case 'shot':
    default:
      performShotAttack(boss, paddleX, paddleY, setBossAttacks);
      break;
  }
  
  return selectedAttack;
}

function performShotAttack(
  boss: MegaBoss,
  paddleX: number,
  paddleY: number,
  setBossAttacks: React.Dispatch<React.SetStateAction<BossAttack[]>>
) {
  const angle = Math.atan2(paddleY - (boss.y + boss.height / 2), paddleX - (boss.x + boss.width / 2));
  
  // More shots in higher phases
  const shotCount = boss.corePhase >= 3 ? 3 : (boss.corePhase >= 2 ? 2 : 1);
  const attacks: BossAttack[] = [];
  
  for (let i = 0; i < shotCount; i++) {
    const spreadAngle = shotCount > 1 ? (i - (shotCount - 1) / 2) * 0.2 : 0;
    const finalAngle = angle + spreadAngle;
    
    attacks.push({
      bossId: boss.id,
      type: 'shot',
      x: boss.x + boss.width / 2,
      y: boss.y + boss.height / 2,
      width: 12,
      height: 12,
      speed: 4,
      angle: finalAngle,
      dx: Math.cos(finalAngle) * 4,
      dy: Math.sin(finalAngle) * 4,
      damage: 1
    });
  }
  
  setBossAttacks(prev => [...prev, ...attacks]);
}

function performLaserAttack(
  boss: MegaBoss,
  setBossAttacks: React.Dispatch<React.SetStateAction<BossAttack[]>>,
  setLaserWarnings: React.Dispatch<React.SetStateAction<Array<{ x: number; startTime: number }>>>
) {
  const laserX = boss.x + boss.width / 2 - 4; // 8px wide laser centered
  
  setLaserWarnings(prev => [...prev, { x: laserX, startTime: Date.now() }]);
  toast.warning("MEGA BOSS CHARGING LASER!", { duration: 1000 });
  soundManager.playLaserChargingSound();
  
  setTimeout(() => {
    const laserStartY = boss.y + boss.height;
    const laserHeight = 650 - laserStartY;
    
    const attack: BossAttack = {
      bossId: boss.id,
      type: 'laser',
      x: laserX,
      y: laserStartY,
      width: 8,
      height: laserHeight,
      speed: 0,
      dx: 0,
      dy: 0,
      damage: 1
    };
    
    setBossAttacks(prev => [...prev, attack]);
    soundManager.playExplosion();
    
    // Remove laser after duration
    setTimeout(() => {
      setBossAttacks(prev => prev.filter(a => !(a.type === 'laser' && a.bossId === boss.id && a.x === laserX)));
    }, 500);
    
  }, 800); // Warning duration before laser fires
}

function performHatchSalvo(
  boss: MegaBoss,
  setBossAttacks: React.Dispatch<React.SetStateAction<BossAttack[]>>
) {
  // Fire a cone of micro-projectiles downward from hatch
  const attacks: BossAttack[] = [];
  const centerX = boss.x + boss.width / 2;
  const centerY = boss.y + boss.height;
  
  const salvoCount = boss.corePhase >= 3 ? 7 : 5;
  
  for (let i = 0; i < salvoCount; i++) {
    const spreadAngle = (i - (salvoCount - 1) / 2) * 0.15;
    const angle = Math.PI / 2 + spreadAngle;
    
    attacks.push({
      bossId: boss.id,
      type: 'shot',
      x: centerX,
      y: centerY,
      width: 8,
      height: 8,
      speed: 3.5,
      angle,
      dx: Math.cos(angle) * 3.5,
      dy: Math.sin(angle) * 3.5,
      damage: 1
    });
  }
  
  setBossAttacks(prev => [...prev, ...attacks]);
  toast.warning("MEGA BOSS SALVO!");
}

function performSweepTurret(
  boss: MegaBoss,
  paddleX: number,
  paddleY: number,
  setBossAttacks: React.Dispatch<React.SetStateAction<BossAttack[]>>
) {
  // Fire a slow, heavy shot that lingers
  const angle = Math.atan2(paddleY - (boss.y + boss.height / 2), paddleX - (boss.x + boss.width / 2));
  
  const attack: BossAttack = {
    bossId: boss.id,
    type: 'super',
    x: boss.x + boss.width / 2,
    y: boss.y + boss.height / 2,
    width: 20,
    height: 20,
    speed: 2.5,
    angle,
    dx: Math.cos(angle) * 2.5,
    dy: Math.sin(angle) * 2.5,
    damage: 1
  };
  
  setBossAttacks(prev => [...prev, attack]);
  toast.warning("MEGA BOSS SWEEP!");
}


function performPhaseBurst(
  boss: MegaBoss,
  setBossAttacks: React.Dispatch<React.SetStateAction<BossAttack[]>>
) {
  // Radial burst of projectiles
  const attacks: BossAttack[] = [];
  const centerX = boss.x + boss.width / 2;
  const centerY = boss.y + boss.height / 2;
  const count = boss.corePhase >= 3 ? 20 : 16;
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    
    attacks.push({
      bossId: boss.id,
      type: 'spiral',
      x: centerX,
      y: centerY,
      width: 10,
      height: 10,
      speed: 3.5,
      angle,
      dx: Math.cos(angle) * 3.5,
      dy: Math.sin(angle) * 3.5,
      damage: 1
    });
  }
  
  setBossAttacks(prev => [...prev, ...attacks]);
  toast.error("🔥 PHASE BURST!");
  soundManager.playExplosion();
}

function performSuperAttack(
  boss: MegaBoss,
  setBossAttacks: React.Dispatch<React.SetStateAction<BossAttack[]>>,
  setSuperWarnings: React.Dispatch<React.SetStateAction<Array<{ x: number; y: number; startTime: number }>>>
) {
  // ... keep existing code
  const centerX = boss.x + boss.width / 2;
  const centerY = boss.y + boss.height / 2;
  
  setSuperWarnings(prev => [...prev, { x: centerX, y: centerY, startTime: Date.now() }]);
  toast.error("MEGA BOSS SUPER ATTACK!");
  soundManager.playShoot();
  
  setTimeout(() => {
    const attacks: BossAttack[] = [];
    const count = 8;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      
      attacks.push({
        bossId: boss.id,
        type: 'super',
        x: centerX,
        y: centerY,
        width: 10,
        height: 10,
        speed: 3.5,
        angle,
        dx: Math.cos(angle) * 3.5,
        dy: Math.sin(angle) * 3.5,
        damage: 1
      });
    }
    
    setBossAttacks(prev => [...prev, ...attacks]);
    soundManager.playExplosion();
  }, 600);
}

function performCrossAttack(
  boss: MegaBoss,
  paddleX: number,
  paddleY: number,
  setBossAttacks: React.Dispatch<React.SetStateAction<BossAttack[]>>
) {
  const centerX = boss.x + boss.width / 2;
  const centerY = boss.y + boss.height / 2;
  const attacks: BossAttack[] = [];
  
  const baseAngle = Math.atan2(paddleY - centerY, paddleX - centerX);
  const coneSpread = (ATTACK_PATTERNS.cross.coneAngle * Math.PI) / 180;
  
  // Phase 3: 5 projectiles in wider cone, Phase 2: 3 projectiles
  const count = boss.corePhase >= 3 ? 5 : 3;
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(-coneSpread / 2 + (coneSpread * i) / (count - 1));
  }
  const now = Date.now();
  
  offsets.forEach(offset => {
    const angle = baseAngle + offset;
    
    attacks.push({
      bossId: boss.id,
      type: 'cross',
      x: centerX,
      y: centerY,
      width: ATTACK_PATTERNS.cross.size,
      height: ATTACK_PATTERNS.cross.size,
      speed: ATTACK_PATTERNS.cross.speed,
      angle,
      dx: Math.cos(angle) * ATTACK_PATTERNS.cross.speed,
      dy: Math.sin(angle) * ATTACK_PATTERNS.cross.speed,
      damage: 1,
      isStopped: false,
      nextCourseChangeTime: now + ATTACK_PATTERNS.cross.courseChangeMinInterval +
        Math.random() * (ATTACK_PATTERNS.cross.courseChangeMaxInterval - ATTACK_PATTERNS.cross.courseChangeMinInterval),
      spawnTime: now
    });
  });
  
  setBossAttacks(prev => [...prev, ...attacks]);
  toast.warning("MEGA BOSS CROSS ATTACK!");
  soundManager.playBombDropSound();
}
