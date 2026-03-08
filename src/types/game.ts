export type BrickType = "normal" | "metal" | "cracked" | "explosive";

export interface Brick {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  visible: boolean;
  points: number;
  hasPowerUp?: boolean;
  maxHits: number;
  hitsRemaining: number;
  isIndestructible?: boolean;
  type: BrickType;
}

export interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  speed: number;
  id: number;
  isFireball?: boolean;
  waitingToLaunch?: boolean;
  rotation?: number; // For 3D spinning effect
  lastHitTime?: number; // Timestamp of last brick hit
  lastWallHitTime?: number; // Timestamp of last wall hit (for cooldown)
  skipRemainingSubsteps?: boolean; // Exit substep loop after brick hit to prevent tunneling
  isHoming?: boolean; // Ball curves toward boss
  previousY?: number; // Y position before CCD pass (for anti-rescue check)
  lastPaddleHitTime?: number; // Timestamp (ms) of last paddle hit (for cooldown)
  releasedFromBossTime?: number; // Timestamp when ball was released from Mega Boss
  releaseSpeedScale?: number; // Speed multiplier for slow-start ramp (0.3 → 1.0)
  lastGravityResetTime?: number; // Last collision time (paddle/brick/enemy) for gravity delay
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  hasTurrets?: boolean;
  hasShield?: boolean;
  turretShots?: number;
  hasReflectShield?: boolean;
  hasSuperTurrets?: boolean;
  hasSecondChance?: boolean;
}

export interface Bullet {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  isBounced?: boolean;
  isSuper?: boolean;
}

export type PowerUpType = "multiball" | "turrets" | "fireball" | "life" | "slowdown" | "paddleExtend" | "paddleShrink" | "shield" | "bossStunner" | "reflectShield" | "homingBall" | "secondChance";

export interface PowerUp {
  x: number;
  y: number;
  width: number;
  height: number;
  type: PowerUpType;
  speed: number;
  active: boolean;
  isMercyLife?: boolean; // Bypass per-5-levels limit for mercy power-ups
  id?: number; // Unique ID for pairing
  pairedWithId?: number; // ID of the other power-up in a dual choice pair
  isDualChoice?: boolean; // Flag for rendering the visual connector
}

export type EnemyType = "cube" | "sphere" | "pyramid" | "crossBall";

export interface Enemy {
  id?: number;
  type: EnemyType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  speed: number;
  dx: number;
  dy: number;
  hits?: number; // For sphere enemies (2 hits to destroy)
  isAngry?: boolean; // For sphere enemies after first hit
  isCrossBall?: boolean; // Created from merged cross projectiles
  isLargeSphere?: boolean; // Created from merged crossBall enemies (3 hits)
  spawnTime?: number; // Time when enemy was spawned (for merge cooldown)
}

export type ProjectileType = "bomb" | "rocket" | "pyramidBullet";

export interface Bomb {
  id: number; // Unique bomb identifier for reliable removal
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  enemyId?: number;
  type: ProjectileType;
  dx?: number; // For rockets with magnetic behavior
  dy?: number; // Vertical velocity for homing
  isReflected?: boolean; // Track if bomb is reflected on boss levels
}

export type BonusLetterType = "Q" | "U" | "M" | "R" | "A" | "N";

export interface BonusLetter {
  x: number;
  y: number;
  originX: number; // Original X position for sine wave calculation
  spawnTime: number; // Time when letter was spawned for sine wave phase
  width: number;
  height: number;
  type: BonusLetterType;
  speed: number;
  active: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  useCircle?: boolean; // true = arc (celebration/highscore), false/undefined = fillRect (debris)
}

export interface ShieldImpact {
  x: number;
  y: number;
  startTime: number;
  duration: number;
}

export interface Explosion {
  x: number;
  y: number;
  frame: number;
  maxFrames: number;
  enemyType?: EnemyType;
  particles: Particle[];
}

export type BossType = "cube" | "sphere" | "pyramid" | "mega";
export type BossPhase = "idle" | "moving" | "attacking" | "transitioning" | "defeated";
export type BossAttackType = "shot" | "laser" | "super" | "spiral" | "cross" | "rocket";

export interface Boss {
  id: number;
  type: BossType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  speed: number;
  dx: number;
  dy: number;
  
  // Boss-specific properties
  maxHealth: number;
  currentHealth: number;
  phase: BossPhase;
  currentStage: number;
  isAngry: boolean;
  isSuperAngry: boolean;
  
  // Movement pattern
  targetPosition: { x: number; y: number };
  currentPositionIndex: number;
  positions: Array<{ x: number; y: number }>;
  waitTimeAtPosition: number;
  
  // Attack system
  attackCooldown: number;
  lastAttackTime: number;
  isCharging: boolean;
  
  // Resurrection (for pyramid)
  parentBossId?: number;
  isResurrected?: boolean;
  
  // Boss-local hit cooldown timestamp
  lastHitAt?: number;
  
  // Boss stun
  isStunned?: boolean;
  stunnedUntil?: number;
}

export interface BossAttack {
  bossId: number;
  type: BossAttackType;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  angle?: number;
  damage: number;
  dx?: number;
  dy?: number;
  isReflected?: boolean; // Marked as reflected by reflect shield
  // Cross attack course-change properties
  isStopped?: boolean;           // Currently paused for course change
  stopStartTime?: number;        // When the stop began (for 1 second pause)
  nextCourseChangeTime?: number; // When the next course change will occur
  pendingDirection?: { dx: number; dy: number }; // Pre-calculated next direction for visual indicator
  spawnTime?: number; // When the attack was spawned (for merge cooldown)
  isHomingToPlayer?: boolean; // Gently homes toward player paddle
  homingStrength?: number; // Homing intensity (0-1, subtle values like 0.03)
}

export type GameState = "ready" | "playing" | "paused" | "gameOver" | "won";

export type Difficulty = "normal" | "godlike";

export type GameMode = "normal" | "bossRush";

export interface GameSettings {
  startingLives: number;
  difficulty: Difficulty;
  startingLevel: number;
  gameMode: GameMode;
}
