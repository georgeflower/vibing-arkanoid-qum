// Mega Boss (Level 20) Configuration
export const MEGA_BOSS_LEVEL = 20;

export const MEGA_BOSS_CONFIG = {
  level: 20,
  size: 120,
  
  // Phase-based HP system
  outerShieldHP: 10, // Hits to expose core each phase
  innerShieldHP: 6, // Inner octagon shield HP (after outer is removed)
  innerOctagonSize: 40, // Smaller octagon radius around core
  coreHP: 1, // Ball must hit core once to trap it
  dangerBallsToComplete: 5, // Must get 5 core hits from reflected danger balls
  
  // Legacy values for compatibility
  healthPhase1: 10, // Outer shield for phase 1
  healthPhase2: 10, // Outer shield for phase 2 (angry)
  healthPhase3: 10, // Outer shield for phase 3 (very angry)
  
  positions: 9,
  moveSpeed: 2.0,
  angryMoveSpeed: 3.0,
  veryAngryMoveSpeed: 5.5,
  attackInterval: 3000,
  angryAttackInterval: 2500,
  veryAngryAttackInterval: 2000,
  points: 100000, // Final boss victory points
  
  // Dynamic speed variation
  speedVariationMin: 0.6,
  speedVariationMax: 1.6,
  speedChangeInterval: 800,
  
  // Hatch mechanics
  hatchOpenDuration: 8000, // How long hatch stays open for ball to enter
  
  // Danger ball settings (shot from cannon after core hit)
  dangerBallCount: 5, // Must catch 5 per phase
  dangerBallIntervalMin: 1500,
  dangerBallIntervalMax: 3500,
  dangerBallSpeed: 180, // px/s (3.0 px/frame × 60 fps)
  dangerBallSize: 14,
  
  // Swarming enemies in phase 3
  swarmSpawnInterval: 5000, // Every 5 seconds
  swarmEnemyCount: 3,
  maxSwarmEnemies: 8, // Maximum total swarm enemies on screen
  
  // Visual timing
  cannonExtendDuration: 1000, // Time for cannon to visually extend
  coreExposeDuration: 500, // Time for core to become visible
  
  // Attack weights by phase
  attackWeights: {
    phase1: { shot: 0.35, sweepTurret: 0.25, hatchSalvo: 0.15, laser: 0.15, super: 0.10 },
    phase2: { shot: 0.20, sweepTurret: 0.20, hatchSalvo: 0.15, laser: 0.15, cross: 0.15, super: 0.15 },
    phase3: { sweepTurret: 0.20, shot: 0.15, phaseBurst: 0.15, laser: 0.15, cross: 0.15, super: 0.10, hatchSalvo: 0.10 }
  }
} as const;

// Corner targets for danger ball trajectories
export const CORNER_TARGETS = [
  { name: 'topLeft', x: 50, y: 50 },
  { name: 'topRight', x: 800, y: 50 },
  { name: 'bottomLeft', x: 50, y: 600 },
  { name: 'bottomRight', x: 800, y: 600 }
] as const;

// Mega Boss positions (similar to other bosses but adjusted for larger size)
export const MEGA_BOSS_POSITIONS = [
  { x: 0.15, y: 0.15 },
  { x: 0.5, y: 0.12 },
  { x: 0.85, y: 0.15 },
  { x: 0.2, y: 0.32 },
  { x: 0.5, y: 0.28 },
  { x: 0.8, y: 0.32 },
  { x: 0.15, y: 0.48 },
  { x: 0.5, y: 0.42 },
  { x: 0.85, y: 0.48 }
] as const;
