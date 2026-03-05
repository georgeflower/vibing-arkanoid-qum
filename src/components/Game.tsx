import { useEffect, useRef, useState, useCallback } from "react";
import { world, type LaserWarning, type SuperWarning, type BulletImpact } from "@/engine/state";
import { renderState } from "@/engine/renderState";
import { GameCanvas } from "./GameCanvas";
import { GameUI } from "./GameUI";
import { HighScoreTable } from "./HighScoreTable";
import { HighScoreEntry } from "./HighScoreEntry";
import { HighScoreDisplay } from "./HighScoreDisplay";
import { EndScreen } from "./EndScreen";
import { GetReadyOverlay } from "./GetReadyOverlay";
import { BossVictoryOverlay } from "./BossVictoryOverlay";
import { BossRushVictoryOverlay } from "./BossRushVictoryOverlay";
import { BossRushScoreEntry } from "./BossRushScoreEntry";
import { BossRushStatsOverlay } from "./BossRushStatsOverlay";
import { useBossRushScores } from "@/hooks/useBossRushScores";
import { Button } from "@/components/ui/button";
import { debugToast as toast } from "@/utils/debugToast";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { MobileGameControls } from "./MobileGameControls";
import { useScaledConstants } from "@/hooks/useScaledConstants";
import { useViewportFrame } from "@/hooks/useViewportFrame";
import { useCanvasResize } from "@/hooks/useCanvasResize";
import CRTOverlay from "./CRTOverlay";
import { BOSS_RUSH_CONFIG, BossRushLevel } from "@/constants/bossRushConfig";

// ═══════════════════════════════════════════════════════════════
// ████████╗ DEBUG IMPORTS - REMOVE BEFORE PRODUCTION ████████╗
// ═══════════════════════════════════════════════════════════════
import { GameLoopDebugOverlay } from "./GameLoopDebugOverlay";
import { SubstepDebugOverlay } from "./SubstepDebugOverlay";
import { PowerUpWeightsOverlay } from "./PowerUpWeightsOverlay";
import { CollisionHistoryViewer } from "./CollisionHistoryViewer";
import { CCDPerformanceOverlay, CCDPerformanceData } from "./CCDPerformanceOverlay";
import { collisionHistory } from "@/utils/collisionHistory";
import { DebugDashboard } from "./DebugDashboard";
import { DebugModeIndicator } from "./DebugModeIndicator";
import { useDebugSettings } from "@/hooks/useDebugSettings";
import { performanceProfiler } from "@/utils/performanceProfiler";
import { frameProfiler } from "@/utils/frameProfiler";

import { getParticleLimits, shouldCreateParticle, calculateParticleCount } from "@/utils/particleLimits";
import { FrameProfilerOverlay } from "./FrameProfilerOverlay";
import { PoolStatsOverlay } from "./PoolStatsOverlay";
import { CCDPerformanceTracker } from "@/utils/rollingStats";
import { debugLogger } from "@/utils/debugLogger";
import { particlePool } from "@/utils/particlePool";

// ═══════════════════════════════════════════════════════════════
import { Maximize2, Minimize2, Home, X } from "lucide-react";
import { QualityIndicator } from "./QualityIndicator";
import type {
  Brick,
  Ball,
  Paddle,
  GameState,
  Enemy,
  Bomb,
  Explosion,
  BonusLetter,
  BonusLetterType,
  GameSettings,
  EnemyType,
  Particle,
  Boss,
  BossAttack,
  ShieldImpact,
  PowerUp,
  PowerUpType,
} from "@/types/game";
import { useHighScores } from "@/hooks/useHighScores";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  BALL_RADIUS,
  BRICK_ROWS,
  BRICK_COLS,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  BRICK_PADDING,
  BRICK_OFFSET_TOP,
  BRICK_OFFSET_LEFT,
  POWERUP_DROP_CHANCE,
  getHitColor,
  getBrickColors,
  POWERUP_SIZE,
  POWERUP_FALL_SPEED,
  FINAL_LEVEL,
  FIREBALL_DURATION,
  ENABLE_DEBUG_FEATURES,
  PHYSICS_CONFIG,
  ENABLE_HIGH_QUALITY,
} from "@/constants/game";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "./TutorialOverlay";
import { levelLayouts, getBrickHits } from "@/constants/levelLayouts";
import { usePowerUps } from "@/hooks/usePowerUps";
import { useBullets } from "@/hooks/useBullets";
import { useAdaptiveQuality } from "@/hooks/useAdaptiveQuality";
import { useLevelProgress } from "@/hooks/useLevelProgress";
import { soundManager } from "@/utils/sounds";
import { FixedStepGameLoop } from "@/utils/gameLoop";
import { DEFAULT_TIME_SCALE, MIN_TIME_SCALE, MAX_TIME_SCALE, FPS_CAP, MAX_DELTA_MS, FIXED_PHYSICS_TIMESTEP } from "@/constants/gameLoopConfig";
import { createBoss, createResurrectedPyramid } from "@/utils/bossUtils";
import { performBossAttack } from "@/utils/bossAttacks";
import { BOSS_LEVELS, BOSS_CONFIG, ATTACK_PATTERNS } from "@/constants/bossConfig";
import { processBallWithCCD } from "@/utils/gameCCD";
import { runPhysicsFrame, BALL_GRAVITY, GRAVITY_DELAY_MS } from "@/engine/physics";
import { brickSpatialHash } from "@/utils/spatialHash";
import { resetAllPools, enemyPool, bombPool, explosionPool, getNextExplosionId, bulletPool } from "@/utils/entityPool";
import { brickRenderer } from "@/utils/brickLayerCache";
import { UnifiedGameLoop, setRenderTargetFps } from "@/engine/unifiedLoop";
import { assignPowerUpsToBricks, reassignPowerUpsToBricks } from "@/utils/powerUpAssignment";
import { MEGA_BOSS_LEVEL, MEGA_BOSS_CONFIG } from "@/constants/megaBossConfig";
import {
  createMegaBoss,
  isMegaBoss,
  handleMegaBossOuterDamage,
  exposeMegaBossCore,
  handleMegaBossCoreHit,
  catchDangerBall,
  shouldReleaseBall,
  releaseBallAndNextPhase,
  isBallInHatchArea,
  isBallInsideMegaBoss,
  applyGravityWellToBall,
  shouldEndDangerBallPhase,
  resetMegaBossPhaseProgress,
  shouldSpawnSwarm,
  markSwarmSpawned,
  incrementCoreHit,
  hasSufficientCoreHits,
  getMegaBossPhase,
  MegaBoss,
} from "@/utils/megaBossUtils";
import {
  DangerBall,
  spawnDangerBall,
  updateDangerBall,
  isDangerBallAtBottom,
  isDangerBallIntercepted,
  reflectDangerBall,
  applyHomingToDangerBall,
  isDangerBallAtCore,
  hasReflectedBallMissed,
  performMegaBossAttack,
} from "@/utils/megaBossAttacks";
interface GameProps {
  settings: GameSettings;
  onReturnToMenu: () => void;
}
export const Game = ({ settings, onReturnToMenu }: GameProps) => {
  // Import debug flag from shared constants
  // To enable/disable debug features, edit ENABLE_DEBUG_FEATURES in src/constants/game.ts

  // Detect updates but don't apply during gameplay - defer until back at menu
  useServiceWorkerUpdate({ shouldApplyUpdate: false });

  // Centralized scaled constants
  const {
    isMac,
    scaleFactor,
    canvasWidth: SCALED_CANVAS_WIDTH,
    canvasHeight: SCALED_CANVAS_HEIGHT,
    paddleWidth: SCALED_PADDLE_WIDTH,
    paddleHeight: SCALED_PADDLE_HEIGHT,
    paddleStartY: SCALED_PADDLE_START_Y,
    ballRadius: SCALED_BALL_RADIUS,
    brickWidth: SCALED_BRICK_WIDTH,
    brickHeight: SCALED_BRICK_HEIGHT,
    brickPadding: SCALED_BRICK_PADDING,
    brickOffsetTop: SCALED_BRICK_OFFSET_TOP,
    brickOffsetLeft: SCALED_BRICK_OFFSET_LEFT,
  } = useScaledConstants();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScoreRaw] = useState(0);
  const scoreRef = useRef(0);
  // Wrap setScore to always keep scoreRef in sync
  const setScore = useCallback((updater: number | ((prev: number) => number)) => {
    setScoreRaw((prev) => {
      const newVal = typeof updater === "function" ? updater(prev) : updater;
      scoreRef.current = newVal;
      return newVal;
    });
  }, []);
  const [lives, setLives] = useState(settings.startingLives);
  const [level, setLevel] = useState(settings.startingLevel);

  // Boss Rush mode state
  const isBossRush = settings.gameMode === "bossRush";
  const [bossRushIndex, setBossRushIndex] = useState(0); // 0-3 for 4 bosses
  const [showBossRushVictory, setShowBossRushVictory] = useState(false);
  const [bossRushStartTime, setBossRushStartTime] = useState<number | null>(null);
  const [bossRushCompletionTime, setBossRushCompletionTime] = useState<number>(0);
  const [showBossRushScoreEntry, setShowBossRushScoreEntry] = useState(false);
  const [bossRushGameOverLevel, setBossRushGameOverLevel] = useState<number>(5); // Track which boss level the player died on

  // Boss Rush inter-boss stats tracking
  const [bossRushStatsOverlayActive, setBossRushStatsOverlayActive] = useState(false);
  const statsOverlayJustClosedRef = useRef(0);
  const [bossRushTimeSnapshot, setBossRushTimeSnapshot] = useState<number | null>(null);
  // Per-boss stats (reset between bosses)
  const [bossRushLivesLostThisBoss, setBossRushLivesLostThisBoss] = useState(0);
  const [bossRushPowerUpsThisBoss, setBossRushPowerUpsThisBoss] = useState(0);
  const [bossRushEnemiesThisBoss, setBossRushEnemiesThisBoss] = useState(0);
  const [bossRushShotsThisBoss, setBossRushShotsThisBoss] = useState(0);
  const [bossRushHitsThisBoss, setBossRushHitsThisBoss] = useState(0);
  // Accumulated stats (persist across all bosses)
  const [bossRushTotalLivesLost, setBossRushTotalLivesLost] = useState(0);
  const [bossRushTotalPowerUps, setBossRushTotalPowerUps] = useState(0);
  const [bossRushTotalEnemiesKilled, setBossRushTotalEnemiesKilled] = useState(0);
  const [bossRushTotalShots, setBossRushTotalShots] = useState(0);
  const [bossRushTotalHits, setBossRushTotalHits] = useState(0);
  // Track which balls need to hit something after paddle collision (for accuracy)
  const ballsPendingHitRef = useRef<Set<number>>(new Set());

  // Helper to reset ALL Boss Rush session state (called when starting a new Boss Rush run)
  const resetBossRushSessionState = useCallback(() => {
    console.log("[BossRush] Resetting ALL Boss Rush session state");
    // Session progression
    setBossRushIndex(0);
    setBossRushStartTime(null);
    setBossRushCompletionTime(0);
    setBossRushGameOverLevel(5);
    setShowBossRushVictory(false);
    setShowBossRushScoreEntry(false);
    // Overlay state
    setBossRushStatsOverlayActive(false);
    setBossRushTimeSnapshot(null);
    // Per-boss stats
    setBossRushLivesLostThisBoss(0);
    setBossRushPowerUpsThisBoss(0);
    setBossRushEnemiesThisBoss(0);
    setBossRushShotsThisBoss(0);
    setBossRushHitsThisBoss(0);
    ballsPendingHitRef.current.clear();
    // Accumulated totals (THE FIX for accuracy bug)
    setBossRushTotalLivesLost(0);
    setBossRushTotalPowerUps(0);
    setBossRushTotalEnemiesKilled(0);
    setBossRushTotalShots(0);
    setBossRushTotalHits(0);
  }, []);

  // Level progress tracking
  const { updateMaxLevel } = useLevelProgress();
  const [gameState, setGameState] = useState<GameState>("ready");
  // ═══ PHASE 1: bricks lives in world.bricks (engine/state.ts) ═══
  const bricks = world.bricks;
  const setBricks = useCallback((updater: Brick[] | ((prev: Brick[]) => Brick[])) => {
    if (typeof updater === "function") {
      world.bricks = updater(world.bricks);
    } else {
      world.bricks = updater;
    }
  }, []);
  // ═══ PHASE 1: balls lives in world.balls (engine/state.ts) ═══
  // Compatibility shim: setBalls writes to world.balls directly, no React re-render.
  // `balls` is a getter so existing code reads the latest value.
  const balls = world.balls;
  const setBalls = useCallback((updater: Ball[] | ((prev: Ball[]) => Ball[])) => {
    if (typeof updater === "function") {
      world.balls = updater(world.balls);
    } else {
      world.balls = updater;
    }
  }, []);
  // ═══ PHASE 1: paddle lives in world.paddle (engine/state.ts) ═══
  // Compatibility shim: setPaddle writes to world.paddle directly, no React re-render.
  const paddle = world.paddle;
  const setPaddle = useCallback((updater: Paddle | null | ((prev: Paddle | null) => Paddle | null)) => {
    if (typeof updater === "function") {
      world.paddle = updater(world.paddle);
    } else {
      world.paddle = updater;
    }
  }, []);
  // Helper function to calculate speed multiplier for any level
  // Max total speed caps (including brick hit bonuses): 150% normal, 175% godlike
  const MAX_TOTAL_SPEED_NORMAL = 1.5;
  const MAX_TOTAL_SPEED_GODLIKE = 1.75;

  const calculateSpeedForLevel = useCallback(
    (levelNum: number, difficulty: string, gameMode?: string, rushIndex?: number) => {
      // Boss Rush mode uses fixed speeds per boss
      if (gameMode === "bossRush" && rushIndex !== undefined) {
        const bossLevel = BOSS_RUSH_CONFIG.bossOrder[rushIndex] as BossRushLevel;
        return BOSS_RUSH_CONFIG.speedMultipliers[bossLevel];
      }

      // 105% base for normal, 137.5% for godlike
      const baseMultiplier = difficulty === "godlike" ? 1.375 : 1.05;
      // Level-based caps (before brick hit bonuses): 155% godlike, 140% normal
      const maxSpeedMultiplier = difficulty === "godlike" ? 1.55 : 1.4;

      let speedMult: number;
      if (difficulty === "godlike") {
        // Godlike: always +5% per level
        speedMult = baseMultiplier + (levelNum - 1) * 0.05;
      } else {
        // Normal: always +3% per level
        speedMult = baseMultiplier + (levelNum - 1) * 0.03;
      }
      return Math.min(maxSpeedMultiplier, speedMult);
    },
    [],
  );

  // ═══ PHASE 1: speedMultiplier lives in world.speedMultiplier (engine/state.ts) ═══
  // Initialize world.speedMultiplier on first render
  const [speedMultiplierInitialized] = useState(() => {
    if (settings.gameMode === "bossRush") {
      world.speedMultiplier = BOSS_RUSH_CONFIG.speedMultipliers[5];
    } else {
      const startLevel = settings.startingLevel;
      const baseMultiplier = settings.difficulty === "godlike" ? 1.375 : 1.05;
      const maxSpeedMultiplier = settings.difficulty === "godlike" ? 1.55 : 1.4;
      let speedMult: number;
      if (settings.difficulty === "godlike") {
        speedMult = baseMultiplier + (startLevel - 1) * 0.05;
      } else {
        speedMult = baseMultiplier + (startLevel - 1) * 0.03;
      }
      world.speedMultiplier = Math.min(maxSpeedMultiplier, speedMult);
    }
    return true;
  });
  void speedMultiplierInitialized; // suppress unused warning
  const speedMultiplier = world.speedMultiplier;
  const setSpeedMultiplier = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.speedMultiplier = updater(world.speedMultiplier);
    } else {
      world.speedMultiplier = updater;
    }
  }, []);
  // High-priority paddle position ref for immediate input response during low FPS
  const paddleXRef = useRef(0);
  const [showHighScoreEntry, setShowHighScoreEntry] = useState(false);
  const [showHighScoreDisplay, setShowHighScoreDisplay] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [qualifiedLeaderboards, setQualifiedLeaderboards] = useState<{
    daily: boolean;
    weekly: boolean;
    allTime: boolean;
  } | null>(null);
  const [beatLevel50Completed, setBeatLevel50Completed] = useState(false);
  const [timer, setTimer] = useState(0);
  const [totalPlayTime, setTotalPlayTime] = useState(0);
  // ═══ PHASE 1: enemies lives in world.enemies (engine/state.ts) ═══
  const enemies = world.enemies;
  const setEnemies = useCallback((updater: Enemy[] | ((prev: Enemy[]) => Enemy[])) => {
    if (typeof updater === "function") {
      world.enemies = updater(world.enemies);
    } else {
      world.enemies = updater;
    }
  }, []);
  // ═══ PHASE 1: bombs lives in world.bombs (engine/state.ts) ═══
  const bombs = world.bombs;
  const setBombs = useCallback((updater: Bomb[] | ((prev: Bomb[]) => Bomb[])) => {
    if (typeof updater === "function") {
      world.bombs = updater(world.bombs);
    } else {
      world.bombs = updater;
    }
  }, []);
  // ═══ PHASE 1: backgroundPhase lives in world.backgroundPhase (engine/state.ts) ═══
  const backgroundPhase = world.backgroundPhase;
  const setBackgroundPhase = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.backgroundPhase = updater(world.backgroundPhase);
    } else {
      world.backgroundPhase = updater;
    }
  }, []);
  // ═══ PHASE 1: explosions lives in world.explosions (engine/state.ts) ═══
  // Explosions are now managed by explosionPool — world.explosions is the cached active array.
  const explosions = world.explosions;

  /**
   * Compatibility shim: intercepts setExplosions calls and routes them through the pool.
   * - Empty array argument → releaseAll (bulk clear)
   * - Updater function → run the updater, then diff to find new explosions and pool them
   * - Direct array → pool all entries
   */
  const setExplosions = useCallback((updater: Explosion[] | ((prev: Explosion[]) => Explosion[])) => {
    if (Array.isArray(updater) && updater.length === 0) {
      // Bulk clear: setExplosions([])
      explosionPool.releaseAll();
      world.explosions = explosionPool.getActive();
      return;
    }

    if (typeof updater === "function") {
      // Updater pattern: setExplosions(prev => [...prev, newExplosion])
      // We pass the current active list to the updater, then pool any new entries
      const prevActive = explosionPool.getActive();
      const prevIds = new Set<number | string>();
      for (const e of prevActive) {
        if (e.id !== undefined) prevIds.add(e.id);
      }

      const result = updater(prevActive);

      // Pool any newly added explosions
      for (const exp of result) {
        const eid = (exp as any).id;
        if (eid !== undefined && prevIds.has(eid)) continue; // already pooled
        // Acquire from pool with a new ID
        explosionPool.acquire({
          id: getNextExplosionId(),
          x: exp.x,
          y: exp.y,
          frame: exp.frame,
          maxFrames: exp.maxFrames,
          enemyType: exp.enemyType,
          particles: exp.particles,
        });
      }

      world.explosions = explosionPool.getActive();
    }
  }, []);
  // ═══ PHASE 1: enemySpawnCount lives in world.enemySpawnCount (engine/state.ts) ═══
  const enemySpawnCount = world.enemySpawnCount;
  const setEnemySpawnCount = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.enemySpawnCount = updater(world.enemySpawnCount);
    } else {
      world.enemySpawnCount = updater;
    }
  }, []);
  // ═══ PHASE 1: lastEnemySpawnTime lives in world.lastEnemySpawnTime (engine/state.ts) ═══
  const lastEnemySpawnTime = world.lastEnemySpawnTime;
  const setLastEnemySpawnTime = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.lastEnemySpawnTime = updater(world.lastEnemySpawnTime);
    } else {
      world.lastEnemySpawnTime = updater;
    }
  }, []);
  // ═══ PHASE 1: launchAngle lives in world.launchAngle (engine/state.ts) ═══
  const launchAngle = world.launchAngle;
  const setLaunchAngle = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.launchAngle = updater(world.launchAngle);
    } else {
      world.launchAngle = updater;
    }
  }, []);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // ═══ PHASE 1: bonusLetters lives in world.bonusLetters (engine/state.ts) ═══
  const bonusLetters = world.bonusLetters;
  const setBonusLetters = useCallback((updater: BonusLetter[] | ((prev: BonusLetter[]) => BonusLetter[])) => {
    if (typeof updater === "function") {
      world.bonusLetters = updater(world.bonusLetters);
    } else {
      world.bonusLetters = updater;
    }
  }, []);
  const [droppedLettersThisLevel, setDroppedLettersThisLevel] = useState<Set<BonusLetterType>>(new Set());
  const [collectedLetters, setCollectedLetters] = useState<Set<BonusLetterType>>(new Set());
  const [letterLevelAssignments, setLetterLevelAssignments] = useState<Record<number, BonusLetterType>>({});
  const [missedLetters, setMissedLetters] = useState<BonusLetterType[]>([]);
  // ═══ PHASE 1: boss lives in world.boss (engine/state.ts) ═══
  const boss = world.boss;
  const setBoss = useCallback((updater: Boss | null | ((prev: Boss | null) => Boss | null)) => {
    if (typeof updater === "function") {
      world.boss = updater(world.boss);
    } else {
      world.boss = updater;
    }
  }, []);
  // ═══ PHASE 1: resurrectedBosses lives in world.resurrectedBosses (engine/state.ts) ═══
  const resurrectedBosses = world.resurrectedBosses;
  const setResurrectedBosses = useCallback((updater: Boss[] | ((prev: Boss[]) => Boss[])) => {
    if (typeof updater === "function") {
      world.resurrectedBosses = updater(world.resurrectedBosses);
    } else {
      world.resurrectedBosses = updater;
    }
  }, []);
  // ═══ PHASE 1: bossAttacks lives in world.bossAttacks (engine/state.ts) ═══
  const bossAttacks = world.bossAttacks;
  const setBossAttacks = useCallback((updater: BossAttack[] | ((prev: BossAttack[]) => BossAttack[])) => {
    if (typeof updater === "function") {
      world.bossAttacks = updater(world.bossAttacks);
    } else {
      world.bossAttacks = updater;
    }
  }, []);
  const [bossDefeatedTransitioning, setBossDefeatedTransitioning] = useState(false);
  const bossDefeatedTransitioningRef = useRef(false);
  const hasAutoFullscreenedRef = useRef(false);
  useEffect(() => {
    bossDefeatedTransitioningRef.current = bossDefeatedTransitioning;
  }, [bossDefeatedTransitioning]);
  const [bossVictoryOverlayActive, setBossVictoryOverlayActive] = useState(false);
  // ═══ PHASE 1: bossActive lives in world.bossActive (engine/state.ts) ═══
  const bossActive = world.bossActive;
  const setBossActive = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    if (typeof updater === "function") {
      world.bossActive = updater(world.bossActive);
    } else {
      world.bossActive = updater;
    }
  }, []);
  // ═══ PHASE 1: bossHitCooldown lives in world.bossHitCooldown (engine/state.ts) ═══
  const bossHitCooldown = world.bossHitCooldown;
  const setBossHitCooldown = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.bossHitCooldown = updater(world.bossHitCooldown);
    } else {
      world.bossHitCooldown = updater;
    }
  }, []);
  // ═══ PHASE 1: laserWarnings lives in world.laserWarnings (engine/state.ts) ═══
  const laserWarnings = world.laserWarnings;
  const setLaserWarnings = useCallback((updater: LaserWarning[] | ((prev: LaserWarning[]) => LaserWarning[])) => {
    if (typeof updater === "function") {
      world.laserWarnings = updater(world.laserWarnings);
    } else {
      world.laserWarnings = updater;
    }
  }, []);
  // ═══ PHASE 1: superWarnings lives in world.superWarnings (engine/state.ts) ═══
  const superWarnings = world.superWarnings;
  const setSuperWarnings = useCallback((updater: SuperWarning[] | ((prev: SuperWarning[]) => SuperWarning[])) => {
    if (typeof updater === "function") {
      world.superWarnings = updater(world.superWarnings);
    } else {
      world.superWarnings = updater;
    }
  }, []);
  const bossSpawnedEnemiesRef = useRef<Set<number>>(new Set());
  const firstBossMinionKilledRef = useRef(false);
  // Track newly reflected bombs synchronously to avoid stale closure issues
  const newlyReflectedBombIdsRef = useRef<Set<number>>(new Set());
  // Track last reflected attack hit time synchronously to prevent multi-hit in same frame
  const reflectedAttackLastHitRef = useRef<number>(0);
  // Track pending chain explosions for explosive bricks (delayed by 200ms)
  const pendingChainExplosionsRef = useRef<Array<{ brick: Brick; triggerTime: number }>>([]);

  // ═══ Device Detection (needed early for multiple features) ═══
  const [isMobileDevice] = useState(() => {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      ("ontouchstart" in window && window.matchMedia("(max-width: 768px)").matches)
    );
  });
  const [isIOSDevice] = useState(() => {
    return (
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  });

  // ═══ Fullscreen and Layout State ═══
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [framesVisible, setFramesVisible] = useState(true);
  const [titleVisible, setTitleVisible] = useState(true);
  const [gameScale, setGameScale] = useState(1);
  const [disableAutoZoom, setDisableAutoZoom] = useState(false);

  // ═══ PHASE 1: brickHitSpeedAccumulated lives in world (engine/state.ts) ═══
  const brickHitSpeedAccumulated = world.brickHitSpeedAccumulated;
  const setBrickHitSpeedAccumulated = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.brickHitSpeedAccumulated = updater(world.brickHitSpeedAccumulated);
    } else {
      world.brickHitSpeedAccumulated = updater;
    }
  }, []);
  // ═══ PHASE 1: enemiesKilled lives in world (engine/state.ts) ═══
  const enemiesKilled = world.enemiesKilled;
  const setEnemiesKilled = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.enemiesKilled = updater(world.enemiesKilled);
    } else {
      world.enemiesKilled = updater;
    }
  }, []);
  // ═══ PHASE 1: screenShake lives in world.screenShake (engine/state.ts) ═══
  const screenShake = world.screenShake;
  const setScreenShake = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.screenShake = updater(world.screenShake);
    } else {
      world.screenShake = updater;
    }
    // Inline screen shake start tracking (was useEffect([screenShake]))
    if (world.screenShake > 0 && screenShakeStartRef.current === null) {
      screenShakeStartRef.current = Date.now();
    } else if (world.screenShake === 0 && screenShakeStartRef.current !== null) {
      screenShakeStartRef.current = null;
    }
  }, []);
  const screenShakeStartRef = useRef<number | null>(null);
  // BALL_GRAVITY and GRAVITY_DELAY_MS imported from @/engine/physics

  // Screen shake tracking is now inlined in setScreenShake

  // ═══ PHASE 1: backgroundFlash lives in world.backgroundFlash (engine/state.ts) ═══
  const backgroundFlash = world.backgroundFlash;
  const setBackgroundFlash = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.backgroundFlash = updater(world.backgroundFlash);
    } else {
      world.backgroundFlash = updater;
    }
  }, []);
  // ═══ PHASE 1: highlightFlash lives in world.highlightFlash (engine/state.ts) ═══
  const highlightFlash = world.highlightFlash;
  const setHighlightFlash = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.highlightFlash = updater(world.highlightFlash);
    } else {
      world.highlightFlash = updater;
    }
  }, []);
  const highlightFlashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // ═══ PHASE 1: lastBossSpawnTime lives in world.lastBossSpawnTime (engine/state.ts) ═══
  const lastBossSpawnTime = world.lastBossSpawnTime;
  const setLastBossSpawnTime = useCallback((updater: number | ((prev: number) => number)) => {
    if (typeof updater === "function") {
      world.lastBossSpawnTime = updater(world.lastBossSpawnTime);
    } else {
      world.lastBossSpawnTime = updater;
    }
  }, []);
  const [bossSpawnAnimation, setBossSpawnAnimation] = useState<{ active: boolean; startTime: number } | null>(null);
  // ═══ PHASE 1: shieldImpacts lives in world.shieldImpacts (engine/state.ts) ═══
  const shieldImpacts = world.shieldImpacts;
  const setShieldImpacts = useCallback((updater: ShieldImpact[] | ((prev: ShieldImpact[]) => ShieldImpact[])) => {
    if (typeof updater === "function") {
      world.shieldImpacts = updater(world.shieldImpacts);
    } else {
      world.shieldImpacts = updater;
    }
  }, []);
  const [lastScoreMilestone, setLastScoreMilestone] = useState(0);
  const [scoreBlinking, setScoreBlinking] = useState(false);

  // ═══ MEGA BOSS (Level 20) State ═══
  // ═══ PHASE 1: dangerBalls lives in world.dangerBalls (engine/state.ts) ═══
  const dangerBalls = world.dangerBalls;
  const setDangerBalls = useCallback((updater: DangerBall[] | ((prev: DangerBall[]) => DangerBall[])) => {
    if (typeof updater === "function") {
      world.dangerBalls = updater(world.dangerBalls);
    } else {
      world.dangerBalls = updater;
    }
  }, []);
  const [nextCannonMissileTime, setNextCannonMissileTime] = useState<number>(0);
  const [ballReleaseHighlight, setBallReleaseHighlight] = useState<{ active: boolean; startTime: number } | null>(null);

  // Boss power-up states
  const [reflectShieldActive, setReflectShieldActive] = useState(false);
  const [homingBallActive, setHomingBallActive] = useState(false);
  const bossStunnerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reflectShieldTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const homingBallTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Boss power-up end times (for countdown display)
  const [bossStunnerEndTime, setBossStunnerEndTime] = useState<number | null>(null);
  const [reflectShieldEndTime, setReflectShieldEndTime] = useState<number | null>(null);
  const [homingBallEndTime, setHomingBallEndTime] = useState<number | null>(null);

  // Fireball timer state
  const [fireballEndTime, setFireballEndTime] = useState<number | null>(null);

  // Second chance impact effect state
  const [secondChanceImpact, setSecondChanceImpact] = useState<{ x: number; y: number; startTime: number } | null>(
    null,
  );

  // Audio toggle state (for UI reactivity)
  const [musicEnabled, setMusicEnabled] = useState(() => soundManager.getMusicEnabled());
  const [sfxEnabled, setSfxEnabled] = useState(() => soundManager.getSfxEnabled());

  // Pause-aware timer tracking
  const pauseStartTimeRef = useRef<number | null>(null);
  const savedTimerDurationsRef = useRef<{
    bossStunner: number | null;
    reflectShield: number | null;
    homingBall: number | null;
    fireball: number | null;
  }>({ bossStunner: null, reflectShield: null, homingBall: null, fireball: null });

  // Tutorial system
  const {
    tutorialEnabled,
    currentStep: tutorialStep,
    tutorialActive,
    triggerTutorial,
    dismissTutorial,
    skipAllTutorials,
    resetTutorials,
    setTutorialEnabled,
  } = useTutorial();

  // Track if tutorials have been triggered this session
  const powerUpTutorialTriggeredRef = useRef(false);
  const turretTutorialTriggeredRef = useRef(false);
  const bossTutorialTriggeredRef = useRef(false);
  const bossPowerUpTutorialTriggeredRef = useRef(false);
  const minionTutorialTriggeredRef = useRef(false);
  const bonusLetterTutorialTriggeredRef = useRef(false);

  // Bonus letter floating text state
  const [bonusLetterFloatingText, setBonusLetterFloatingText] = useState<{
    active: boolean;
    startTime: number;
  } | null>(null);

  // Bullet impact effects for boss hits
  // ═══ PHASE 1: bulletImpacts lives in world.bulletImpacts (engine/state.ts) ═══
  const bulletImpacts = world.bulletImpacts;
  const setBulletImpacts = useCallback((updater: BulletImpact[] | ((prev: BulletImpact[]) => BulletImpact[])) => {
    if (typeof updater === "function") {
      world.bulletImpacts = updater(world.bulletImpacts);
    } else {
      world.bulletImpacts = updater;
    }
  }, []);

  // Get Ready overlay state (after dismissing tutorials)
  const [getReadyActive, setGetReadyActive] = useState(false);
  const getReadyStartTimeRef = useRef<number | null>(null);
  const baseSpeedMultiplierRef = useRef(1);

  // Mobile ball glow state for Get Ready sequence
  const [getReadyGlow, setGetReadyGlow] = useState<{ opacity: number } | null>(null);
  const getReadyGlowStartTimeRef = useRef<number | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // ████████╗ DEBUG STATE - REMOVE BEFORE PRODUCTION ████████╗
  // ═══════════════════════════════════════════════════════════════
  const ccdPerformanceRef = useRef<CCDPerformanceData | null>(null);
  const ccdPerformanceTrackerRef = useRef<CCDPerformanceTracker>(new CCDPerformanceTracker());
  const frameCountRef = useRef(0);
  const [currentFps, setCurrentFps] = useState(60);
  const [showDebugDashboard, setShowDebugDashboard] = useState(false);
  const [debugDashboardPausedGame, setDebugDashboardPausedGame] = useState(false);
  const {
    settings: debugSettings,
    toggleSetting: toggleDebugSetting,
    resetSettings: resetDebugSettings,
  } = useDebugSettings();

  // Helper function to count active debug features
  const calculateActiveDebugFeatures = (settings: typeof debugSettings): number => {
    let count = 0;
    if (settings.showGameLoopDebug) count++;
    if (settings.showSubstepDebug) count++;
    if (settings.showCCDPerformance) count++;
    if (settings.showCollisionHistory) count++;
    if (settings.showFrameProfiler) count++;
    if (settings.enableCollisionLogging) count++;
    if (settings.enablePowerUpLogging) count++;
    if (settings.enablePerformanceLogging) count++;
    if (settings.enableFPSLogging) count++;
    if (settings.enablePaddleLogging) count++;
    if (settings.enableBossLogging) count++;
    return count;
  };
  // ═══════════════════════════════════════════════════════════════

  // Enable frame profiler when debug settings change
  useEffect(() => {
    if (ENABLE_DEBUG_FEATURES && debugSettings.showFrameProfiler) {
      frameProfiler.enable();
    } else {
      frameProfiler.disable();
    }
  }, [debugSettings.showFrameProfiler]);

  // Pause/Resume game when debug dashboard opens/closes
  useEffect(() => {
    if (!ENABLE_DEBUG_FEATURES) return;

    if (showDebugDashboard) {
      // Debug dashboard opened - pause game if it's playing
      if (gameState === "playing") {
        setGameState("paused");
        setDebugDashboardPausedGame(true);
        console.log("[Debug Dashboard] Game paused");
      }
    } else if (debugDashboardPausedGame) {
      // Debug dashboard closed - resume game if it was paused by dashboard
      if (gameState === "paused") {
        setGameState("playing");
        setDebugDashboardPausedGame(false);
        console.log("[Debug Dashboard] Game resumed");
      }
    }
  }, [showDebugDashboard, gameState, debugDashboardPausedGame]);

  // Rebuild spatial hash when bricks change (level load, brick destruction)
  // This enables O(k) collision detection instead of O(n)
  useEffect(() => {
    if (bricks.length > 0) {
      brickSpatialHash.rebuild(bricks);
    } else {
      brickSpatialHash.clear();
    }
    // Also invalidate brick layer cache to trigger re-render
    brickRenderer.invalidate();
  }, [bricks]);

  // ═══ POOL SYNC HELPERS ═══
  // These helpers ensure pool state stays in sync when bulk-clearing React state
  const clearAllEnemies = useCallback(() => {
    enemyPool.releaseAll();
    setEnemies([]);
  }, []);

  const clearAllBombs = useCallback(() => {
    bombPool.releaseAll();
    setBombs([]);
  }, []);

  // Pause-aware timer management - save remaining durations on pause, restore on resume
  useEffect(() => {
    // Include bossRushStatsOverlayActive as a pause state
    const isPaused = gameState === "paused" || gameState === "ready" || tutorialActive || bossRushStatsOverlayActive;

    if (isPaused && pauseStartTimeRef.current === null) {
      // Entering pause - save remaining durations
      pauseStartTimeRef.current = Date.now();
      const now = Date.now();
      savedTimerDurationsRef.current = {
        bossStunner: bossStunnerEndTime ? Math.max(0, bossStunnerEndTime - now) : null,
        reflectShield: reflectShieldEndTime ? Math.max(0, reflectShieldEndTime - now) : null,
        homingBall: homingBallEndTime ? Math.max(0, homingBallEndTime - now) : null,
        fireball: fireballEndTime ? Math.max(0, fireballEndTime - now) : null,
      };

      // Clear active timeouts
      if (reflectShieldTimeoutRef.current) {
        clearTimeout(reflectShieldTimeoutRef.current);
        reflectShieldTimeoutRef.current = null;
      }
      if (homingBallTimeoutRef.current) {
        clearTimeout(homingBallTimeoutRef.current);
        homingBallTimeoutRef.current = null;
      }
    } else if (!isPaused && pauseStartTimeRef.current !== null) {
      // Resuming from pause - restore timers with remaining duration
      const saved = savedTimerDurationsRef.current;
      const now = Date.now();
      const pauseDuration = now - pauseStartTimeRef.current;

      if (saved.bossStunner !== null && saved.bossStunner > 0) {
        setBossStunnerEndTime(now + saved.bossStunner);
        if (boss) {
          setBoss((prev) => (prev ? { ...prev, stunnedUntil: now + saved.bossStunner! } : null));
        }
      }

      if (saved.reflectShield !== null && saved.reflectShield > 0) {
        setReflectShieldEndTime(now + saved.reflectShield);
        reflectShieldTimeoutRef.current = setTimeout(() => {
          setReflectShieldActive(false);
          setReflectShieldEndTime(null);
          setPaddle((prev) => (prev ? { ...prev, hasReflectShield: false } : null));
          toast.info("Reflect Shield expired!");
        }, saved.reflectShield);
      }

      if (saved.homingBall !== null && saved.homingBall > 0) {
        setHomingBallEndTime(now + saved.homingBall);
        homingBallTimeoutRef.current = setTimeout(() => {
          setHomingBallActive(false);
          setHomingBallEndTime(null);
          setBalls((prev) => prev.map((ball) => ({ ...ball, isHoming: false })));
          toast.info("Homing Ball expired!");
        }, saved.homingBall);
      }

      if (saved.fireball !== null && saved.fireball > 0) {
        setFireballEndTime(now + saved.fireball);
      }

      // Adjust Boss Rush start time to freeze the elapsed timer during pause
      if (bossRushStartTime !== null) {
        setBossRushStartTime((prev) => (prev !== null ? prev + pauseDuration : null));
      }

      // Adjust enemy spawn timer to prevent immediate spawn on resume
      if (lastEnemySpawnTime > 0) {
        setLastEnemySpawnTime((prev) => prev + pauseDuration);
      }

      // Adjust cannon missile timer
      if (nextCannonMissileTime > 0) {
        setNextCannonMissileTime((prev) => prev + pauseDuration);
      }

      // Adjust Mega Boss absolute timestamps
      if (boss && isMegaBoss(boss)) {
        setBoss((prev) => {
          if (!prev || !isMegaBoss(prev)) return prev;
          const mb = prev as MegaBoss;
          return {
            ...mb,
            // Shift all scheduled danger ball timestamps
            scheduledDangerBalls: mb.scheduledDangerBalls.map((t) => t + pauseDuration),
            // Adjust invulnerability end time
            invulnerableUntil: mb.invulnerableUntil ? mb.invulnerableUntil + pauseDuration : mb.invulnerableUntil,
            // Adjust last swarm spawn time
            lastSwarmSpawnTime: mb.lastSwarmSpawnTime + pauseDuration,
            // Adjust visual effect timestamps
            cannonExtendedTime: mb.cannonExtendedTime ? mb.cannonExtendedTime + pauseDuration : null,
            coreExposedTime: mb.coreExposedTime ? mb.coreExposedTime + pauseDuration : null,
            hatchOpenStartTime: mb.hatchOpenStartTime ? mb.hatchOpenStartTime + pauseDuration : null,
            lastTrapTime: mb.lastTrapTime ? mb.lastTrapTime + pauseDuration : mb.lastTrapTime,
          } as unknown as Boss;
        });
      }

      // Adjust ball timestamps to account for pause duration
      setBalls((prev) =>
        prev.map((ball) => ({
          ...ball,
          lastGravityResetTime: ball.lastGravityResetTime
            ? ball.lastGravityResetTime + pauseDuration
            : ball.lastGravityResetTime,
          lastPaddleHitTime: ball.lastPaddleHitTime ? ball.lastPaddleHitTime + pauseDuration : ball.lastPaddleHitTime,
          releasedFromBossTime: ball.releasedFromBossTime
            ? ball.releasedFromBossTime + pauseDuration
            : ball.releasedFromBossTime,
          lastHitTime: ball.lastHitTime ? ball.lastHitTime + pauseDuration : ball.lastHitTime,
          lastWallHitTime: ball.lastWallHitTime ? ball.lastWallHitTime + pauseDuration : ball.lastWallHitTime,
        })),
      );

      // NOTE: lastHitAt, lastAttackTime, chain explosion triggerTimes are now sim-time based
      // and do NOT need pause adjustment. The adjustments below are kept for safety/legacy
      // but are no-ops for those fields.

      // Adjust boss lastHitAt
      if (boss) {
        setBoss((prev) => (prev ? { ...prev, lastHitAt: (prev.lastHitAt || 0) + pauseDuration } : null));
      }

      // Adjust resurrected bosses
      setResurrectedBosses((prev) =>
        prev.map((rb) => ({
          ...rb,
          lastHitAt: (rb.lastHitAt || 0) + pauseDuration,
        })),
      );

      // Adjust boss attack timestamps
      setBossAttacks((prev) =>
        prev.map((attack) => ({
          ...attack,
          stopStartTime: attack.stopStartTime ? attack.stopStartTime + pauseDuration : attack.stopStartTime,
          nextCourseChangeTime: attack.nextCourseChangeTime
            ? attack.nextCourseChangeTime + pauseDuration
            : attack.nextCourseChangeTime,
          spawnTime: attack.spawnTime ? attack.spawnTime + pauseDuration : attack.spawnTime,
        })),
      );

      // Adjust bonus letter spawnTime (used for sine wave animation)
      setBonusLetters((prev) =>
        prev.map((letter) => ({
          ...letter,
          spawnTime: letter.spawnTime + pauseDuration,
        })),
      );

      pauseStartTimeRef.current = null;
      savedTimerDurationsRef.current = { bossStunner: null, reflectShield: null, homingBall: null, fireball: null };
    }
  }, [
    gameState,
    tutorialActive,
    bossRushStatsOverlayActive,
    bossStunnerEndTime,
    reflectShieldEndTime,
    homingBallEndTime,
    fireballEndTime,
    boss,
    bossRushStartTime,
    lastEnemySpawnTime,
    nextCannonMissileTime,
  ]);

  // "Get Ready" speed ramp - gradually increase speed from 30% to 100% over 2 seconds
  useEffect(() => {
    if (!getReadyActive || getReadyStartTimeRef.current === null) return;

    const rampDuration = 3000; // 3 seconds
    const startSpeed = baseSpeedMultiplierRef.current * 0.1;
    const targetSpeed = baseSpeedMultiplierRef.current;

    const animate = () => {
      if (!getReadyActive || getReadyStartTimeRef.current === null) return;

      const elapsed = Date.now() - getReadyStartTimeRef.current;
      const progress = Math.min(elapsed / rampDuration, 1);

      // Ease-out curve for smoother acceleration
      const easeProgress = 1 - Math.pow(1 - progress, 2);
      const newSpeed = startSpeed + (targetSpeed - startSpeed) * easeProgress;

      setSpeedMultiplier(newSpeed);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [getReadyActive]);

  // Mobile ball glow animation - full intensity for 3s, fade out over 2s
  useEffect(() => {
    if (!isMobileDevice || !getReadyActive || getReadyGlowStartTimeRef.current === null) return;

    const fullGlowDuration = 3000; // 3 seconds at full intensity
    const fadeOutDuration = 2000; // 2 seconds fade out

    const animateGlow = () => {
      if (!getReadyActive || getReadyGlowStartTimeRef.current === null) {
        setGetReadyGlow(null);
        return;
      }

      const elapsed = Date.now() - getReadyGlowStartTimeRef.current;

      if (elapsed < fullGlowDuration) {
        // Full intensity phase
        setGetReadyGlow({ opacity: 1 });
        requestAnimationFrame(animateGlow);
      } else if (elapsed < fullGlowDuration + fadeOutDuration) {
        // Fade out phase
        const fadeProgress = (elapsed - fullGlowDuration) / fadeOutDuration;
        const opacity = 1 - fadeProgress;
        setGetReadyGlow({ opacity: Math.max(0, opacity) });
        requestAnimationFrame(animateGlow);
      } else {
        // Glow complete
        setGetReadyGlow(null);
        getReadyGlowStartTimeRef.current = null;
      }
    };

    requestAnimationFrame(animateGlow);
  }, [getReadyActive, isMobileDevice]);

  // Sound effect cooldowns (ms timestamps)
  const lastWallBounceSfxMs = useRef(0);
  const lastTurretDepleteSfxMs = useRef(0);

  // Game statistics tracking
  const [totalBricksDestroyed, setTotalBricksDestroyed] = useState(0);
  const [totalShots, setTotalShots] = useState(0);
  const [bricksHit, setBricksHit] = useState(0);
  const [levelSkipped, setLevelSkipped] = useState(false);
  const [livesLostOnCurrentLevel, setLivesLostOnCurrentLevel] = useState(0);
  const [bossFirstHitShieldDropped, setBossFirstHitShieldDropped] = useState(false);
  const [bossIntroActive, setBossIntroActive] = useState(false);

  // ═══ Hit Streak System (boss levels) ═══
  const [hitStreak, setHitStreak] = useState(0);
  const hitStreakRef = useRef(0);
  const [hitStreakActive, setHitStreakActive] = useState(false); // hue effect active
  const ballHitSinceLastPaddleRef = useRef<Set<number>>(new Set());
  // Dead refs removed: gameOverParticlesRef, highScoreParticlesRef, particleRenderTick
  // (particles are fully managed by particlePool)
  const [retryLevelData, setRetryLevelData] = useState<{ level: number; layout: any } | null>(null);
  const [powerUpsCollectedTypes, setPowerUpsCollectedTypes] = useState<Set<string>>(new Set());
  const [bricksDestroyedByTurrets, setBricksDestroyedByTurrets] = useState(0);
  const [bossesKilled, setBossesKilled] = useState(0);
  const [powerUpAssignments, setPowerUpAssignments] = useState<Map<number, PowerUpType>>(new Map());
  const [dualChoiceAssignments, setDualChoiceAssignments] = useState<Map<number, PowerUpType>>(new Map());
  const [powerUpDropCounts, setPowerUpDropCounts] = useState<Partial<Record<PowerUpType, number>>>({});

  const launchAngleDirectionRef = useRef(1);
  const unifiedLoopRef = useRef<UnifiedGameLoop | null>(null);
  const nextBallId = useRef(1);

  // Track bricks destroyed this level for level 1 multiball rule
  const bricksDestroyedThisLevelRef = useRef(0);

  // Mega Boss: prevent accidental life loss when ball is trapped (same/next tick race)
  const megaBossTrapJustHappenedRef = useRef<number>(0);

  // Performance optimization refs
  const screenShakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastTimeRef = useRef<Record<string, number>>({});
  const TOAST_THROTTLE_MS = 500;
  const nextEnemyId = useRef(1);
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const totalPlayTimeIntervalRef = useRef<NodeJS.Timeout>();
  const totalPlayTimeStartedRef = useRef(false);
  const bombIntervalsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const launchAngleIntervalRef = useRef<NodeJS.Timeout>();
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  //const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameGlowRef = useRef<HTMLDivElement>(null);
  const timerStartedRef = useRef(false);
  const nextLevelRef = useRef<(() => void) | null>(null);

  // Fixed-step game loop
  const gameLoopRef = useRef<FixedStepGameLoop | null>(null);
  const isTogglingFullscreenRef = useRef(false);

  // Initialize game loop utility on mount
  useEffect(() => {
    if (!gameLoopRef.current) {
      gameLoopRef.current = new FixedStepGameLoop({
        maxDeltaMs: MAX_DELTA_MS,
        timeScale: DEFAULT_TIME_SCALE,
        fpsCapMs: 1000 / FPS_CAP,
      });
    }
  }, []);

  // Initialize debug logger when debug features are enabled
  // Only intercept console when at least one logging toggle is active
  const anyLoggingActive =
    debugSettings.enableLagLogging ||
    debugSettings.enableGCLogging ||
    debugSettings.enableCollisionLogging ||
    debugSettings.enablePowerUpLogging ||
    debugSettings.enablePerformanceLogging ||
    debugSettings.enableFPSLogging ||
    debugSettings.enableDetailedFrameLogging ||
    debugSettings.enableBossLogging;

  useEffect(() => {
    if (ENABLE_DEBUG_FEATURES && anyLoggingActive) {
      debugLogger.intercept();
      return () => {
        debugLogger.restore();
      };
    }
  }, [anyLoggingActive]);

  // ═══════════════════════════════════════════════════════════════
  // UNIFIED CLEANUP - Clear ALL timers, intervals, and listeners on unmount
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    return () => {
      // Stop fixed-step game loop
      if (gameLoopRef.current) {
        gameLoopRef.current.stop();
      }

      // Clear named timeout refs
      if (bossStunnerTimeoutRef.current) {
        clearTimeout(bossStunnerTimeoutRef.current);
      }
      if (reflectShieldTimeoutRef.current) {
        clearTimeout(reflectShieldTimeoutRef.current);
      }
      if (homingBallTimeoutRef.current) {
        clearTimeout(homingBallTimeoutRef.current);
      }
      if (highlightFlashTimeoutRef.current) {
        clearTimeout(highlightFlashTimeoutRef.current);
      }
      if (screenShakeTimeoutRef.current) {
        clearTimeout(screenShakeTimeoutRef.current);
      }

      // Clear interval refs
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (totalPlayTimeIntervalRef.current) {
        clearInterval(totalPlayTimeIntervalRef.current);
      }
      if (launchAngleIntervalRef.current) {
        clearInterval(launchAngleIntervalRef.current);
      }

      // Clear bomb intervals map
      bombIntervalsRef.current.forEach((t) => clearTimeout(t));
      bombIntervalsRef.current.clear();

      // Stop unified game loop
      unifiedLoopRef.current?.stop();
      unifiedLoopRef.current = null;
    };
  }, []);

  // Sync game loop pause/resume with game state
  useEffect(() => {
    if (!gameLoopRef.current) return;

    if (gameState === "playing" && !tutorialActive) {
      gameLoopRef.current.resume();
    } else if (gameState === "paused" || tutorialActive) {
      gameLoopRef.current.pause();
    }
  }, [gameState, tutorialActive]);

  // Boss power-up effect handlers
  const handleBossStunner = useCallback(() => {
    const duration = 5000;
    const endTime = Date.now() + duration;
    setBossStunnerEndTime(endTime);

    // Use functional updates to avoid stale closures
    setBoss((prev) =>
      prev
        ? {
            ...prev,
            isStunned: true,
            stunnedUntil: endTime,
          }
        : null,
    );

    // Also stun resurrected bosses
    setResurrectedBosses((prev) =>
      prev.map((rb) => ({
        ...rb,
        isStunned: true,
        stunnedUntil: endTime,
      })),
    );

    // Clear existing timeout before setting new one
    if (bossStunnerTimeoutRef.current) {
      clearTimeout(bossStunnerTimeoutRef.current);
    }

    bossStunnerTimeoutRef.current = setTimeout(() => {
      setBossStunnerEndTime(null);

      // Reset isStunned on main boss
      setBoss((prev) =>
        prev
          ? {
              ...prev,
              isStunned: false,
              stunnedUntil: undefined,
            }
          : null,
      );

      // Reset isStunned on resurrected bosses
      setResurrectedBosses((prev) =>
        prev.map((rb) => ({
          ...rb,
          isStunned: false,
          stunnedUntil: undefined,
        })),
      );
    }, duration);
  }, []);

  const handleReflectShield = useCallback(() => {
    const endTime = Date.now() + 15000;
    setReflectShieldActive(true);
    setReflectShieldEndTime(endTime);
    setPaddle((prev) => (prev ? { ...prev, hasReflectShield: true } : null));

    if (reflectShieldTimeoutRef.current) {
      clearTimeout(reflectShieldTimeoutRef.current);
    }

    reflectShieldTimeoutRef.current = setTimeout(() => {
      setReflectShieldActive(false);
      setReflectShieldEndTime(null);
      setPaddle((prev) => (prev ? { ...prev, hasReflectShield: false } : null));
      toast.info("Reflect Shield expired!");
    }, 15000);
  }, []);

  const handleHomingBall = useCallback(() => {
    const endTime = Date.now() + 8000;
    setHomingBallActive(true);
    setHomingBallEndTime(endTime);
    setBalls((prev) => prev.map((ball) => ({ ...ball, isHoming: true })));

    if (homingBallTimeoutRef.current) {
      clearTimeout(homingBallTimeoutRef.current);
    }

    homingBallTimeoutRef.current = setTimeout(() => {
      setHomingBallActive(false);
      setHomingBallEndTime(null);
      setBalls((prev) => prev.map((ball) => ({ ...ball, isHoming: false })));
      toast.info("Homing Ball expired!");
    }, 8000);
  }, []);

  const handleBossHit = useCallback((x: number, y: number, isSuper: boolean) => {
    setBulletImpacts((prev) => [...prev, { x, y, startTime: Date.now(), isSuper }]);
    // Clean up old impacts after 500ms
    setTimeout(() => {
      setBulletImpacts((prev) => prev.filter((impact) => Date.now() - impact.startTime < 500));
    }, 600);
  }, []);

  // Handle fireball activation
  const handleFireballStart = useCallback(() => {
    setFireballEndTime(Date.now() + FIREBALL_DURATION);
  }, []);

  const handleFireballEnd = useCallback(() => {
    setFireballEndTime(null);
  }, []);

  // Handle second chance power-up activation
  const handleSecondChance = useCallback(() => {
    // Just for tracking - the paddle state is set in usePowerUps
  }, []);

  // Trigger highlight flash for background effects (levels 1-4)
  const triggerHighlightFlash = useCallback((intensity: number, duration: number) => {
    if (highlightFlashTimeoutRef.current) {
      clearTimeout(highlightFlashTimeoutRef.current);
    }
    setHighlightFlash(intensity);
    highlightFlashTimeoutRef.current = setTimeout(() => {
      setHighlightFlash(0);
      highlightFlashTimeoutRef.current = null;
    }, duration);
  }, []);

  // Consolidated screen shake with single timeout (performance optimization)
  const triggerScreenShake = useCallback((intensity: number, duration: number) => {
    if (screenShakeTimeoutRef.current) {
      clearTimeout(screenShakeTimeoutRef.current);
    }
    setScreenShake(intensity);
    screenShakeTimeoutRef.current = setTimeout(() => {
      setScreenShake(0);
      screenShakeTimeoutRef.current = null;
    }, duration);
  }, []);

  // Throttled toast to prevent rapid-fire notifications (performance optimization)
  const throttledToast = useCallback(
    (type: "success" | "warning" | "info" | "error", message: string, key?: string) => {
      const toastKey = key || message;
      const now = Date.now();
      const lastTime = lastToastTimeRef.current[toastKey] || 0;

      if (now - lastTime > TOAST_THROTTLE_MS) {
        lastToastTimeRef.current[toastKey] = now;
        toast[type](message);
      }
    },
    [],
  );

  const { isHighScore, addHighScore, getQualifiedLeaderboards } = useHighScores();
  const { powerUps, createPowerUp, updatePowerUps, checkPowerUpCollision, setPowerUps, extraLifeUsedLevels } =
    usePowerUps(
      level,
      setLives,
      timer,
      settings.difficulty,
      setBrickHitSpeedAccumulated,
      (type: string) => {
        setPowerUpsCollectedTypes((prev) => new Set(prev).add(type));

        // Track Boss Rush power-up collection
        if (isBossRush) {
          setBossRushPowerUpsThisBoss((prev) => prev + 1);
          setBossRushTotalPowerUps((prev) => prev + 1);
        }

        // Trigger golden highlight flash for extra life (levels 1-4)
        if (type === "life") {
          triggerHighlightFlash(1.5, 400);
        }

        // Trigger turret tutorial when turret is collected (only once per session)
        if (tutorialEnabled && type === "turrets" && !turretTutorialTriggeredRef.current) {
          turretTutorialTriggeredRef.current = true;
          const { shouldPause } = triggerTutorial("turret_collected", level);
          if (shouldPause) {
            setGameState("paused");
            if (gameLoopRef.current) gameLoopRef.current.pause();
          }
        }

        // Track power-up drop count and reassign remaining brick power-ups
        const powerUpType = type as PowerUpType;
        setPowerUpDropCounts((prevCounts) => {
          const newCounts = { ...prevCounts, [powerUpType]: (prevCounts[powerUpType] || 0) + 1 };

          // Reassign power-ups to remaining bricks with updated weights
          setBricks((currentBricks) => {
            const result = reassignPowerUpsToBricks(
              powerUpAssignments,
              currentBricks,
              extraLifeUsedLevels,
              level,
              settings.difficulty,
              newCounts,
            );
            setPowerUpAssignments(result.assignments);
            setDualChoiceAssignments(result.dualChoiceAssignments);

            if (ENABLE_DEBUG_FEATURES && debugSettings.enablePowerUpLogging) {
              console.log(
                `[Power-Up] Collected ${type}, reassigned ${result.assignments.size} power-ups with updated weights`,
              );
            }

            return currentBricks; // Don't modify bricks, just use current state
          });

          return newCounts;
        });
      },
      powerUpAssignments,
      handleBossStunner,
      handleReflectShield,
      handleHomingBall,
      handleFireballStart,
      handleFireballEnd,
      handleSecondChance,
      dualChoiceAssignments,
    );
  const { fireBullets, updateBullets } = useBullets(
    setScore,
    setBricks,
    bricks,
    enemies,
    setPaddle,
    () => setBricksDestroyedByTurrets((prev) => prev + 1),
    boss,
    resurrectedBosses,
    setBoss,
    setResurrectedBosses,
    () => nextLevelRef.current?.(),
    () => {
      // Turret depleted callback with cooldown
      const now = Date.now();
      if (now - lastTurretDepleteSfxMs.current >= 200) {
        lastTurretDepleteSfxMs.current = now;
        toast.info("Turrets depleted!");
      }
    },
    // Boss defeat callback
    (bossType, defeatedBoss) => {
      if (bossType === "cube") {
        handleBossDefeat(
          "cube",
          defeatedBoss,
          BOSS_CONFIG.cube.points,
          `CUBE GUARDIAN DEFEATED! +${BOSS_CONFIG.cube.points} points + BONUS LIFE!`,
        );
      } else if (bossType === "sphere") {
        handleBossDefeat(
          "sphere",
          defeatedBoss,
          BOSS_CONFIG.sphere.points,
          `SPHERE DESTROYER DEFEATED! +${BOSS_CONFIG.sphere.points} points + BONUS LIFE!`,
        );
      }
    },
    // Resurrected boss defeat callback
    (defeatedBoss, bossIdx) => {
      const config = BOSS_CONFIG.pyramid;
      setScore((s) => s + config.resurrectedPoints);
      toast.success(`PYRAMID DESTROYED! +${config.resurrectedPoints} points`);
      soundManager.playBossDefeatSound();
      soundManager.playExplosion();

      setExplosions((e) => [
        ...e,
        {
          x: defeatedBoss.x + defeatedBoss.width / 2,
          y: defeatedBoss.y + defeatedBoss.height / 2,
          frame: 0,
          maxFrames: 30,
          enemyType: "pyramid" as EnemyType,
          particles: createExplosionParticles(
            defeatedBoss.x + defeatedBoss.width / 2,
            defeatedBoss.y + defeatedBoss.height / 2,
            "pyramid" as EnemyType,
          ),
        },
      ]);

      // Check remaining resurrected bosses
      setResurrectedBosses((prev) => {
        const remaining = prev.filter((b) => b.id !== defeatedBoss.id);

        // Make last one super angry
        if (remaining.length === 1) {
          toast.error("FINAL PYRAMID ENRAGED!");
          remaining[0] = {
            ...remaining[0],
            isSuperAngry: true,
            speed: BOSS_CONFIG.pyramid.superAngryMoveSpeed,
          };
        }

        // Check if all defeated
        if (remaining.length === 0) {
          // Use a simplified version since handleBossDefeat expects a single boss object
          // and pyramid all-defeated doesn't award per-boss points (already awarded per-pyramid)
          if (settings.difficulty !== "godlike") {
            setLives((prev) => prev + 1);
          }
          toast.success(
            settings.difficulty === "godlike" ? "ALL PYRAMIDS DEFEATED!" : "ALL PYRAMIDS DEFEATED! + BONUS LIFE!",
          );
          setBossActive(false);
          setBossesKilled((k) => k + 1);
          setBossDefeatedTransitioning(true);
          setBossVictoryOverlayActive(true);
          setBalls([]);
          clearAllEnemies();
          setBossAttacks([]);
          clearAllBombs();
          world.bullets = [];
          bulletPool.releaseAll();

          if (isBossRush) {
            gameLoopRef.current?.pause();
            setBossRushTimeSnapshot(bossRushStartTime ? Date.now() - bossRushStartTime : 0);
            setBossRushStatsOverlayActive(true);
          } else {
            soundManager.stopBossMusic();
            soundManager.resumeBackgroundMusic();
            setTimeout(() => nextLevel(), 3000);
          }
        }

        return remaining;
      });
    },
    // Sphere phase change callback
    (sphereBoss) => {
      soundManager.playExplosion();
      toast.error("SPHERE PHASE 2: DESTROYER MODE!");
      setExplosions((e) => [
        ...e,
        {
          x: sphereBoss.x + sphereBoss.width / 2,
          y: sphereBoss.y + sphereBoss.height / 2,
          frame: 0,
          maxFrames: 30,
          enemyType: "sphere" as EnemyType,
          particles: createExplosionParticles(
            sphereBoss.x + sphereBoss.width / 2,
            sphereBoss.y + sphereBoss.height / 2,
            "sphere" as EnemyType,
          ),
        },
      ]);

      return {
        ...sphereBoss,
        currentHealth: BOSS_CONFIG.sphere.healthPhase2,
        currentStage: 2,
        isAngry: true,
        speed: BOSS_CONFIG.sphere.angryMoveSpeed,
        lastHitAt: world.simTimeMs,
      };
    },
    // Pyramid split callback
    (pyramidBoss) => {
      soundManager.playExplosion();
      toast.error("PYRAMID LORD SPLITS INTO 3!");
      setExplosions((e) => [
        ...e,
        {
          x: pyramidBoss.x + pyramidBoss.width / 2,
          y: pyramidBoss.y + pyramidBoss.height / 2,
          frame: 0,
          maxFrames: 30,
          enemyType: "pyramid" as EnemyType,
          particles: createExplosionParticles(
            pyramidBoss.x + pyramidBoss.width / 2,
            pyramidBoss.y + pyramidBoss.height / 2,
            "pyramid" as EnemyType,
          ),
        },
      ]);

      // Create 3 smaller resurrected pyramids
      const resurrected: Boss[] = [];
      for (let i = 0; i < 3; i++) {
        resurrected.push(createResurrectedPyramid(pyramidBoss, i, SCALED_CANVAS_WIDTH, SCALED_CANVAS_HEIGHT));
      }
      setResurrectedBosses(resurrected);
    },
    // Boss hit visual effect callback
    handleBossHit,
  );

  // Adaptive quality system
  const { quality, qualitySettings, updateFps, setQuality, toggleAutoAdjust, autoAdjustEnabled, resetQualityLockout } =
    useAdaptiveQuality({
      initialQuality: ENABLE_HIGH_QUALITY ? "high" : "medium",
      autoAdjust: true,
      lowFpsThreshold: 50,
      mediumFpsThreshold: 55,
      highFpsThreshold: 55,
      sampleWindow: 3,
      enableLogging: ENABLE_DEBUG_FEATURES && debugSettings.enableFPSLogging,
      isFullscreen,
    });

  // ═══ Sync React state → renderState singleton (for decoupled canvas rendering) ═══
  useEffect(() => {
    renderState.gameState = gameState;
    renderState.level = level;
    renderState.collectedLetters = collectedLetters;
    // powerUps now live in world.powerUps — no renderState bridge needed (race condition fix)
    renderState.qualitySettings = qualitySettings;
    renderState.showHighScoreEntry = showHighScoreEntry;
    renderState.bossIntroActive = bossIntroActive;
    renderState.bossSpawnAnimation = bossSpawnAnimation;
    renderState.tutorialHighlight = tutorialStep?.highlight ?? null;
    renderState.debugEnabled = ENABLE_DEBUG_FEATURES;
    renderState.isMobile = isMobileDevice;
    renderState.getReadyGlow = isMobileDevice ? getReadyGlow : null;
    renderState.secondChanceImpact = secondChanceImpact;
    renderState.ballReleaseHighlight = ballReleaseHighlight;

    // Sync render loop FPS target with quality level
    setRenderTargetFps(qualitySettings.level);
  }, [
    gameState,
    level,
    collectedLetters,
    qualitySettings,
    showHighScoreEntry,
    bossIntroActive,
    bossSpawnAnimation,
    tutorialStep,
    isMobileDevice,
    getReadyGlow,
    secondChanceImpact,
    ballReleaseHighlight,
  ]);

  // Desktop viewport frame - fills entire screen on desktop
  //useViewportFrame({
  //    enabled: !isMobileDevice,
  //    frameRef: gameContainerRef,
  //  });

  // Dynamic canvas resize for desktop - uses ResizeObserver
  //  const {
  //displayWidth,
  //displayHeight,
  //scale: dynamicScale,
  //} = useCanvasResize({
  //    enabled: !isMobileDevice,
  //containerRef: gameAreaRef,
  //gameGlowRef,
  //logicalWidth: SCALED_CANVAS_WIDTH,
  //logicalHeight: SCALED_CANVAS_HEIGHT,
  //});

  // Helper function to create explosion particles based on enemy type
  // OPTIMIZED: Uses particle pool instead of creating new arrays
  const createExplosionParticles = useCallback(
    (x: number, y: number, enemyType: EnemyType): Particle[] => {
      const particleCount = Math.round(qualitySettings.explosionParticles);
      // Add particles directly to the pool - no new array allocation
      particlePool.acquireForExplosion(x, y, particleCount, enemyType, gameLoopRef.current?.getTimeScale() ?? 1.0);
      // Return empty array for backwards compatibility with Explosion type
      // The actual particles are now managed by the pool
      return [];
    },
    [qualitySettings.explosionParticles],
  );

  // ═══ SHARED LIFE-LOSS & BOSS DEFEAT HELPERS ═══
  // Extracted from 5+ duplicate blocks to fix bugs and reduce code.

  /** Game-over branch: stops music, checks high scores, shows appropriate screen. */
  const handleGameOver = useCallback(() => {
    setGameState("gameOver");
    soundManager.stopBossMusic();
    soundManager.stopBackgroundMusic();
    setBossAttacks([]);
    setLaserWarnings([]);

    if (isBossRush) {
      const currentBossLevel = BOSS_RUSH_CONFIG.bossOrder[bossRushIndex] || 5;
      setBossRushGameOverLevel(currentBossLevel);
      const completionTime = bossRushStartTime ? Date.now() - bossRushStartTime : 0;
      setBossRushCompletionTime(completionTime);
      setShowBossRushScoreEntry(true);
      soundManager.playHighScoreMusic();
      toast.error("Boss Rush Over!");
    } else {
      const currentScore = scoreRef.current;
      getQualifiedLeaderboards(currentScore).then((qualification) => {
        if (!levelSkipped && (qualification.daily || qualification.weekly || qualification.allTime)) {
          setQualifiedLeaderboards(qualification);
          setShowHighScoreEntry(true);
          soundManager.playHighScoreMusic();
          toast.error("Game Over - New High Score!");
        } else {
          setShowEndScreen(true);
          toast.error("Game Over!");
        }
      });
    }
  }, [isBossRush, bossRushIndex, bossRushStartTime, levelSkipped, getQualifiedLeaderboards]);

  /**
   * Survive-death branch: resets ball (with proper angle math), clears all power-up
   * timers, entities, and bomb intervals. Optionally spawns mercy power-ups.
   */
  const handleSurviveDeath = useCallback(
    (toastMessage: string, opts?: { spawnMercy?: boolean }) => {
      const baseSpeed = 4.5;
      const initialAngle = (-20 * Math.PI) / 180;
      const resetBall: Ball = {
        x: SCALED_CANVAS_WIDTH / 2,
        y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
        dx: baseSpeed * Math.sin(initialAngle),
        dy: -baseSpeed * Math.cos(initialAngle),
        radius: SCALED_BALL_RADIUS,
        speed: baseSpeed,
        id: nextBallId.current++,
        isFireball: false,
        waitingToLaunch: true,
      };
      setBalls([resetBall]);
      setLaunchAngle(-20);
      launchAngleDirectionRef.current = 1;
      setShowInstructions(true);

      // Mercy power-ups (only for allBallsLost path)
      if (opts?.spawnMercy) {
        setLivesLostOnCurrentLevel((prev) => {
          const newCount = prev + 1;
          if (settings.difficulty === "godlike") {
            setPowerUps([]);
            return newCount;
          }
          let mercyType: PowerUpType;
          if (newCount >= 3) {
            mercyType = "life";
          } else {
            const mercyTypes: PowerUpType[] = ["turrets", "secondChance", "shield"];
            mercyType = mercyTypes[Math.floor(Math.random() * mercyTypes.length)];
          }
          const mercyPowerUp: PowerUp = {
            type: mercyType,
            x: SCALED_CANVAS_WIDTH / 2 - POWERUP_SIZE / 2,
            y: 100,
            width: POWERUP_SIZE,
            height: POWERUP_SIZE,
            speed: POWERUP_FALL_SPEED * (gameLoopRef.current?.getTimeScale() ?? 1.0),
            active: true,
            isMercyLife: mercyType === "life",
          };
          setPowerUps([mercyPowerUp]);
          return newCount;
        });
      } else {
        setPowerUps([]);
      }

      setBonusLetters([]);
      setPaddle((prev) =>
        prev
          ? { ...prev, hasTurrets: false, hasShield: false, hasReflectShield: false, width: SCALED_PADDLE_WIDTH }
          : null,
      );

      // Clear all power-up timers
      setBossStunnerEndTime(null);
      setReflectShieldEndTime(null);
      setHomingBallEndTime(null);
      setFireballEndTime(null);
      setReflectShieldActive(false);
      setHomingBallActive(false);
      if (reflectShieldTimeoutRef.current) {
        clearTimeout(reflectShieldTimeoutRef.current);
        reflectShieldTimeoutRef.current = null;
      }
      if (homingBallTimeoutRef.current) {
        clearTimeout(homingBallTimeoutRef.current);
        homingBallTimeoutRef.current = null;
      }

      world.bullets = [];
      bulletPool.releaseAll();
      if (world.speedMultiplier < 1) setSpeedMultiplier(1);
      setBrickHitSpeedAccumulated(0);
      setTimer(0);
      setLastEnemySpawnTime(0);
      clearAllEnemies();
      setBossAttacks([]);
      setLaserWarnings([]);
      clearAllBombs();
      setExplosions([]);
      bombIntervalsRef.current.forEach((interval) => clearInterval(interval));
      bombIntervalsRef.current.clear();
      setGameState("ready");
      toast(toastMessage);
    },
    [
      SCALED_CANVAS_WIDTH,
      SCALED_CANVAS_HEIGHT,
      SCALED_PADDLE_START_Y,
      SCALED_BALL_RADIUS,
      SCALED_PADDLE_WIDTH,
      settings.difficulty,
      clearAllEnemies,
      clearAllBombs,
    ],
  );

  /**
   * Boss defeat: plays sounds, awards points + bonus life, creates explosion,
   * cleans up entities, and transitions to victory overlay or next Boss Rush stage.
   */
  const handleBossDefeat = useCallback(
    (bossType: EnemyType, defeatedBoss: Boss, points: number, toastMessage: string) => {
      soundManager.playExplosion();
      soundManager.playBossDefeatSound();
      setScore((s) => s + points);
      if (settings.difficulty !== "godlike") {
        setLives((prev) => prev + 1);
      }
      toast.success(toastMessage);

      setExplosions((e) => [
        ...e,
        {
          x: defeatedBoss.x + defeatedBoss.width / 2,
          y: defeatedBoss.y + defeatedBoss.height / 2,
          frame: 0,
          maxFrames: 30,
          enemyType: bossType,
          particles: createExplosionParticles(
            defeatedBoss.x + defeatedBoss.width / 2,
            defeatedBoss.y + defeatedBoss.height / 2,
            bossType,
          ),
        },
      ]);

      setBossesKilled((k) => k + 1);
      setBossActive(false);
      setBossDefeatedTransitioning(true);
      setBossVictoryOverlayActive(true);
      setBalls([]);
      clearAllEnemies();
      setBossAttacks([]);
      clearAllBombs();
      world.bullets = [];
      bulletPool.releaseAll();

      if (isBossRush) {
        gameLoopRef.current?.pause();
        setBossRushTimeSnapshot(bossRushStartTime ? Date.now() - bossRushStartTime : 0);
        setBossRushStatsOverlayActive(true);
      } else {
        soundManager.stopBossMusic();
        soundManager.resumeBackgroundMusic();
        setTimeout(() => nextLevelRef.current?.(), 3000);
      }
    },
    [isBossRush, bossRushStartTime, createExplosionParticles, clearAllEnemies, clearAllBombs],
  );

  // createHighScoreParticles removed — replaced by particlePool.acquireForHighScore

  // Initialize sound settings - always enabled
  useEffect(() => {
    soundManager.setMusicEnabled(true);
    soundManager.setSfxEnabled(true);
  }, []);

  // Cross-platform swipe-to-pause gesture (works on both iOS and Android)
  useSwipeGesture(
    gameContainerRef,
    () => {
      if (gameState === "playing") {
        console.log("[Swipe Gesture] Swipe-right detected, pausing game");
        setGameState("paused");
        toast.info("Swiped to pause");
      }
    },
    {
      enabled: gameState === "playing" && isMobileDevice,
      minSwipeDistance: 50,
      leftEdgeThreshold: 0.15,
    },
  );

  // Cleanup expired shield impacts periodically (optimized for mobile)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setShieldImpacts((prev) => prev.filter((impact) => now - impact.startTime < impact.duration));
    }, 500);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Create random letter assignments for a new game
  const createRandomLetterAssignments = useCallback((startLevel: number = 1) => {
    // All levels where letters can drop from enemies
    const allAvailableLevels = [4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19];

    // Filter to only include levels >= starting level
    const availableLevels = allAvailableLevels.filter((lvl) => lvl >= startLevel);

    const allLetters: BonusLetterType[] = ["Q", "U", "M", "R", "A", "N"];

    // Shuffle letters for variety
    const shuffledLetters = [...allLetters].sort(() => Math.random() - 0.5);

    // Assign letters to ALL available levels (cycling through the 6 letters)
    const assignments: Record<number, BonusLetterType> = {};
    for (let i = 0; i < availableLevels.length; i++) {
      // Cycle through letters: level 0 gets letter 0, level 6 gets letter 0 again, etc.
      assignments[availableLevels[i]] = shuffledLetters[i % shuffledLetters.length];
    }

    return assignments;
  }, []);

  // Bonus letter drop logic - random letters on random levels
  const dropBonusLetter = useCallback(
    (x: number, y: number) => {
      // Check if this level has a letter assigned
      const assignedLetter = letterLevelAssignments[level];

      if (!assignedLetter) return; // No letter for this level

      // Only drop if letter hasn't been collected yet
      if (collectedLetters.has(assignedLetter)) return;

      // Check if letter was already dropped this level
      if (droppedLettersThisLevel.has(assignedLetter)) return;

      // Check if this letter is already falling
      const alreadyFalling = bonusLetters.some((bl) => bl.type === assignedLetter && bl.active);
      if (alreadyFalling) return;

      // Mark letter as dropped for this level
      setDroppedLettersThisLevel((prev) => new Set(prev).add(assignedLetter));

      const originX = x - 15;
      setBonusLetters((prev) => [
        ...prev,
        {
          x: originX,
          y: y,
          originX: originX,
          spawnTime: Date.now(),
          width: 30,
          height: 30,
          type: assignedLetter,
          speed: 2,
          active: true,
        },
      ]);

      // Show floating text for bonus letter (only once per session)
      if (!bonusLetterTutorialTriggeredRef.current) {
        bonusLetterTutorialTriggeredRef.current = true;
        setBonusLetterFloatingText({ active: true, startTime: Date.now() });
      }

      toast(`Bonus letter ${assignedLetter} dropped!`, {
        icon: "🎯",
      });
    },
    [
      level,
      collectedLetters,
      bonusLetters,
      droppedLettersThisLevel,
      letterLevelAssignments,
      tutorialEnabled,
      triggerTutorial,
    ],
  );
  const checkBonusLetterCollision = useCallback(() => {
    const paddle = world.paddle; // live read from engine state
    if (!paddle) return;
    setBonusLetters((prev) => {
      const updated = prev.filter((letter) => {
        if (!letter.active) return false;

        // Check collision with paddle
        if (
          letter.x + letter.width > paddle.x &&
          letter.x < paddle.x + paddle.width &&
          letter.y + letter.height > paddle.y &&
          letter.y < paddle.y + paddle.height
        ) {
          // Letter collected
          setCollectedLetters((prevCollected) => {
            const newCollected = new Set(prevCollected);
            newCollected.add(letter.type);

            // Check if all letters collected
            if (newCollected.size === 6) {
              setScore((s) => s + 500000);
              setLives((l) => l + 5);
              soundManager.playBonusComplete();
              toast.success("QUMRAN Complete! +5 Lives & +500,000 Points!", {
                duration: 5000,
              });
              // Long flash and screen shake for all letters
              setBackgroundFlash(1);
              triggerScreenShake(10, 800);
              setTimeout(() => setBackgroundFlash(0), 800);
            } else {
              soundManager.playBonusLetterPickup();
              toast.success(`Letter ${letter.type} collected!`);
              // Quick flash for single letter
              setBackgroundFlash(0.5);
              setTimeout(() => setBackgroundFlash(0), 200);
            }
            return newCollected;
          });
          return false;
        }

        // Check if letter went off screen (missed)
        if (letter.y > SCALED_CANVAS_HEIGHT) {
          // Add to missed letters queue for next level
          setMissedLetters((prev) => [...prev, letter.type]);
          toast(`Letter ${letter.type} missed! It will appear again.`, {
            icon: "🔄",
          });
          return false;
        }
        return true;
      });
      return updated;
    });
  }, []);
  const initBricksForLevel = useCallback((currentLevel: number) => {
    // Check if this is the Mega Boss level (level 20)
    if (currentLevel === MEGA_BOSS_LEVEL) {
      // Create Mega Boss
      const megaBoss = createMegaBoss(SCALED_CANVAS_WIDTH, SCALED_CANVAS_HEIGHT);
      setBoss(megaBoss as unknown as Boss); // Cast to Boss for state compatibility
      setBossActive(true);
      setResurrectedBosses([]);
      setBossAttacks([]);
      setLaserWarnings([]);
      setDangerBalls([]);

      // Center paddle at bottom (same Y as other levels for consistent barrier positioning)
      setPaddle((prev) => ({
        x: SCALED_CANVAS_WIDTH / 2 - SCALED_PADDLE_WIDTH / 2,
        y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
        width: SCALED_PADDLE_WIDTH,
        height: SCALED_PADDLE_HEIGHT,
        hasTurrets: prev?.hasTurrets || false,
        turretShots: prev?.turretShots || 0,
        hasSuperTurrets: prev?.hasSuperTurrets || false,
        hasShield: prev?.hasShield || false,
        hasSecondChance: prev?.hasSecondChance || false,
      }));

      toast.success(`LEVEL ${currentLevel}: MEGA BOSS!`, { duration: 3000 });
      return []; // No bricks on boss levels
    }

    // Check if this is a regular boss level (5, 10, 15)
    if (BOSS_LEVELS.includes(currentLevel) && currentLevel !== MEGA_BOSS_LEVEL) {
      const newBoss = createBoss(currentLevel, SCALED_CANVAS_WIDTH, SCALED_CANVAS_HEIGHT);
      // Initialize boss with lastHitAt timestamp for cooldown tracking
      if (newBoss) {
        setBoss({ ...newBoss, lastHitAt: 0 });
      } else {
        setBoss(newBoss);
      }
      setBossActive(true);
      setResurrectedBosses([]);
      setBossAttacks([]);
      setLaserWarnings([]);

      const bossName = newBoss?.type.toUpperCase();
      toast.success(`LEVEL ${currentLevel}: ${bossName} BOSS!`, { duration: 3000 });
      return []; // No bricks on boss levels
    }

    const layoutIndex = Math.min(currentLevel - 1, levelLayouts.length - 1);
    const layout = levelLayouts[layoutIndex];
    const levelColors = getBrickColors(currentLevel);
    const newBricks: Brick[] = [];
    let nextBrickId = 1; // Monotonic ID counter for stable brick IDs
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const cellValue = layout[row][col];
        if (cellValue === true || cellValue === 2 || cellValue === 3 || cellValue === 4) {
          const isIndestructible = cellValue === 2;

          // Determine brick type based on cell value
          let brickType: "normal" | "metal" | "cracked" | "explosive" = "normal";
          if (cellValue === 2) {
            brickType = "metal";
          } else if (cellValue === 3) {
            brickType = "explosive";
          } else if (cellValue === 4) {
            brickType = "cracked";
          }

          const hasPowerUp = isIndestructible ? false : Math.random() < POWERUP_DROP_CHANCE;
          const maxHits = isIndestructible ? 1 : brickType === "cracked" ? 3 : getBrickHits(currentLevel, row);

          let baseColor: string;
          if (isIndestructible) {
            baseColor = "hsl(0, 0%, 20%)"; // Dark gray for metal
          } else if (brickType === "explosive") {
            baseColor = "hsl(15, 90%, 50%)"; // Orange-red for explosive
          } else if (brickType === "cracked") {
            baseColor = "hsl(40, 15%, 45%)"; // Brownish-gray for cracked
          } else {
            baseColor = levelColors[row % levelColors.length];
          }

          // Metal bricks expand to fill padding space, creating continuous surfaces
          const brickWidth = isIndestructible ? SCALED_BRICK_WIDTH + SCALED_BRICK_PADDING : SCALED_BRICK_WIDTH;
          const brickHeight = isIndestructible ? SCALED_BRICK_HEIGHT + SCALED_BRICK_PADDING : SCALED_BRICK_HEIGHT;

          // Metal bricks are positioned to overlap into the padding space
          const xPos =
            col * (SCALED_BRICK_WIDTH + SCALED_BRICK_PADDING) +
            SCALED_BRICK_OFFSET_LEFT -
            (isIndestructible && col > 0 ? SCALED_BRICK_PADDING / 2 : 0);
          const yPos =
            row * (SCALED_BRICK_HEIGHT + SCALED_BRICK_PADDING) +
            SCALED_BRICK_OFFSET_TOP -
            (isIndestructible && row > 0 ? SCALED_BRICK_PADDING / 2 : 0);
          newBricks.push({
            id: nextBrickId++, // Stable, monotonic ID
            x: xPos,
            y: yPos,
            width: brickWidth,
            height: brickHeight,
            color: baseColor,
            visible: true,
            points: isIndestructible ? 0 : (BRICK_ROWS - row) * 10 * maxHits,
            hasPowerUp,
            maxHits,
            hitsRemaining: maxHits,
            isIndestructible,
            type: brickType,
          });
        }
      }
    }
    return newBricks;
  }, []);

  // Initialize power-up assignments for bricks
  const initPowerUpAssignments = useCallback(
    (bricks: Brick[], targetLevel: number, dropCounts: Partial<Record<PowerUpType, number>> = {}) => {
      const result = assignPowerUpsToBricks(bricks, extraLifeUsedLevels, targetLevel, settings.difficulty, dropCounts);
      setPowerUpAssignments(result.assignments);
      setDualChoiceAssignments(result.dualChoiceAssignments);
      if (ENABLE_DEBUG_FEATURES && debugSettings.enablePowerUpLogging) {
        console.log(
          `[Power-Up] Assigned ${result.assignments.size} power-ups (${result.dualChoiceAssignments.size} dual-choice) to ${bricks.length} bricks for level ${targetLevel} (${Math.round((result.assignments.size / bricks.length) * 100)}%)`,
        );
      }
    },
    [extraLifeUsedLevels, settings.difficulty],
  );
  const initGame = useCallback(() => {
    // Reset quality lockout for new game session
    resetQualityLockout();

    // Initialize paddle
    const initialPaddleX = SCALED_CANVAS_WIDTH / 2 - SCALED_PADDLE_WIDTH / 2;
    setPaddle({
      x: initialPaddleX,
      y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
      width: SCALED_PADDLE_WIDTH,
      height: SCALED_PADDLE_HEIGHT,
      hasTurrets: false,
    });
    // Initialize high-priority paddle position ref
    paddleXRef.current = initialPaddleX;

    // Calculate speed for starting level BEFORE creating ball
    const startLevel = settings.startingLevel;
    const startingSpeedMultiplier = calculateSpeedForLevel(startLevel, settings.difficulty);

    // Initialize ball with correct speed multiplier for starting level
    const baseSpeed = 4.5 * startingSpeedMultiplier;
    const initialAngle = (-20 * Math.PI) / 180; // Start from left side
    const initialBall: Ball = {
      x: SCALED_CANVAS_WIDTH / 2,
      y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
      dx: baseSpeed * Math.sin(initialAngle), // Calculate from angle
      dy: -baseSpeed * Math.cos(initialAngle), // Calculate from angle
      radius: SCALED_BALL_RADIUS,
      speed: baseSpeed,
      id: nextBallId.current++,
      isFireball: false,
      waitingToLaunch: true,
      rotation: 0,
    };
    setBalls([initialBall]);
    setLaunchAngle(-20); // Start from left side
    launchAngleDirectionRef.current = 1; // Move right initially
    setShowInstructions(true); // Show instructions for new game

    // Create random letter assignments based on starting level
    setLetterLevelAssignments(createRandomLetterAssignments(startLevel));

    // Initialize bricks for starting level (startLevel already declared above)
    const initialBricks = initBricksForLevel(startLevel);
    setBricks(initialBricks);
    // Reset power-up drop counts for new game
    setPowerUpDropCounts({});
    initPowerUpAssignments(initialBricks, startLevel, {});
    bricksDestroyedThisLevelRef.current = 0; // Reset level 1 multiball tracking
    setScore(0);
    setLives(settings.startingLives);
    setLevel(startLevel);
    setLivesLostOnCurrentLevel(0); // Reset mercy power-up counter
    setBossFirstHitShieldDropped(false); // Reset shield drop for new game
    setHitStreak(0);
    hitStreakRef.current = 0;
    setHitStreakActive(false);
    ballHitSinceLastPaddleRef.current.clear();
    // Set speed multiplier (already calculated above)
    setSpeedMultiplier(startingSpeedMultiplier);
    setGameState("ready");
    setPowerUps([]);
    setTimer(0);
    setTotalPlayTime(0);
    timerStartedRef.current = false;
    totalPlayTimeStartedRef.current = false;
    clearAllEnemies();
    clearAllBombs();
    setBackgroundPhase(0);
    setExplosions([]);
    setEnemySpawnCount(0);
    setLastEnemySpawnTime(0);
    setBonusLetters([]);
    setDroppedLettersThisLevel(new Set());
    setCollectedLetters(new Set());
    setMissedLetters([]);
    setEnemiesKilled(0);
    setLastBossSpawnTime(0);
    setBossSpawnAnimation(null);

    // Reset Boss Rush session state when starting a new Boss Rush run
    if (isBossRush) {
      resetBossRushSessionState();
    }
    // Only clear boss state if starting level is NOT a boss level
    if (!BOSS_LEVELS.includes(startLevel)) {
      setBoss(null);
      setResurrectedBosses([]);
      setBossAttacks([]);
      setBossActive(false);
      setLaserWarnings([]);
      setBossIntroActive(false);
    } else {
      // Boss starting level - trigger intro sequence
      setBossIntroActive(true);
      soundManager.playBossIntroSound();

      // Reset first boss minion tracking for this boss level
      firstBossMinionKilledRef.current = false;

      // Show boss name and start boss music after 1 second
      setTimeout(() => {
        soundManager.playBossMusic(startLevel);
        const bossName =
          startLevel === 5
            ? "CUBE GUARDIAN"
            : startLevel === 10
              ? "SPHERE DESTROYER"
              : startLevel === 15
                ? "PYRAMID LORD"
                : "MEGA BOSS";
        toast.error(`⚠️ BOSS APPROACHING: ${bossName} ⚠️`, { duration: 3000 });
      }, 1000);

      // End intro after 3 seconds
      setTimeout(() => {
        setBossIntroActive(false);
      }, 3000);
    }
    bombIntervalsRef.current.forEach((interval) => clearInterval(interval));
    bombIntervalsRef.current.clear();
  }, [
    setPowerUps,
    initBricksForLevel,
    createRandomLetterAssignments,
    initPowerUpAssignments,
    settings.startingLevel,
    resetQualityLockout,
  ]);
  const nextLevel = useCallback(() => {
    // Stop game loop before starting new level
    if (gameLoopRef.current) {
      gameLoopRef.current.stop();
    }

    // Clear timer interval before resetting
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    timerStartedRef.current = false;
    bombIntervalsRef.current.forEach((interval) => clearInterval(interval));
    bombIntervalsRef.current.clear();
    setBonusLetters([]);
    setDroppedLettersThisLevel(new Set());

    // Boss Rush mode: progress through boss order
    if (isBossRush) {
      const nextBossIndex = bossRushIndex + 1;

      // Check if all bosses defeated
      if (nextBossIndex >= BOSS_RUSH_CONFIG.bossOrder.length) {
        // Boss Rush complete! Calculate completion time
        const completionTime = bossRushStartTime ? Date.now() - bossRushStartTime : 0;
        setBossRushCompletionTime(completionTime);
        setScore((s) => s + BOSS_RUSH_CONFIG.completionBonus);
        setShowBossRushVictory(true);
        soundManager.stopBossMusic();
        soundManager.resumeBackgroundMusic();
        return;
      }

      // Next boss in Boss Rush
      setBossRushIndex(nextBossIndex);
      const nextBossLevel = BOSS_RUSH_CONFIG.bossOrder[nextBossIndex] as BossRushLevel;
      const newSpeedMultiplier = BOSS_RUSH_CONFIG.speedMultipliers[nextBossLevel];

      setLevel(nextBossLevel);
      setLivesLostOnCurrentLevel(0);
      setBossFirstHitShieldDropped(false);
      // Keep hitStreak across boss rush level transitions — do NOT reset here
      ballHitSinceLastPaddleRef.current.clear();
      setSpeedMultiplier(newSpeedMultiplier);

      setPaddle((prev) => ({
        x: SCALED_CANVAS_WIDTH / 2 - SCALED_PADDLE_WIDTH / 2,
        y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
        width: SCALED_PADDLE_WIDTH,
        height: SCALED_PADDLE_HEIGHT,
        hasTurrets: prev?.hasTurrets || false,
        turretShots: prev?.turretShots || 0,
        hasSuperTurrets: prev?.hasSuperTurrets || false,
        hasShield: prev?.hasShield || false,
        hasSecondChance: prev?.hasSecondChance || false,
      }));

      const baseSpeed = 5.175 * Math.min(newSpeedMultiplier, 1.55);
      const initialBall: Ball = {
        x: SCALED_CANVAS_WIDTH / 2,
        y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
        dx: baseSpeed,
        dy: -baseSpeed,
        radius: SCALED_BALL_RADIUS,
        speed: baseSpeed,
        id: nextBallId.current++,
        isFireball: false,
        waitingToLaunch: true,
      };
      setBalls([initialBall]);
      // Seed new ball into hit tracking so first paddle contact doesn't reset streak
      ballHitSinceLastPaddleRef.current.add(initialBall.id);
      setLaunchAngle(-20);
      launchAngleDirectionRef.current = 1;
      setShowInstructions(true);

      // Initialize boss for next Boss Rush level
      const newLevelBricks = initBricksForLevel(nextBossLevel);
      setBricks(newLevelBricks);
      setPowerUpDropCounts({});
      initPowerUpAssignments(newLevelBricks, nextBossLevel, {});
      bricksDestroyedThisLevelRef.current = 0;
      setPowerUps([]);
      world.bullets = [];
      bulletPool.releaseAll();
      setTimer(0);
      clearAllEnemies();
      clearAllBombs();
      setExplosions([]);
      setEnemySpawnCount(0);
      setLastEnemySpawnTime(0);
      setBrickHitSpeedAccumulated(0);
      setLastBossSpawnTime(0);
      setBossSpawnAnimation(null);
      setBossDefeatedTransitioning(false); // Reset so minions can spawn for next boss

      // Boss Rush always has bosses
      setBossIntroActive(true);
      soundManager.playBossIntroSound();
      firstBossMinionKilledRef.current = false;

      setTimeout(() => {
        soundManager.playBossMusic(nextBossLevel);
        const bossName = BOSS_RUSH_CONFIG.bossNames[nextBossLevel];
        toast.error(`⚠️ BOSS ${nextBossIndex + 1}/4: ${bossName} ⚠️`, { duration: 3000 });
      }, 1000);

      setTimeout(() => {
        setBossIntroActive(false);
      }, 3000);

      bombIntervalsRef.current.forEach((interval) => clearInterval(interval));
      bombIntervalsRef.current.clear();
      setGameState("playing");
      toast.success(`Boss ${nextBossIndex + 1}/4! Speed: ${Math.round(newSpeedMultiplier * 100)}%`);
      return;
    }

    // Normal mode progression
    const newLevel = level + 1;

    // Reassign missed letters to the new level if it's a valid letter level
    const availableLevels = [4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 20];
    if (missedLetters.length > 0 && availableLevels.includes(newLevel)) {
      const letterToReassign = missedLetters[0];
      setLetterLevelAssignments((prev) => ({ ...prev, [newLevel]: letterToReassign }));
      setMissedLetters((prev) => prev.slice(1)); // Remove from missed queue
    }

    const newSpeedMultiplier = calculateSpeedForLevel(newLevel, settings.difficulty);
    setLevel(newLevel);
    setLivesLostOnCurrentLevel(0); // Reset mercy power-up counter for new level
    setBossFirstHitShieldDropped(false); // Reset shield drop for new boss level
    // Keep hitStreak across level transitions — do NOT reset here
    ballHitSinceLastPaddleRef.current.clear();
    setSpeedMultiplier(newSpeedMultiplier);

    // Update max level reached in localStorage
    updateMaxLevel(newLevel);
    setPaddle((prev) => ({
      x: SCALED_CANVAS_WIDTH / 2 - SCALED_PADDLE_WIDTH / 2,
      y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
      width: SCALED_PADDLE_WIDTH,
      height: SCALED_PADDLE_HEIGHT,
      hasTurrets: prev?.hasTurrets || false,
      turretShots: prev?.turretShots || 0,
      hasSuperTurrets: prev?.hasSuperTurrets || false,
      hasShield: prev?.hasShield || false,
      hasSecondChance: prev?.hasSecondChance || false, // Persist second chance across levels
    }));

    // Initialize ball with new speed - waiting to launch (capped at 155%)
    const baseSpeed = 5.175 * Math.min(newSpeedMultiplier, 1.55); // 50% faster base speed
    const initialBall: Ball = {
      x: SCALED_CANVAS_WIDTH / 2,
      y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
      dx: baseSpeed,
      dy: -baseSpeed,
      radius: SCALED_BALL_RADIUS,
      speed: baseSpeed,
      id: nextBallId.current++,
      isFireball: false,
      waitingToLaunch: true,
    };
    setBalls([initialBall]);
    // Seed new ball into hit tracking so first paddle contact doesn't reset streak
    ballHitSinceLastPaddleRef.current.add(initialBall.id);
    setLaunchAngle(-20); // Start from left side
    launchAngleDirectionRef.current = 1; // Move right initially
    setShowInstructions(true); // Show instructions for new level

    // Initialize bricks for new level
    const newLevelBricks = initBricksForLevel(newLevel);
    setBricks(newLevelBricks);
    // Reset power-up drop counts for new level
    setPowerUpDropCounts({});
    initPowerUpAssignments(newLevelBricks, newLevel, {});
    bricksDestroyedThisLevelRef.current = 0; // Reset brick counter for new level
    setPowerUps([]);
    world.bullets = [];
    bulletPool.releaseAll();
    setTimer(0);
    clearAllEnemies();
    clearAllBombs();
    setExplosions([]);
    setEnemySpawnCount(0);
    setLastEnemySpawnTime(0);
    setBonusLetters([]);
    // Don't reset collected letters between levels
    // Reset accumulated slowdown speed on level clear
    setBrickHitSpeedAccumulated(0);
    setLastBossSpawnTime(0);
    setBossSpawnAnimation(null);
    setTimer(0); // Reset timer on level clear (for turret drop chance reset)
    // Only clear boss state if the new level is NOT a boss level
    if (!BOSS_LEVELS.includes(newLevel)) {
      setBoss(null);
      setResurrectedBosses([]);
      setBossAttacks([]);
      setBossActive(false);
      setLaserWarnings([]);
      setBossDefeatedTransitioning(false);
    } else {
      // Boss level - trigger intro sequence
      setBossIntroActive(true);
      soundManager.playBossIntroSound();

      // Reset first boss minion tracking for this boss level
      firstBossMinionKilledRef.current = false;

      // Show boss name and start boss music after 1 second
      setTimeout(() => {
        soundManager.playBossMusic(newLevel);
        const bossName =
          newLevel === 5
            ? "CUBE GUARDIAN"
            : newLevel === 10
              ? "SPHERE DESTROYER"
              : newLevel === 15
                ? "PYRAMID LORD"
                : "MEGA BOSS";
        toast.error(`⚠️ BOSS APPROACHING: ${bossName} ⚠️`, { duration: 3000 });
      }, 1000);

      // End intro after 3 seconds
      setTimeout(() => {
        setBossIntroActive(false);
      }, 3000);
    }
    bombIntervalsRef.current.forEach((interval) => clearInterval(interval));
    bombIntervalsRef.current.clear();
    setGameState("playing");
    if (newLevel === 10) {
      toast.success(`Level ${newLevel}! New music unlocked!`);
    } else {
      toast.success(`Level ${newLevel}! Speed: ${Math.round(newSpeedMultiplier * 100)}%`);
    }
  }, [
    level,
    initBricksForLevel,
    setPowerUps,
    initPowerUpAssignments,
    updateMaxLevel,
    missedLetters,
    isBossRush,
    bossRushIndex,
    settings.difficulty,
    calculateSpeedForLevel,
  ]);

  // Update nextLevel ref whenever nextLevel function changes
  nextLevelRef.current = nextLevel;

  // Reset boss tutorial ref when level changes
  useEffect(() => {
    bossTutorialTriggeredRef.current = false;
  }, [level]);

  // Tutorial triggers for level start
  useEffect(() => {
    if (!tutorialEnabled) return;

    // Trigger tutorial on level 1 start
    if (gameState === "ready" && level === 1) {
      const { shouldPause } = triggerTutorial("level_start", level);
      if (shouldPause) {
        setGameState("paused");
      }
    }
  }, [gameState, level, tutorialEnabled, triggerTutorial]);

  // Tutorial trigger for boss spawn - fires when bossIntroActive starts
  useEffect(() => {
    if (!tutorialEnabled || !bossIntroActive) return;

    if (!bossTutorialTriggeredRef.current) {
      bossTutorialTriggeredRef.current = true;
      const { shouldPause } = triggerTutorial("boss_spawn", level);
      if (shouldPause) {
        setGameState("paused");
        if (gameLoopRef.current) gameLoopRef.current.pause();
      }
    }
  }, [bossIntroActive, tutorialEnabled, triggerTutorial, level]);

  useEffect(() => {
    initGame();

    // Preload power-up sounds
    soundManager.preloadSounds().catch((err) => {
      console.error("Failed to preload sounds:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
  // Unified ball launch function - single source of truth for all launch paths
  const launchBallAtCurrentAngle = useCallback(() => {
    // Block launch if stats overlay just closed (debounce)
    if (Date.now() - statsOverlayJustClosedRef.current < 200) return;
    const balls = world.balls; // live read from engine state
    const waitingBall = balls.find((ball) => ball.waitingToLaunch);
    if (!waitingBall || gameState !== "playing") return;

    // Dismiss boss victory overlay when launching ball
    if (bossVictoryOverlayActive) {
      setBossVictoryOverlayActive(false);
    }

    setShowInstructions(false);

    // Start timer on first ball launch
    if (!timerStartedRef.current) {
      timerStartedRef.current = true;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }

    // Start total play time on first ball launch
    if (!totalPlayTimeStartedRef.current) {
      totalPlayTimeStartedRef.current = true;
      if (totalPlayTimeIntervalRef.current) {
        clearInterval(totalPlayTimeIntervalRef.current);
      }
      totalPlayTimeIntervalRef.current = setInterval(() => {
        setTotalPlayTime((prev) => prev + 1);
      }, 1000);
    }

    // Track shot fired
    setTotalShots((prev) => prev + 1);

    setBalls((prev) =>
      prev.map((ball) => {
        if (ball.waitingToLaunch) {
          const speed = ball.speed;
          const angle = (launchAngle * Math.PI) / 180;
          return {
            ...ball,
            dx: speed * Math.sin(angle),
            dy: -speed * Math.cos(angle),
            waitingToLaunch: false,
            lastPaddleHitTime: performance.now(),
            lastGravityResetTime: performance.now(),
          };
        }
        return ball;
      }),
    );
  }, [gameState, launchAngle, bossVictoryOverlayActive]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const paddle = world.paddle; // live read from engine state
      if (!canvasRef.current || !paddle || gameState === "paused") return;

      let targetX: number;

      // Use movementX when pointer is locked, otherwise use absolute position
      if (isPointerLocked) {
        const sensitivity = 1.5;
        targetX = Math.max(0, Math.min(SCALED_CANVAS_WIDTH - paddle.width, paddle.x + e.movementX * sensitivity));
      } else if (gameState === "playing" || gameState === "ready") {
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = SCALED_CANVAS_WIDTH / rect.width;
        const mouseX = (e.clientX - rect.left) * scaleX;
        targetX = Math.max(0, Math.min(SCALED_CANVAS_WIDTH - paddle.width, mouseX - paddle.width / 2));
      } else {
        return;
      }

      const newX = targetX;

      // Update ref immediately for high-priority collision detection
      paddleXRef.current = newX;

      // Update state for rendering (may be delayed during low FPS)
      setPaddle((prev) =>
        prev
          ? {
              ...prev,
              x: newX,
            }
          : null,
      );
    },
    [gameState, isPointerLocked, SCALED_CANVAS_WIDTH, SCALED_CANVAS_HEIGHT],
  );
  const activeTouchRef = useRef<number | null>(null);
  const secondTouchRef = useRef<number | null>(null);

  // Mobile touch optimization: cache canvas rect to avoid layout thrashing
  const canvasRectRef = useRef<DOMRect | null>(null);
  const canvasRectTimeRef = useRef(0);
  const RECT_CACHE_MS = 500; // Refresh rect cache every 500ms

  const getCanvasRect = useCallback(() => {
    const now = performance.now();
    if (!canvasRectRef.current || now - canvasRectTimeRef.current > RECT_CACHE_MS) {
      canvasRectRef.current = canvasRef.current?.getBoundingClientRect() || null;
      canvasRectTimeRef.current = now;
    }
    return canvasRectRef.current;
  }, []);

  // Mobile touch throttling: limit state updates to ~60fps
  const lastTouchUpdateRef = useRef(0);
  const TOUCH_THROTTLE_MS = 16; // ~60fps

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      // Don't process game input during tutorial - let TutorialOverlay handle it
      if (tutorialActive) return;

      const paddle = world.paddle; // live read from engine state
      if (!canvasRef.current || !paddle) return;
      e.preventDefault();

      // Single-tap to start game when in "ready" state (mobile start)
      if (gameState === "ready" && e.touches.length === 1) {
        console.log("[Ready Tap Debug] readyTapStart: enabled - Single tap detected, starting game");
        const hasDestructibleBricks = bricks.some((brick) => !brick.isIndestructible);
        const isLevelComplete =
          hasDestructibleBricks && bricks.every((brick) => !brick.visible || brick.isIndestructible);

        if (isLevelComplete) {
          nextLevel();
        } else {
          // Start game - start music only if not already playing (and not boss music)
          setGameState("playing");
          // Start Boss Rush timer on first game start
          if (isBossRush && bossRushStartTime === null) {
            setBossRushStartTime(Date.now());
          }
          if (!soundManager.isMusicPlaying() && !soundManager.isBossMusicPlaying()) {
            soundManager.playBackgroundMusic();
          }
          toast.success("Tap again to launch!");
        }
        return;
      }
      const waitingBall = balls.find((ball) => ball.waitingToLaunch);

      // If ball is waiting and there are 2 fingers, second finger controls launch angle
      if (e.touches.length > 1 && waitingBall && gameState === "playing") {
        // First touch controls paddle, second touch sets launch angle
        if (activeTouchRef.current !== null && secondTouchRef.current === null) {
          // Find the second touch (not the first one)
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier !== activeTouchRef.current) {
              secondTouchRef.current = e.touches[i].identifier;

              // Calculate launch angle from second finger position relative to paddle
              const rect = canvasRef.current.getBoundingClientRect();
              const scaleX = SCALED_CANVAS_WIDTH / rect.width;
              const touchX = (e.touches[i].clientX - rect.left) * scaleX;

              // Calculate angle: -60 to +60 degrees based on second finger position relative to paddle center
              const paddleCenter = paddle.x + paddle.width / 2;
              const relativeX = touchX - paddleCenter;
              const maxDistance = SCALED_CANVAS_WIDTH / 3; // Max distance for full angle range
              const normalizedX = Math.max(-1, Math.min(1, relativeX / maxDistance));
              const angle = normalizedX * 60; // -60 to +60 degrees

              setLaunchAngle(angle);
              console.log("[Launch Debug] audioAndLaunchMode: applied - Second finger angle:", angle);
              break;
            }
          }
        }

        // Fire turrets if paddle has turrets
        if (paddle.hasTurrets) {
          fireBullets(paddle);
        }
        return; // Don't launch ball yet
      }

      // Fire turrets if there are multiple touches (2+ fingers) and paddle has turrets and ball is NOT waiting
      if (e.touches.length > 1 && paddle.hasTurrets && gameState === "playing" && !waitingBall) {
        fireBullets(paddle);
        return;
      }

      // Track the first touch for paddle control
      if (e.touches.length > 0 && activeTouchRef.current === null) {
        activeTouchRef.current = e.touches[0].identifier;

        // Update paddle position immediately on touch start
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = SCALED_CANVAS_WIDTH / rect.width;
        const touchX = (e.touches[0].clientX - rect.left) * scaleX;
        const newX = Math.max(0, Math.min(SCALED_CANVAS_WIDTH - paddle.width, touchX - paddle.width / 2));
        setPaddle((prev) =>
          prev
            ? {
                ...prev,
                x: newX,
              }
            : null,
        );

        // Single tap on ball when waiting launches it (explicit launch)
        if (waitingBall && gameState === "playing" && e.touches.length === 1) {
          console.log("[Launch Debug] Touch launch - Ball launched at angle:", launchAngle);
          launchBallAtCurrentAngle();
        }
      }
    },
    [
      // paddle removed — reads world.paddle live
      balls,
      gameState,
      launchAngle,
      fireBullets,
      SCALED_CANVAS_WIDTH,
      bricks,
      nextLevel,
      tutorialActive,
      launchBallAtCurrentAngle,
    ],
  );
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const paddle = world.paddle; // live read from engine state
      if (!canvasRef.current || !paddle || gameState === "paused") return;
      e.preventDefault();

      // Use cached canvas rect to avoid layout thrashing on every touch event
      const rect = getCanvasRect();
      if (!rect) return;

      const scaleX = SCALED_CANVAS_WIDTH / rect.width;
      const waitingBall = balls.find((ball) => ball.waitingToLaunch);

      // Update launch angle if second finger is moving and ball is waiting
      if (waitingBall && secondTouchRef.current !== null) {
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === secondTouchRef.current) {
            const touchX = (e.touches[i].clientX - rect.left) * scaleX;

            // Calculate angle from second finger position relative to paddle center
            const paddleCenter = paddle.x + paddle.width / 2;
            const relativeX = touchX - paddleCenter;
            const maxDistance = SCALED_CANVAS_WIDTH / 3;
            const normalizedX = Math.max(-1, Math.min(1, relativeX / maxDistance));
            const angle = normalizedX * 60;
            setLaunchAngle(angle);
            break;
          }
        }
      }

      // Track the first touch for paddle control
      let activeTouch = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === activeTouchRef.current) {
          activeTouch = e.touches[i];
          break;
        }
      }

      // If no active touch found, use the first touch
      if (!activeTouch && e.touches.length > 0) {
        activeTouch = e.touches[0];
        activeTouchRef.current = activeTouch.identifier;
      }
      if (!activeTouch) return;

      const touchX = (activeTouch.clientX - rect.left) * scaleX;

      // Implement scaled touch control zone (middle 70% controls full paddle range)
      const controlZoneLeft = SCALED_CANVAS_WIDTH * 0.15;
      const controlZoneRight = SCALED_CANVAS_WIDTH * 0.85;
      const controlZoneWidth = controlZoneRight - controlZoneLeft;

      // Clamp touch position to control zone
      const touchInZone = Math.max(controlZoneLeft, Math.min(controlZoneRight, touchX));

      // Map to normalized position (0 to 1)
      const normalizedPosition = (touchInZone - controlZoneLeft) / controlZoneWidth;

      // Map to full paddle range
      const paddleRange = SCALED_CANVAS_WIDTH - paddle.width;
      const newX = normalizedPosition * paddleRange;

      // Always update ref immediately for collision detection (no throttle)
      paddleXRef.current = newX;

      // Throttle React state updates to ~60fps to reduce GC pressure on mobile
      const now = performance.now();
      if (now - lastTouchUpdateRef.current < TOUCH_THROTTLE_MS) {
        return; // Skip state update, ref is already updated for physics
      }
      lastTouchUpdateRef.current = now;

      // Update state for rendering
      setPaddle((prev) => {
        if (!prev) return null;
        if (prev.x === newX) return prev; // Skip if no change
        return { ...prev, x: newX };
      });
    },
    [SCALED_CANVAS_WIDTH, gameState, getCanvasRect],
  );
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Clear active touches when they end
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchRef.current) {
        activeTouchRef.current = null;
      }
      if (e.changedTouches[i].identifier === secondTouchRef.current) {
        secondTouchRef.current = null;
        console.log("[Launch Debug] audioAndLaunchMode: default - Second finger released");
      }
    }
  }, []);
  const handleClick = useCallback(() => {
    // Don't process clicks during tutorial - let TutorialOverlay handle it
    if (tutorialActive) return;

    // Request pointer lock on canvas click (desktop only)
    if (!isMobileDevice && canvasRef.current && document.pointerLockElement !== canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }

    // If game is ready, start the game first
    if (gameState === "ready") {
      // Check if there are destructible bricks
      const hasDestructibleBricks = bricks.some((brick) => !brick.isIndestructible);
      const isLevelComplete =
        hasDestructibleBricks && bricks.every((brick) => !brick.visible || brick.isIndestructible);

      if (isLevelComplete) {
        nextLevel();
      } else {
        // Start game - start music only if not already playing (and not boss music)
        setGameState("playing");
        // Start Boss Rush timer on first game start
        if (isBossRush && bossRushStartTime === null) {
          setBossRushStartTime(Date.now());
        }
        if (!soundManager.isMusicPlaying() && !soundManager.isBossMusicPlaying()) {
          soundManager.playBackgroundMusic(level);
        }
        toast.success("Click again to launch!");
      }
      return;
    }
    if (!paddle || gameState !== "playing") return;

    // Check if ball is waiting to launch
    const waitingBall = balls.find((ball) => ball.waitingToLaunch);
    if (waitingBall) {
      launchBallAtCurrentAngle();
      return;
    }

    // Fire turrets
    if (paddle.hasTurrets) {
      fireBullets(paddle);
    }
  }, [
    paddle,
    gameState,
    fireBullets,
    bricks,
    nextLevel,
    balls,
    launchAngle,
    level,
    tutorialActive,
    isMobileDevice,
    launchBallAtCurrentAngle,
  ]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        console.log(
          "[ESC Key] Pressed - gameState:",
          gameState,
          "showDebugDashboard:",
          showDebugDashboard,
          "debugDashboardPausedGame:",
          debugDashboardPausedGame,
        );
        // Escape key priority order:
        // 1. Close debug dashboard if open
        // 2. Pause/Resume game
        if (ENABLE_DEBUG_FEATURES && showDebugDashboard) {
          console.log("[ESC Key] Closing debug dashboard");
          setShowDebugDashboard(false);
        } else if (gameState === "playing") {
          console.log("[ESC Key] Opening pause menu from playing state");
          setGameState("paused");
          document.exitPointerLock();
          if (gameLoopRef.current) {
            gameLoopRef.current.pause();
          }
          toast.info("Game paused. Press ESC to resume.");
        } else if (gameState === "paused" && !debugDashboardPausedGame) {
          console.log("[ESC Key] Resuming game from paused state");
          setGameState("playing");
          const canvas = canvasRef.current;
          if (canvas && canvas.requestPointerLock) {
            canvas.requestPointerLock();
          }
          if (gameLoopRef.current) {
            gameLoopRef.current.resume();
          }
          toast.info("Game resumed!");
        } else {
          console.log("[ESC Key] No action taken - conditions not met");
        }
      } else if (e.key === "n" || e.key === "N") {
        soundManager.nextTrack();
        toast.success("Next track");
      } else if (e.key === "b" || e.key === "B") {
        soundManager.previousTrack();
        toast.success("Previous track");
      } else if (e.key === "p" || e.key === "P") {
        // Toggle pause
        if (gameState === "playing") {
          setGameState("paused");
          document.exitPointerLock();
          if (gameLoopRef.current) {
            gameLoopRef.current.pause();
          }
          toast.success("Game paused");
        } else if (gameState === "paused") {
          setGameState("playing");
          const canvas = canvasRef.current;
          if (canvas && canvas.requestPointerLock) {
            canvas.requestPointerLock();
          }
          if (gameLoopRef.current) {
            gameLoopRef.current.resume();
          }
          toast.success("Game resumed");
        }
      } else if (e.key === "m" || e.key === "M") {
        const enabled = soundManager.toggleMute();
        toast.success(enabled ? "Music on" : "Music muted");
      }

      // ═══════════════════════════════════════════════════════════════
      // ████████╗ DEBUG KEYBOARD CONTROLS - REMOVE BEFORE PRODUCTION ████████╗
      // ═══════════════════════════════════════════════════════════════
      if (ENABLE_DEBUG_FEATURES) {
        if (e.key === "Tab") {
          e.preventDefault(); // Prevent default tab behavior
          // Toggle substep debug overlay
          toggleDebugSetting("showSubstepDebug");
          toast.success(debugSettings.showSubstepDebug ? "Ball substep debug disabled" : "Ball substep debug enabled");
        } else if (e.key === "l" || e.key === "L") {
          // Toggle debug overlay
          toggleDebugSetting("showGameLoopDebug");
          toast.success(debugSettings.showGameLoopDebug ? "Debug overlay disabled" : "Debug overlay enabled");
        } else if (e.key === "w" || e.key === "W") {
          // Toggle power-up weights overlay
          toggleDebugSetting("showPowerUpWeights");
          toast.success(debugSettings.showPowerUpWeights ? "Power-up weights disabled" : "Power-up weights enabled");
        } else if (e.key === "[") {
          // Decrease time scale
          if (gameLoopRef.current) {
            const newScale = Math.max(MIN_TIME_SCALE, gameLoopRef.current.getTimeScale() - 0.1);
            gameLoopRef.current.setTimeScale(newScale);
            toast.success(`Time scale: ${newScale.toFixed(1)}x`);
          }
        } else if (e.key === "]") {
          // Increase time scale
          if (gameLoopRef.current) {
            const newScale = Math.min(MAX_TIME_SCALE, gameLoopRef.current.getTimeScale() + 0.1);
            gameLoopRef.current.setTimeScale(newScale);
            toast.success(`Time scale: ${newScale.toFixed(1)}x`);
          }
        } else if (e.key === "q" || e.key === "Q") {
          if (e.shiftKey) {
            // Shift+Q: Toggle auto-adjust
            toggleAutoAdjust();
          } else {
            // Q: Cycle quality levels
            const levels: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
            const currentIndex = levels.indexOf(quality);
            const nextIndex = (currentIndex + 1) % levels.length;
            const nextQuality = levels[nextIndex];

            // Use the hook's setQuality which handles everything properly
            setQuality(nextQuality);
          }
        } else if (e.key === "c" || e.key === "C") {
          // Toggle collision debug logs
          toggleDebugSetting("enableCollisionLogging");
          toast.success(debugSettings.enableCollisionLogging ? "Collision debug disabled" : "Collision debug enabled");
        } else if (e.key === "h" || e.key === "H") {
          // Toggle collision history viewer
          toggleDebugSetting("showCollisionHistory");
          toast.success(
            debugSettings.showCollisionHistory ? "Collision history disabled" : "Collision history enabled",
          );
        } else if (e.key === "x" || e.key === "X") {
          // Export collision history to JSON
          const historyJSON = collisionHistory.exportToJSON();
          const blob = new Blob([historyJSON], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `collision-history-${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("Collision history exported to JSON");
        } else if (e.key === "z" || e.key === "Z") {
          // Download debug logs
          const stats = debugLogger.getStats();
          debugLogger.downloadLogs();
          toast.success(`Debug logs downloaded (${stats.total} entries, ${stats.lagEvents} lag events)`);
        } else if (e.key === "§") {
          // Toggle debug dashboard (pauses/resumes game automatically)
          setShowDebugDashboard((prev) => !prev);
        } else if (e.key === "v" || e.key === "V") {
          // Toggle CCD performance profiler
          toggleDebugSetting("showCCDPerformance");
          toast.success(
            debugSettings.showCCDPerformance ? "CCD performance profiler disabled" : "CCD performance profiler enabled",
          );
        } else if (e.key === "0") {
          // Clear level and advance - mark as level skipped (disqualified from high scores)
          setLevelSkipped(true);
          if (soundManager.isBossMusicPlaying()) {
            soundManager.stopBossMusic();
          }
          nextLevel();
          toast.warning("Level skipped! You are DISQUALIFIED from high scores!", { duration: 3000 });
        } else if (e.key === "+" || e.key === "=") {
          // Increase ball speed by 5%
          setSpeedMultiplier((prev) => {
            const newSpeed = prev * 1.05;
            toast.success(`Debug: Speed increased to ${Math.round(newSpeed * 100)}%`);
            return newSpeed;
          });
        } else if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(e.key) && paddle) {
          // Drop power-ups for testing - disqualifies from high scores
          setLevelSkipped(true);
          const powerUpMap: Record<string, PowerUpType> = {
            "1": "shield",
            "2": "turrets",
            "3": "life",
            "4": "slowdown",
            "5": "multiball",
            "6": "paddleShrink",
            "7": "paddleExtend",
            "8": "fireball",
          };

          const type = powerUpMap[e.key];
          const newPowerUp: PowerUp = {
            x: paddle.x + paddle.width / 2 - POWERUP_SIZE / 2,
            y: paddle.y - 50, // Drop from above paddle
            width: POWERUP_SIZE,
            height: POWERUP_SIZE,
            type: type,
            speed: POWERUP_FALL_SPEED * (gameLoopRef.current?.getTimeScale() ?? 1.0),
            active: true,
          };

          setPowerUps((prev) => [...prev, newPowerUp]);
          toast.warning(`Debug: ${type} power-up dropped - DISQUALIFIED from high scores!`);
        } else if ((e.key === "9" || e.key === "r" || e.key === "R" || e.key === "e" || e.key === "E") && paddle) {
          // Drop boss-exclusive power-ups for testing - disqualifies from high scores
          setLevelSkipped(true);
          const bossPowerUpMap: Record<string, PowerUpType> = {
            "9": "bossStunner",
            r: "reflectShield",
            R: "reflectShield",
            e: "homingBall",
            E: "homingBall",
          };

          const type = bossPowerUpMap[e.key];
          const newPowerUp: PowerUp = {
            x: paddle.x + paddle.width / 2 - POWERUP_SIZE / 2,
            y: paddle.y - 50, // Drop from above paddle
            width: POWERUP_SIZE,
            height: POWERUP_SIZE,
            type: type,
            speed: POWERUP_FALL_SPEED * (gameLoopRef.current?.getTimeScale() ?? 1.0),
            active: true,
          };

          setPowerUps((prev) => [...prev, newPowerUp]);
          toast.warning(`Debug: ${type} power-up dropped - DISQUALIFIED from high scores!`);
        } else if ((e.key === "u" || e.key === "U") && paddle) {
          // Drop a random bonus letter for testing - disqualifies from high scores
          setLevelSkipped(true);
          const letterTypes: BonusLetterType[] = ["Q", "U", "M", "R", "A", "N"];
          const randomLetter = letterTypes[Math.floor(Math.random() * letterTypes.length)];
          const originX = paddle.x + paddle.width / 2 - 15;

          setBonusLetters((prev) => [
            ...prev,
            {
              x: originX,
              y: paddle.y - 50, // Drop from above paddle
              originX: originX,
              spawnTime: Date.now(),
              width: 30,
              height: 30,
              type: randomLetter,
              speed: 2,
              active: true,
            },
          ]);
          toast.warning(`Debug: Bonus letter "${randomLetter}" dropped - DISQUALIFIED from high scores!`);
        }
      }
      // ═══════════════════════════════════════════════════════════════
    };
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === canvas;
      setIsPointerLocked(isLocked);

      // If pointer lock was released while toggling fullscreen, don't pause
      if (isTogglingFullscreenRef.current) {
        return;
      }

      // If pointer lock was released (ESC pressed) while playing, pause the game (desktop only)
      // Mobile devices don't use pointer lock, so skip this check entirely
      if (!isLocked && gameState === "playing" && !isMobileDevice) {
        console.log("[PointerLock] Released during gameplay - pausing game");
        setGameState("paused");
        if (gameLoopRef.current) {
          gameLoopRef.current.pause();
        }
        toast.info("Game paused. Press ESC to resume.");
      }
    };
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    canvas.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    canvas.addEventListener("touchend", handleTouchEnd, {
      passive: false,
    });
    canvas.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyPress);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyPress);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [
    handleMouseMove,
    handleTouchMove,
    handleClick,
    nextLevel,
    gameState,
    showDebugDashboard,
    debugDashboardPausedGame,
  ]);

  // Get substep debug info for overlay
  const getSubstepDebugInfo = useCallback(() => {
    const balls = world.balls; // live read
    const speedMultiplier = world.speedMultiplier; // live read
    if (balls.length === 0) {
      return {
        substeps: 0,
        ballSpeed: 0,
        ballCount: 0,
        maxSpeed: 0,
        collisionsPerFrame: 0,
        toiIterations: 0,
      };
    }

    const speeds = balls.map((ball) => Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy));
    const maxBallSpeed = Math.max(...speeds);
    const minBrickDimension = Math.min(SCALED_BRICK_WIDTH, SCALED_BRICK_HEIGHT);
    const substeps = Math.max(2, Math.ceil((maxBallSpeed * speedMultiplier) / (minBrickDimension * 0.15)));

    // Gravity info — freeze display while paused so the countdown doesn't tick
    const isPausedNow = gameState === "paused" || gameState === "ready" || tutorialActive || bossRushStatsOverlayActive;
    const gravityNow =
      isPausedNow && pauseStartTimeRef.current !== null
        ? performance.now() - (Date.now() - pauseStartTimeRef.current)
        : performance.now();
    const firstBall = balls[0];
    const timeSinceCollision = gravityNow - (firstBall?.lastGravityResetTime ?? gravityNow);
    const gravityActive = timeSinceCollision > GRAVITY_DELAY_MS;
    const gravityTimeLeft = gravityActive ? 0 : Math.max(0, (GRAVITY_DELAY_MS - timeSinceCollision) / 1000);

    return {
      substeps,
      ballSpeed: maxBallSpeed * speedMultiplier,
      ballCount: balls.length,
      maxSpeed: maxBallSpeed,
      collisionsPerFrame: 0,
      toiIterations: 0,
      gravityActive,
      gravityTimeLeft,
      ballDy: firstBall ? firstBall.dy : 0,
      totalSpeed: firstBall
        ? Math.sqrt(firstBall.dx * firstBall.dx + firstBall.dy * firstBall.dy) * speedMultiplier
        : 0,
    };
  }, [SCALED_BRICK_WIDTH, SCALED_BRICK_HEIGHT]);

  const checkCollision = useCallback(() => {
    const paddle = world.paddle;
    const balls = world.balls;
    const boss = world.boss;
    if (!paddle || balls.length === 0) return;

    const maxTotalSpeed = settings.difficulty === "godlike" ? MAX_TOTAL_SPEED_GODLIKE : MAX_TOTAL_SPEED_NORMAL;

    // ═══ Run pure physics frame ═══
    const result = runPhysicsFrame({
      dtSeconds: dtSecondsRef.current,
      frameTick: gameLoopRef.current?.getFrameTick() || 0,
      level,
      canvasSize: { w: SCALED_CANVAS_WIDTH, h: SCALED_CANVAS_HEIGHT },
      minBrickDimension: Math.min(SCALED_BRICK_WIDTH, SCALED_BRICK_HEIGHT),
      qualityLevel: qualitySettings.level,
      difficulty: settings.difficulty,
      maxTotalSpeed,
      isBossRush,
      debugSettings,
      pendingChainExplosions: pendingChainExplosionsRef.current,
      frameCount: frameCountRef.current,
      megaBossTrapJustHappenedTime: megaBossTrapJustHappenedRef.current,
    });

    // ═══ Store CCD performance data ═══
    if (result.ccdPerformance) {
      ccdPerformanceRef.current = result.ccdPerformance;
      if (ENABLE_DEBUG_FEATURES) {
        ccdPerformanceTrackerRef.current.addFrame({
          bossFirstSweepUs: result.ccdPerformance.bossFirstSweepUs,
          ccdCoreUs: result.ccdPerformance.ccdCoreUs,
          postProcessingUs: result.ccdPerformance.postProcessingUs,
          totalUs: result.ccdPerformance.totalUs,
          substeps: result.ccdPerformance.substepsUsed,
          collisions: result.ccdPerformance.collisionCount,
          toiIterations: result.ccdPerformance.toiIterationsUsed,
        });
      }
    }

    // ═══ Update pending chain explosions ═══
    // Must copy — result.updatedPendingChainExplosions is the reusable singleton array;
    // assigning directly aliases it, so createEmptyResult()'s .length = 0 on the next
    // frame would silently wipe pendingChainExplosionsRef.current before it is read.
    pendingChainExplosionsRef.current = result.updatedPendingChainExplosions.slice();

    // ═══ Play sounds ═══
    for (const sound of result.soundsToPlay) {
      switch (sound.type) {
        case "bounce": {
          const now = Date.now();
          if (now - lastWallBounceSfxMs.current >= 50) {
            soundManager.playBounce();
            lastWallBounceSfxMs.current = now;
          }
          break;
        }
        case "brick":
          soundManager.playBrickHit();
          break;
        case "cracked":
          soundManager.playBrickHit("cracked", sound.param);
          break;
        case "explosion":
          soundManager.playExplosion();
          break;
        case "bossHit":
          soundManager.playBossHitSound();
          break;
        case "explosiveBrick":
          soundManager.playExplosiveBrickSound();
          break;
        case "secondChanceSave":
          soundManager.playSecondChanceSaveSound();
          break;
      }
    }

    // ═══ Apply toasts ═══
    for (const t of result.toastEvents) {
      throttledToast(t.level, t.message, t.key);
    }

    // ═══ Apply screen shakes ═══
    for (const shake of result.screenShakes) {
      triggerScreenShake(shake.intensity, shake.duration);
    }

    // ═══ Highlight flashes ═══
    for (let i = 0; i < result.highlightFlashCount; i++) {
      triggerHighlightFlash(1.0, 150);
    }
    if (result.backgroundFlash) {
      setBackgroundFlash(10);
      setTimeout(() => setBackgroundFlash(0), 100);
    }

    // ═══ Boss Rush paddle tracking ═══
    if (isBossRush) {
      for (const ballId of result.paddleHitBallIds) {
        setBossRushShotsThisBoss((prev) => prev + 1);
        ballsPendingHitRef.current.add(ballId);
      }
      for (const ballId of result.bossHitBallIds) {
        if (ballsPendingHitRef.current.has(ballId)) {
          ballsPendingHitRef.current.delete(ballId);
          setBossRushHitsThisBoss((prev) => prev + 1);
        }
      }
    }

    // ═══ Hit Streak: paddle bounce check ═══
    const isBossLevel = BOSS_LEVELS.includes(level) || level === MEGA_BOSS_LEVEL;
    if (isBossLevel && !bossDefeatedTransitioningRef.current) {
      for (const ballId of result.paddleHitBallIds) {
        if (!ballHitSinceLastPaddleRef.current.has(ballId)) {
          // Ball returned to paddle without hitting boss/enemy — reset streak
          setHitStreak(0);
          hitStreakRef.current = 0;
          setHitStreakActive(false);
          world.backgroundHue = 0;
        }
        // Clear the flag for next cycle
        ballHitSinceLastPaddleRef.current.delete(ballId);
      }
    }

    // ═══ Hit Streak: boss/enemy hit tracking ═══
    if (isBossLevel) {
      // Boss hits
      for (const hit of result.bossHits) {
        if (!hit.canDamage) continue;
        ballHitSinceLastPaddleRef.current.add(hit.ballId);
        setHitStreak((prev) => {
          const newStreak = prev + 1;
          hitStreakRef.current = newStreak;
          // Award 100 points with streak bonus
          const bonus = Math.floor(100 * (1 + newStreak / 100));

          setScore((s) => s + bonus);
          // Activate hue effect at x10+
          if (newStreak >= 10 && !hitStreakActive) {
            setHitStreakActive(true);
          }
          return newStreak;
        });
      }
      // Enemy hits (includes first hits and kills)
      for (const ballId of result.enemyHitBallIds) {
        ballHitSinceLastPaddleRef.current.add(ballId);
        setHitStreak((prev) => {
          const newStreak = prev + 1;
          hitStreakRef.current = newStreak;
          const bonus = Math.floor(100 * (1 + newStreak / 100));

          setScore((s) => s + bonus);
          if (newStreak >= 10 && !hitStreakActive) {
            setHitStreakActive(true);
          }
          return newStreak;
        });
      }
    }

    // ═══ Boss hit events — apply damage via React state ═══
    for (const hit of result.bossHits) {
      if (!hit.canDamage) continue;

      // Drop shield on first boss hit
      if (!bossFirstHitShieldDropped) {
        setBossFirstHitShieldDropped(true);
        const shieldPowerUp: PowerUp = {
          type: "shield",
          x: (boss ? boss.x + boss.width / 2 : SCALED_CANVAS_WIDTH / 2) - POWERUP_SIZE / 2,
          y: boss ? boss.y + boss.height : 200,
          width: POWERUP_SIZE,
          height: POWERUP_SIZE,
          speed: POWERUP_FALL_SPEED * (gameLoopRef.current?.getTimeScale() ?? 1.0),
          active: true,
        };
        setPowerUps((currentPowerUps) => [...currentPowerUps, shieldPowerUp]);
        toast.info("🛡️ Shield incoming!");
      }

      setBossHitCooldown(1000);

      if (hit.isMainBoss) {
        setBoss((prev) => {
          if (!prev) return prev;

          // ═══ MEGA BOSS SPECIAL HANDLING ═══
          if (isMegaBoss(prev)) {
            const megaBoss = prev as MegaBoss;
            if (megaBoss.coreExposed || megaBoss.trappedBall) return prev;

            const { newOuterHP, newInnerHP, shouldExposeCore } = handleMegaBossOuterDamage(megaBoss, 1);
            const activeShieldHP = megaBoss.outerShieldRemoved ? newInnerHP : newOuterHP;
            const activeShieldMaxHP = megaBoss.outerShieldRemoved
              ? megaBoss.innerShieldMaxHP
              : megaBoss.outerShieldMaxHP;

            if (shouldExposeCore) {
              const exposedBoss = exposeMegaBossCore({
                ...megaBoss,
                outerShieldHP: newOuterHP,
                innerShieldHP: newInnerHP,
              });
              toast.warning(`⚠️ CORE EXPOSED! Hit the core!`, { duration: 3000 });
              soundManager.playExplosion();
              triggerScreenShake(12, 600);
              return {
                ...exposedBoss,
                currentHealth: 0,
                lastHitAt: hit.nowMs,
              } as unknown as Boss;
            } else {
              toast.info(
                `MEGA BOSS: ${activeShieldHP}/${activeShieldMaxHP} ${megaBoss.outerShieldRemoved ? "Inner" : "Outer"} Shield`,
                { duration: 1000, style: { background: "#ff0000", color: "#fff" } },
              );
              return {
                ...megaBoss,
                outerShieldHP: newOuterHP,
                innerShieldHP: newInnerHP,
                currentHealth: activeShieldHP,
                lastHitAt: hit.nowMs,
              } as unknown as Boss;
            }
          }

          // ═══ REGULAR BOSS HANDLING ═══
          const newHealth = Math.max(0, prev.currentHealth - 1);

          if (newHealth <= 0) {
            if (prev.type === "mega") return prev;

            if (prev.type === "cube") {
              handleBossDefeat(
                "cube",
                prev,
                BOSS_CONFIG.cube.points,
                `CUBE GUARDIAN DEFEATED! +${BOSS_CONFIG.cube.points} points + BONUS LIFE!`,
              );
              return null;
            } else if (prev.type === "sphere") {
              if (prev.currentStage === 1) {
                soundManager.playExplosion();
                toast.error("SPHERE PHASE 2: DESTROYER MODE!");
                setExplosions((e) => [
                  ...e,
                  {
                    x: prev.x + prev.width / 2,
                    y: prev.y + prev.height / 2,
                    frame: 0,
                    maxFrames: 30,
                    enemyType: "sphere" as EnemyType,
                    particles: createExplosionParticles(
                      prev.x + prev.width / 2,
                      prev.y + prev.height / 2,
                      "sphere" as EnemyType,
                    ),
                  },
                ]);
                return {
                  ...prev,
                  currentHealth: BOSS_CONFIG.sphere.healthPhase2,
                  currentStage: 2,
                  isAngry: true,
                  speed: BOSS_CONFIG.sphere.angryMoveSpeed,
                  lastHitAt: hit.nowMs,
                };
              } else {
                handleBossDefeat(
                  "sphere",
                  prev,
                  BOSS_CONFIG.sphere.points,
                  `SPHERE DESTROYER DEFEATED! +${BOSS_CONFIG.sphere.points} points + BONUS LIFE!`,
                );
                return null;
              }
            } else if (prev.type === "pyramid") {
              if (prev.currentStage === 1) {
                soundManager.playExplosion();
                toast.error("PYRAMID LORD SPLITS INTO 3!");
                setExplosions((e) => [
                  ...e,
                  {
                    x: prev.x + prev.width / 2,
                    y: prev.y + prev.height / 2,
                    frame: 0,
                    maxFrames: 30,
                    enemyType: "pyramid" as EnemyType,
                    particles: createExplosionParticles(
                      prev.x + prev.width / 2,
                      prev.y + prev.height / 2,
                      "pyramid" as EnemyType,
                    ),
                  },
                ]);
                const resurrected: Boss[] = [];
                for (let i = 0; i < 3; i++) {
                  resurrected.push(createResurrectedPyramid(prev, i, SCALED_CANVAS_WIDTH, SCALED_CANVAS_HEIGHT));
                }
                setResurrectedBosses(resurrected);
                return null;
              }
            }
          } else {
            toast.info(`BOSS: ${newHealth} HP`, {
              duration: 1000,
              style: { background: "#ff0000", color: "#fff" },
            });
          }

          if (debugSettings.enableBossLogging) {
            console.log("[BossSweep] Damage applied! Boss health:", newHealth);
          }
          return { ...prev, currentHealth: newHealth, lastHitAt: hit.nowMs };
        });
      } else {
        // Resurrected boss damage
        setResurrectedBosses((prev) => {
          const bossIdx = prev.findIndex((b) => b.id === hit.bossId);
          if (bossIdx < 0) return prev;
          const newBosses = [...prev];
          const newHealth = Math.max(0, newBosses[bossIdx].currentHealth - 1);

          if (newHealth <= 0) {
            const config = BOSS_CONFIG.pyramid;
            setScore((s) => s + config.resurrectedPoints);
            toast.success(`PYRAMID DESTROYED! +${config.resurrectedPoints} points`);
            soundManager.playBossDefeatSound();
            setExplosions((e) => [
              ...e,
              {
                x: newBosses[bossIdx].x + newBosses[bossIdx].width / 2,
                y: newBosses[bossIdx].y + newBosses[bossIdx].height / 2,
                frame: 0,
                maxFrames: 30,
                enemyType: "pyramid" as EnemyType,
                particles: createExplosionParticles(
                  newBosses[bossIdx].x + newBosses[bossIdx].width / 2,
                  newBosses[bossIdx].y + newBosses[bossIdx].height / 2,
                  "pyramid" as EnemyType,
                ),
              },
            ]);
            soundManager.playExplosion();
            newBosses.splice(bossIdx, 1);

            if (newBosses.length === 1) {
              toast.error("FINAL PYRAMID ENRAGED!");
              newBosses[0] = {
                ...newBosses[0],
                isSuperAngry: true,
                speed: BOSS_CONFIG.pyramid.superAngryMoveSpeed,
              };
            }

            if (newBosses.length === 0) {
              setLives((l) => l + 1);
              toast.success("ALL PYRAMIDS DEFEATED! + BONUS LIFE!");
              setBossActive(false);
              setBossesKilled((k) => k + 1);
              setBossDefeatedTransitioning(true);
              setBossVictoryOverlayActive(true);
              setBalls([]);
              clearAllEnemies();
              setBossAttacks([]);
              clearAllBombs();
              world.bullets = [];
              bulletPool.releaseAll();

              if (isBossRush) {
                gameLoopRef.current?.pause();
                setBossRushTimeSnapshot(bossRushStartTime ? Date.now() - bossRushStartTime : 0);
                setBossRushStatsOverlayActive(true);
              } else {
                soundManager.stopBossMusic();
                soundManager.resumeBackgroundMusic();
                setTimeout(() => nextLevel(), 3000);
              }
            }
          } else {
            toast.info(`PYRAMID: ${newHealth} HP`);
            if (debugSettings.enableBossLogging) {
              console.log("[BossSweep] Resurrected boss damage applied! Boss health:", newHealth);
            }
            newBosses[bossIdx] = { ...newBosses[bossIdx], currentHealth: newHealth, lastHitAt: hit.nowMs };
          }

          return newBosses;
        });
      }
    }

    // ═══ Score and stats ═══
    if (result.scoreIncrease > 0) setScore((s) => s + result.scoreIncrease);
    if (result.bricksDestroyedCount > 0) {
      setTotalBricksDestroyed((t) => t + result.bricksDestroyedCount);
      setBricksHit((b) => b + result.bricksDestroyedCount);
    }

    // ═══ Power-up creation from destroyed bricks ═══
    if (result.powerUpBricks.length > 0) {
      const createdPowerUps: PowerUp[] = [];
      for (const brick of result.powerUpBricks) {
        bricksDestroyedThisLevelRef.current += 1;

        if (level === 1 && bricksDestroyedThisLevelRef.current === 3) {
          createdPowerUps.push({
            x: brick.x + brick.width / 2 - POWERUP_SIZE / 2,
            y: brick.y,
            width: POWERUP_SIZE,
            height: POWERUP_SIZE,
            type: "multiball",
            speed: POWERUP_FALL_SPEED * (gameLoopRef.current?.getTimeScale() ?? 1.0),
            active: true,
          });
        } else {
          const result = createPowerUp(brick, false, false, gameLoopRef.current?.getTimeScale() ?? 1.0);
          if (result) {
            if (Array.isArray(result)) {
              createdPowerUps.push(...result);
            } else {
              createdPowerUps.push(result);
            }
          }
        }
      }

      if (createdPowerUps.length > 0) {
        setPowerUps((prev) => [...prev, ...createdPowerUps]);

        if (tutorialEnabled && !powerUpTutorialTriggeredRef.current) {
          powerUpTutorialTriggeredRef.current = true;
          setTimeout(() => {
            const { shouldPause } = triggerTutorial("power_up_drop", level);
            if (shouldPause) {
              setGameState("paused");
              if (gameLoopRef.current) gameLoopRef.current.pause();
            }
          }, 1000);
        }

        const hasBossPowerUp = createdPowerUps.some((p) =>
          ["bossStunner", "reflectShield", "homingBall"].includes(p.type),
        );
        if (tutorialEnabled && hasBossPowerUp && !bossPowerUpTutorialTriggeredRef.current) {
          bossPowerUpTutorialTriggeredRef.current = true;
          const { shouldPause } = triggerTutorial("boss_power_up_drop", level);
          if (shouldPause) {
            setGameState("paused");
            if (gameLoopRef.current) gameLoopRef.current.pause();
          }
        }
      }
    }

    // ═══ Explosive brick visuals ═══
    for (const exp of result.explosiveBrickExplosions) {
      setExplosions((prev) => [
        ...prev,
        {
          x: exp.x,
          y: exp.y,
          frame: 0,
          maxFrames: 30,
          size: 140,
          particles: createExplosionParticles(exp.x, exp.y, "cube"),
        },
      ]);
    }

    // ═══ Win condition ═══
    if (result.allBricksCleared) {
      const bricks = world.bricks;
      const hasDestructible = bricks.some((b) => !b.isIndestructible);

      soundManager.playWin();
      if (level >= FINAL_LEVEL) {
        setScore((prev) => prev + 1000000);
        setBeatLevel50Completed(true);
        setGameState("won");
        setShowEndScreen(true);
        soundManager.stopBackgroundMusic();
        toast.success(`🎉 YOU WIN! Level ${level} Complete! Bonus: +1,000,000 points!`);
      } else {
        setGameState("ready");
        toast.success(`Level ${level} Complete! Click to continue.`);
      }

      // Mark all bricks invisible
      setBricks((prev) => prev.map((b) => ({ ...b, visible: false })));
    }

    // ═══ Enemy explosions ═══
    if (result.explosionsToCreate.length > 0) {
      for (const exp of result.explosionsToCreate) {
        setExplosions((prev) => [
          ...prev,
          {
            x: exp.x,
            y: exp.y,
            frame: 0,
            maxFrames: 20,
            enemyType: exp.type,
            particles: createExplosionParticles(exp.x, exp.y, exp.type),
          },
        ]);
        triggerHighlightFlash(1.0, 150);
      }
    }

    // ═══ Bonus letter drops ═══
    for (const drop of result.bonusLetterDrops) {
      dropBonusLetter(drop.x, drop.y);
    }

    // ═══ Large sphere power-up drops ═══
    for (const drop of result.largeSphereDrops) {
      const powerUpTypes: PowerUpType[] = ["multiball", "turrets", "fireball", "life", "slowdown", "shield"];
      const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
      const powerUp: PowerUp = {
        x: drop.x - POWERUP_SIZE / 2,
        y: drop.y,
        width: POWERUP_SIZE,
        height: POWERUP_SIZE,
        type: randomType,
        speed: POWERUP_FALL_SPEED * (gameLoopRef.current?.getTimeScale() ?? 1.0),
        active: true,
      };
      setPowerUps((prev) => [...prev, powerUp]);
    }

    // ═══ Bomb interval cleanup ═══
    for (const enemyId of result.bombIntervalsToClean) {
      const interval = bombIntervalsRef.current.get(enemyId);
      if (interval) {
        clearInterval(interval);
        bombIntervalsRef.current.delete(enemyId);
      }
    }

    // ═══ Enemy kill tracking + power-up drops ═══
    if (result.enemiesKilledIncrease > 0) {
      if (isBossRush) {
        setBossRushEnemiesThisBoss((prev) => prev + result.enemiesKilledIncrease);
        setBossRushTotalEnemiesKilled((prev) => prev + result.enemiesKilledIncrease);
      }

      setEnemiesKilled((prev) => {
        const newCount = prev + result.enemiesKilledIncrease;

        for (const { enemy } of result.destroyedEnemyData) {
          const isBossSpawned = bossSpawnedEnemiesRef.current.has(enemy.id || -1);
          const isBossLevel = [5, 10, 15, 20].includes(level);
          const isFirstBossMinion = isBossSpawned && isBossLevel && !firstBossMinionKilledRef.current;
          const shouldDrop = isFirstBossMinion || (isBossSpawned ? Math.random() < 0.5 : newCount % 3 === 0);

          if (shouldDrop) {
            const fakeBrick: Brick = {
              id: -1,
              x: enemy.x,
              y: enemy.y,
              width: enemy.width,
              height: enemy.height,
              visible: true,
              color: "",
              points: 0,
              hasPowerUp: true,
              hitsRemaining: 0,
              maxHits: 1,
              isIndestructible: false,
              type: "normal",
            };
            if (isFirstBossMinion) firstBossMinionKilledRef.current = true;

            let powerUp = createPowerUp(
              fakeBrick,
              isBossSpawned,
              isFirstBossMinion,
              gameLoopRef.current?.getTimeScale() ?? 1.0,
            );
            let attempts = 0;
            while (!powerUp && attempts < 10) {
              powerUp = createPowerUp(
                fakeBrick,
                isBossSpawned,
                isFirstBossMinion,
                gameLoopRef.current?.getTimeScale() ?? 1.0,
              );
              attempts++;
            }
            if (powerUp) {
              const singlePowerUp = Array.isArray(powerUp) ? powerUp[0] : powerUp;
              const allPowerUps = Array.isArray(powerUp) ? powerUp : [powerUp];
              setPowerUps((prev) => [...prev, ...allPowerUps]);
              const isBossPowerUpType = ["bossStunner", "reflectShield", "homingBall"].includes(singlePowerUp.type);
              if (tutorialEnabled && isBossPowerUpType && !bossPowerUpTutorialTriggeredRef.current) {
                bossPowerUpTutorialTriggeredRef.current = true;
                const { shouldPause } = triggerTutorial("boss_power_up_drop", level);
                if (shouldPause) {
                  setGameState("paused");
                  if (gameLoopRef.current) gameLoopRef.current.pause();
                }
              }
              if (isBossSpawned) {
                toast.success(
                  isFirstBossMinion
                    ? "First boss minion! Guaranteed boss power-up!"
                    : "Boss minion bonus! Power-up dropped!",
                );
              } else {
                toast.success("Enemy kill bonus! Power-up dropped!");
              }
            }
          }
        }

        return newCount;
      });
    }

    // ═══ Second Chance saves ═══
    for (const save of result.secondChanceSaves) {
      setPaddle((prev) => (prev ? { ...prev, hasSecondChance: false } : null));
      setSecondChanceImpact({ x: save.x, y: save.y, startTime: Date.now() });
      toast.success("Second Chance saved you!");
      setTimeout(() => setSecondChanceImpact(null), 500);
    }

    // ═══ All balls lost — life loss ═══
    if (result.allBallsLost) {
      if (isBossRush) {
        setBossRushLivesLostThisBoss((prev) => prev + 1);
        setBossRushTotalLivesLost((prev) => prev + 1);
      }

      // Reset hit streak on death
      setHitStreak(0);
      hitStreakRef.current = 0;
      setHitStreakActive(false);
      ballHitSinceLastPaddleRef.current.clear();
      world.backgroundHue = 0;

      setLives((prev) => {
        const newLives = prev - 1;
        soundManager.playLoseLife();
        if (newLives <= 0) {
          particlePool.acquireForGameOver(
            SCALED_CANVAS_WIDTH / 2,
            SCALED_CANVAS_HEIGHT / 2,
            100,
            gameLoopRef.current?.getTimeScale() ?? 1.0,
          );
          handleGameOver();
        } else {
          handleSurviveDeath(`Life lost! ${newLives} lives remaining. Here's some help!`, { spawnMercy: true });
        }
        return newLives;
      });
    }

    // Increment frame counter
    frameCountRef.current++;
  }, [
    createPowerUp,
    setPowerUps,
    nextLevel,
    level,
    SCALED_CANVAS_WIDTH,
    SCALED_CANVAS_HEIGHT,
    SCALED_BRICK_WIDTH,
    SCALED_BRICK_HEIGHT,
    SCALED_PADDLE_WIDTH,
    SCALED_BALL_RADIUS,
    scaleFactor,
    levelSkipped,
    score,
    qualitySettings,
    bombIntervalsRef,
    createExplosionParticles,
    debugSettings,
    isBossRush,
    bossFirstHitShieldDropped,
    bossRushStartTime,
    bossRushIndex,
    settings.difficulty,
    hitStreak,
    hitStreakActive,
  ]);

  // FPS tracking for adaptive quality
  const fpsTrackerRef = useRef({ lastTime: performance.now(), frameCount: 0, fps: FPS_CAP });
  const dtSecondsRef = useRef(FIXED_PHYSICS_TIMESTEP); // Delta time for current physics step (seconds)

  // Lag detection ref for tracking frame timing with GC detection
  const lagDetectionRef = useRef({
    lastFrameEnd: 0,
    lagCount: 0,
    lastLagLogTime: 0, // Throttle lag logging
    lastGCLogTime: 0, // Throttle GC detection logging
    lastMemoryCheck: 0, // GC detection timing
    lastUsedHeap: 0, // Track heap size for GC detection
    tabWasHidden: false, // Track if tab was backgrounded
  });

  // Tab visibility detection for explaining large frame gaps
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lagDetectionRef.current.tabWasHidden = true;
        debugLogger.log("[TAB] Browser tab hidden");
      } else {
        debugLogger.log("[TAB] Browser tab visible again");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const gameLoop = useCallback(() => {
    const paddle = world.paddle; // live read from engine state
    const balls = world.balls; // live read from engine state
    const bricks = world.bricks; // live read from engine state
    const speedMultiplier = world.speedMultiplier; // live read from engine state
    const launchAngle = world.launchAngle; // live read from engine state
    const backgroundPhase = world.backgroundPhase; // live read from engine state
    const enemies = world.enemies; // live read from engine state
    const bombs = world.bombs; // live read from engine state
    const bossAttacks = world.bossAttacks; // live read from engine state
    const boss = world.boss; // live read from engine state
    const resurrectedBosses = world.resurrectedBosses; // live read from engine state
    const explosions = world.explosions; // live read from engine state
    const bonusLetters = world.bonusLetters; // live read from engine state
    const dangerBalls = world.dangerBalls; // live read from engine state
    const screenShake = world.screenShake; // live read from engine state
    if (gameState !== "playing") return;
    if (bossDefeatedTransitioningRef.current) return;

    // Clear newly reflected bombs ref at start of each frame
    newlyReflectedBombIdsRef.current.clear();

    // ═══ MOBILE PERF: Cache performance.now() once per frame ═══
    const frameNow = performance.now();

    // ═══ MOBILE PERF: Single flag to gate all debug overhead ═══
    const shouldRunDebugCode =
      ENABLE_DEBUG_FEATURES &&
      (debugSettings.showFrameProfiler ||
        debugSettings.enableLagLogging ||
        debugSettings.enableGCLogging ||
        debugSettings.enableDetailedFrameLogging);
    const profilerEnabled = ENABLE_DEBUG_FEATURES && debugSettings.showFrameProfiler;

    // ═══ LAG DETECTION: Track frame-to-frame time with GC detection ═══
    const frameGap = lagDetectionRef.current.lastFrameEnd > 0 ? frameNow - lagDetectionRef.current.lastFrameEnd : 0;

    // Only run debug detection code if debug features are actually enabled
    if (shouldRunDebugCode) {
      // GC Detection: Check for significant heap drops (Chrome-only API)
      if (debugSettings.enableGCLogging && (performance as any).memory) {
        const currentHeap = (performance as any).memory.usedJSHeapSize;
        const heapDrop = lagDetectionRef.current.lastUsedHeap - currentHeap;

        // If heap dropped significantly (>3MB), likely GC occurred
        // Throttle GC logging to max once per second to reduce debug overhead
        const GC_LOG_THROTTLE_MS = 1000;
        if (lagDetectionRef.current.lastUsedHeap > 0 && heapDrop > 3_000_000) {
          if (
            !lagDetectionRef.current.lastGCLogTime ||
            frameNow - lagDetectionRef.current.lastGCLogTime > GC_LOG_THROTTLE_MS
          ) {
            // Use lightweight logging - no object creation for lag events
            debugLogger.addLogLite(
              "warn",
              `[DEBUG] [GC DETECTED] Heap dropped by ${(heapDrop / 1_000_000).toFixed(2)}MB, heap: ${(currentHeap / 1_000_000).toFixed(1)}MB, gap: ${frameGap.toFixed(1)}ms`,
            );
            lagDetectionRef.current.lastGCLogTime = frameNow;
          }
        }
        lagDetectionRef.current.lastUsedHeap = currentHeap;
      }

      // Log if frame gap exceeds 50ms (indicates lag between frames) - throttled to 1/sec
      if (frameGap > 50 && debugSettings.enableLagLogging) {
        lagDetectionRef.current.lagCount++;

        // Only log once per second max to avoid spam
        if (frameNow - lagDetectionRef.current.lastLagLogTime > 1000) {
          // Check if this was due to tab being backgrounded
          if (lagDetectionRef.current.tabWasHidden && frameGap > 500) {
            debugLogger.addLogLite(
              "log",
              `[DEBUG] [TAB RESUME] Resumed after ${frameGap.toFixed(0)}ms (tab was backgrounded)`,
            );
            lagDetectionRef.current.tabWasHidden = false;
          } else {
            // Use lightweight logging - skip object serialization entirely
            debugLogger.addLogLite(
              "error",
              `[DEBUG] [LAG DETECTED] Frame gap: ${frameGap.toFixed(1)}ms, balls: ${balls.length}, enemies: ${enemies.length}, quality: ${quality || "unknown"}`,
            );
          }
          lagDetectionRef.current.lastLagLogTime = frameNow;
        }
      }
    }

    // ═══ PHASE 1: Frame Profiler Start (only if explicitly enabled) ═══
    if (profilerEnabled) frameProfiler.startFrame();

    // ═══ Physics dt is set by UnifiedGameLoop.onPhysicsStep before calling gameLoop ═══
    // dtSecondsRef.current = FIXED_PHYSICS_TIMESTEP (always 1/60 second)

    // ========== Performance Profiling (Debug) — fires once per second ==========
    if (ENABLE_DEBUG_FEATURES && debugSettings.enableDetailedFrameLogging) {
      const debugNow = frameNow; // already computed above
      const debugDelta = debugNow - fpsTrackerRef.current.lastTime;
      if (debugDelta >= 1000) {
        const fps = fpsTrackerRef.current.fps; // set by onRender callback
        // Count total particles (from particle pool only - special particles now use pool)
        const totalParticles = particlePool.getStats().active;

        // Record frame metrics
        performanceProfiler.recordFrame({
          timestamp: performance.now(),
          fps: fps,
          frameNumber: frameCountRef.current,

          // Object counts
          ballCount: balls.length,
          visibleBrickCount: bricks.reduce((c, b) => c + (b.visible ? 1 : 0), 0),
          totalBrickCount: bricks.length,
          enemyCount: enemies.length,
          powerUpCount: powerUps.length,
          bulletCount: world.bullets.length,
          explosionCount: explosions.length,
          totalParticleCount: totalParticles,
          bossAttackCount: bossAttacks.length,
          laserWarningCount: laserWarnings.length,
          bombCount: bombs.length,
          shieldImpactCount: shieldImpacts.length,
          bonusLetterCount: bonusLetters.length,

          // CCD performance
          ccdTotalMs: (ccdPerformanceRef.current?.totalUs || 0) / 1000, // Convert μs to ms
          ccdSubsteps: ccdPerformanceRef.current?.substepsUsed || 0,
          ccdCollisions: ccdPerformanceRef.current?.collisionCount || 0,
          ccdToiIterations: ccdPerformanceRef.current?.toiIterationsUsed || 0,

          // Rendering complexity
          qualityLevel: quality,
          hasActiveBoss: boss !== null || resurrectedBosses.length > 0,
          hasScreenShake: screenShake > 0,
          hasBackgroundFlash: backgroundFlash > 0,
        });

        // Check for performance issues and log if detected
        if (performanceProfiler.detectPerformanceIssue()) {
          performanceProfiler.logDetailedMetrics();
        }
      }
    }

    // ═══ PHASE 1: Time Rendering ═══
    if (profilerEnabled) frameProfiler.startTiming("rendering");

    // Background animation is driven by `now` in canvasRenderer — no state update needed

    if (profilerEnabled) frameProfiler.endTiming("rendering");

    // Update balls rotation only (position is updated in checkCollision with substeps)
    // OPTIMIZED: Direct world mutation — no React state updater, no stale-closure risk
    for (const ball of world.balls) {
      if (ball.waitingToLaunch && paddle) {
        // Keep ball attached to paddle
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - ball.radius - 5;
      }
      ball.rotation = ((ball.rotation || 0) + 180 * dtSecondsRef.current) % 360; // 180 deg/s = 3 deg/frame at 60fps
    }

    // Update bonus letters - OPTIMIZED: In-place mutation with sine wave motion
    const currentTime = Date.now();
    // Direct world mutation — no React state updater, no stale-closure risk
    for (const letter of world.bonusLetters) {
      // Fall down
      letter.y += letter.speed * dtSecondsRef.current * 60; // scale by normalized dt
      // Sine wave horizontal motion: amplitude 30, period 4 seconds
      const elapsed = currentTime - letter.spawnTime;
      const sinePhase = (elapsed / 4000) * 2 * Math.PI;
      letter.x = letter.originX + 30 * Math.sin(sinePhase);
    }

    // Check bonus letter collisions
    checkBonusLetterCollision();

    // Update enemies
    if (profilerEnabled) frameProfiler.startTiming("enemies");
    // Check if stun is active (applies to all enemies)
    const isStunActive = bossStunnerEndTime !== null && Date.now() < bossStunnerEndTime;

    // Update enemies - OPTIMIZED: Direct world mutation (skip if stunned)
    if (!isStunActive) {
      const dtNorm = dtSecondsRef.current * 60; // normalized delta: 1.0 at 60fps
      for (const enemy of world.enemies) {
        let newX = enemy.x + enemy.dx * dtNorm;
        let newY = enemy.y + enemy.dy * dtNorm;

        // Sphere, Pyramid, and CrossBall enemies have more random movement
        if (enemy.type === "sphere" || enemy.type === "pyramid" || enemy.type === "crossBall") {
          const randomChance = enemy.type === "pyramid" ? 0.08 : enemy.type === "crossBall" ? 0.06 : 0.05;
          if (Math.random() < randomChance) {
            const randomAngle = ((Math.random() - 0.5) * Math.PI) / 4;
            const currentAngle = Math.atan2(enemy.dy, enemy.dx);
            const newAngle = currentAngle + randomAngle;
            enemy.dx = Math.cos(newAngle) * enemy.speed;
            enemy.dy = Math.sin(newAngle) * enemy.speed;
          }
        }

        // Bounce off walls
        if (newX <= 0 || newX >= SCALED_CANVAS_WIDTH - enemy.width) {
          enemy.dx = -enemy.dx;
          newX = Math.max(0, Math.min(SCALED_CANVAS_WIDTH - enemy.width, newX));
        }

        // Bounce off top and 60% boundary
        const maxY = SCALED_CANVAS_HEIGHT * 0.6;
        if (newY <= 0 || newY >= maxY - enemy.height) {
          enemy.dy = -enemy.dy;
          newY = Math.max(0, Math.min(maxY - enemy.height, newY));
        }

        // Update in place
        enemy.x = newX;
        enemy.y = newY;
        enemy.rotationX +=
          (enemy.type === "pyramid" ? 0.06 : enemy.type === "sphere" || enemy.type === "crossBall" ? 0.08 : 0.05) *
          dtNorm;
        enemy.rotationY +=
          (enemy.type === "pyramid" ? 0.09 : enemy.type === "sphere" || enemy.type === "crossBall" ? 0.12 : 0.08) *
          dtNorm;
        enemy.rotationZ +=
          (enemy.type === "pyramid" ? 0.04 : enemy.type === "sphere" || enemy.type === "crossBall" ? 0.06 : 0.03) *
          dtNorm;
      }
    }
    if (profilerEnabled) frameProfiler.endTiming("enemies");

    // Update explosions and their particles - OPTIMIZED: Use particle pool
    if (profilerEnabled) frameProfiler.startTiming("particles");
    if (debugSettings.enableExplosions && debugSettings.enableParticles) {
      // Skip particle updates on alternate frames when quality is low
      const currentFrameTick = gameLoopRef.current?.getFrameTick() || 0;
      const shouldUpdateParticles = qualitySettings.level !== "low" || currentFrameTick % 2 === 0;

      if (shouldUpdateParticles) {
        // Update pooled particles in place (no new objects created)
        particlePool.updateParticles(dtSecondsRef.current);

        // Update explosion frames in-place via pool (no array spread/splice)
        const activeExplosions = explosionPool.getActive();
        for (let i = activeExplosions.length - 1; i >= 0; i--) {
          activeExplosions[i].frame += dtSecondsRef.current * 60; // scale by normalized dt
          if (activeExplosions[i].frame >= activeExplosions[i].maxFrames) {
            explosionPool.release(activeExplosions[i]);
          }
        }
        world.explosions = explosionPool.getActive();
      }
    } else {
      explosionPool.releaseAll();
      world.explosions = explosionPool.getActive();
      particlePool.releaseAll();
    }

    // Particles are now entirely in the pool - no separate state updates needed
    // The pool's updateParticles handles gameOver and highScore particles automatically
    if (profilerEnabled) frameProfiler.endTiming("particles");

    // Count particles for profiler - use pool stats only (skip if profiler disabled)
    if (profilerEnabled) {
      const poolStats = particlePool.getStats();
      frameProfiler.incrementCounter("particles", poolStats.active);
    }

    // Ball repels nearby enemy shots (1-5% based on proximity to paddle)
    // This creates a safety buffer to prevent impossible death situations
    if (paddle && balls.length > 0) {
      setBombs((prevBombs) => {
        let modified = false;
        for (const bomb of prevBombs) {
          // Skip reflected bombs (they're friendly)
          if (bomb.isReflected) continue;

          // Check each active ball
          for (const ball of balls) {
            if (ball.waitingToLaunch) continue;

            const ballCenterX = ball.x;
            const ballCenterY = ball.y;
            const bombCenterX = bomb.x + bomb.width / 2;
            const bombCenterY = bomb.y + bomb.height / 2;

            // Calculate distance between ball and bomb
            const dx = bombCenterX - ballCenterX;
            const dy = bombCenterY - ballCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Repel range: ~40 pixels from ball center
            const repelRange = ball.radius + 40;

            if (distance < repelRange && distance > 0) {
              // Calculate repel strength based on ball's proximity to paddle
              // Higher = closer to paddle = more repel (1% at top, 5% near paddle)
              const paddleY = paddle.y;
              const topOfScreen = 0;
              const proximityRatio = Math.max(0, Math.min(1, (ball.y - topOfScreen) / (paddleY - topOfScreen)));

              // Repel strength: 1% at top of screen, 5% near paddle
              const repelStrength = 0.01 + proximityRatio * 0.04;

              // Normalize direction and apply repel force
              const normalizedDx = dx / distance;
              const normalizedDy = dy / distance;

              // Apply repel - push bomb away from ball
              bomb.x += normalizedDx * repelStrength * bomb.speed * 10;
              bomb.y += normalizedDy * repelStrength * bomb.speed * 10;
              modified = true;
            }
          }
        }
        return modified ? [...prevBombs] : prevBombs;
      });
    }

    // Update bombs and rockets - OPTIMIZED: In-place mutation with backwards iteration
    // Define paddle danger zone for stun freezing
    const bombPaddleDangerZoneY = paddle ? paddle.y - 100 : SCALED_CANVAS_HEIGHT - 100;
    const dtNormBombs = dtSecondsRef.current * 60; // normalized delta: 1.0 at 60fps

    // Update bombs and rockets - OPTIMIZED: Direct world mutation, backwards iteration for splice safety
    for (let i = world.bombs.length - 1; i >= 0; i--) {
      const bomb = world.bombs[i];

      // Check if bomb should be frozen during stun (except near paddle)
      const bombInDangerZone = bomb.y >= bombPaddleDangerZoneY;
      const shouldFreezeBomb = isStunActive && !bomb.isReflected && !bombInDangerZone;

      if (shouldFreezeBomb) {
        // Skip movement update but keep bomb
        continue;
      }

      // Check if should be removed first
      let shouldRemove = false;
      if (bomb.isReflected) {
        shouldRemove = bomb.y <= 0 || bomb.y >= SCALED_CANVAS_HEIGHT || bomb.x <= 0 || bomb.x >= SCALED_CANVAS_WIDTH;
        if (shouldRemove && ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
          console.log(
            `[Collision Debug] REFLECTED BOMB#${bomb.id} filtered OFF-SCREEN at (${bomb.x.toFixed(1)}, ${bomb.y.toFixed(1)})`,
          );
        }
      } else {
        shouldRemove = bomb.y >= SCALED_CANVAS_HEIGHT;
      }

      if (shouldRemove) {
        bombPool.release(bomb);
        world.bombs.splice(i, 1);
        continue;
      }

      // Apply homing behavior to reflected bombs
      if (bomb.isReflected) {
        // Find closest target (boss or enemy)
        let closestTarget: { x: number; y: number; width: number; height: number } | null = null;
        let closestDist = Infinity;

        const bombCenterX = bomb.x + bomb.width / 2;
        const bombCenterY = bomb.y + bomb.height / 2;

        // Check main boss
        if (boss) {
          const bossCenterX = boss.x + boss.width / 2;
          const bossCenterY = boss.y + boss.height / 2;
          const dist = Math.sqrt(Math.pow(bossCenterX - bombCenterX, 2) + Math.pow(bossCenterY - bombCenterY, 2));
          if (dist < closestDist) {
            closestDist = dist;
            closestTarget = boss;
          }
        }

        // Check resurrected bosses
        for (const rb of resurrectedBosses) {
          const rbCenterX = rb.x + rb.width / 2;
          const rbCenterY = rb.y + rb.height / 2;
          const dist = Math.sqrt(Math.pow(rbCenterX - bombCenterX, 2) + Math.pow(rbCenterY - bombCenterY, 2));
          if (dist < closestDist) {
            closestDist = dist;
            closestTarget = rb;
          }
        }

        // Check enemies
        for (const enemy of enemies) {
          const enemyCenterX = enemy.x + enemy.width / 2;
          const enemyCenterY = enemy.y + enemy.height / 2;
          const dist = Math.sqrt(Math.pow(enemyCenterX - bombCenterX, 2) + Math.pow(enemyCenterY - bombCenterY, 2));
          if (dist < closestDist) {
            closestDist = dist;
            closestTarget = enemy;
          }
        }

        // Steer toward closest target
        if (closestTarget) {
          const targetCenterX = closestTarget.x + closestTarget.width / 2;
          const targetCenterY = closestTarget.y + closestTarget.height / 2;

          const dirX = targetCenterX - bombCenterX;
          const dirY = targetCenterY - bombCenterY;
          const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);

          if (dirLength > 0) {
            const normDirX = dirX / dirLength;
            const normDirY = dirY / dirLength;
            const steeringStrength = 0.15;
            const currentSpeed = Math.sqrt((bomb.dx || 0) ** 2 + (bomb.dy || 0) ** 2);

            const newDx = (bomb.dx || 0) * (1 - steeringStrength) + normDirX * currentSpeed * steeringStrength;
            const newDy = (bomb.dy || 0) * (1 - steeringStrength) + normDirY * currentSpeed * steeringStrength;

            const newSpeed = Math.sqrt(newDx * newDx + newDy * newDy);
            bomb.dx = newSpeed > 0 ? (newDx / newSpeed) * currentSpeed : newDx;
            bomb.dy = newSpeed > 0 ? (newDy / newSpeed) * currentSpeed : newDy;
            bomb.x += bomb.dx * dtNormBombs;
            bomb.y += bomb.dy * dtNormBombs;
            continue;
          }
        }
        bomb.x += (bomb.dx || 0) * dtNormBombs;
        bomb.y += (bomb.dy || 0) * dtNormBombs;
      } else if (bomb.type === "pyramidBullet" && bomb.dx !== undefined) {
        bomb.x += (bomb.dx || 0) * dtNormBombs;
        bomb.y += bomb.speed * dtNormBombs;
      } else {
        bomb.y += bomb.speed * dtNormBombs;
      }
    }

    // Check bomb-paddle collision
    if (paddle) {
      bombs.forEach((bomb) => {
        const bombHitsShieldZone =
          bomb.x + bomb.width > paddle.x &&
          bomb.x < paddle.x + paddle.width &&
          bomb.y + bomb.height > paddle.y - 10 &&
          bomb.y < paddle.y + paddle.height;

        // Check for reflect shield FIRST (on boss levels) - preserves regular shield
        if (paddle.hasReflectShield && BOSS_LEVELS.includes(level) && bombHitsShieldZone) {
          // Reflect the bomb back, DON'T consume regular shield
          if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
            const ts = performance.now().toFixed(2);
            console.log(
              `[${ts}ms] [Collision Debug] REFLECT SHIELD (bomb) - ` +
                `Bomb#${bomb.id} reflected at paddle | ` +
                `pos=(${bomb.x.toFixed(1)},${bomb.y.toFixed(1)}) speed=${bomb.speed.toFixed(2)}`,
            );
          }

          // Add to synchronous ref for immediate collision detection
          newlyReflectedBombIdsRef.current.add(bomb.id);

          setBombs((prev) =>
            prev.map((b) =>
              b.id === bomb.id
                ? {
                    ...b,
                    isReflected: true,
                    dy: -b.speed,
                    dx: 0,
                  }
                : b,
            ),
          );
          soundManager.playReflectedAttackSound();
          toast.success("Reflect shield reflected the shot!");
          return;
        }

        // Only check regular shield if reflect shield is NOT active
        if (paddle.hasShield && !paddle.hasReflectShield && bombHitsShieldZone) {
          // Bomb hit shield - destroy both
          soundManager.playBounce();

          // Add shield impact effect at bomb position
          setShieldImpacts((prev) => [
            ...prev,
            {
              x: bomb.x + bomb.width / 2,
              y: bomb.y + bomb.height / 2,
              startTime: Date.now(),
              duration: 600,
            },
          ]);

          bombPool.release(bomb);
          setBombs((prev) => prev.filter((b) => b.enemyId !== bomb.enemyId));
          setPaddle((prev) =>
            prev
              ? {
                  ...prev,
                  hasShield: false,
                }
              : null,
          );
          toast.success("Shield absorbed the hit!");
          return;
        }
        if (
          bomb.x + bomb.width > paddle.x &&
          bomb.x < paddle.x + paddle.width &&
          bomb.y + bomb.height > paddle.y &&
          bomb.y < paddle.y + paddle.height
        ) {
          // Bomb hits paddle - lose a life (reflect shield already checked above)
          soundManager.playLoseLife();
          bombPool.release(bomb);
          setBombs((prev) => prev.filter((b) => b.enemyId !== bomb.enemyId));
          setLives((prev) => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              handleGameOver();
            } else {
              handleSurviveDeath(`Bomb hit! ${newLives} lives remaining. Click to continue.`);
            }
            return newLives;
          });
        }
      });
    }

    // Check bounced bullet-paddle collision
    if (paddle) {
      world.bullets.forEach((bullet) => {
        if (!bullet.isBounced) return;

        // Expand collision zone to account for fast paddle movement
        // This prevents bullets from "tunneling" through the shield when paddle moves quickly
        const shieldExpansion = paddle.hasShield || paddle.hasReflectShield ? 20 : 0;

        const bulletHitsPaddle =
          bullet.x + bullet.width > paddle.x - shieldExpansion &&
          bullet.x < paddle.x + paddle.width + shieldExpansion &&
          bullet.y + bullet.height > paddle.y - shieldExpansion &&
          bullet.y < paddle.y + paddle.height;

        // Check for reflect shield FIRST (on boss levels) - preserves regular shield
        if (paddle.hasReflectShield && BOSS_LEVELS.includes(level) && bulletHitsPaddle) {
          // Reflect the bullet back, DON'T consume regular shield
          if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
            const ts = performance.now().toFixed(2);
            console.log(
              `[${ts}ms] [Collision Debug] REFLECT SHIELD (bullet) - ` +
                `Bullet reflected at paddle | ` +
                `pos=(${bullet.x.toFixed(1)},${bullet.y.toFixed(1)}) speed=${bullet.speed.toFixed(2)}`,
            );
          }

          // Direct in-place mutation on world.bullets — no React state
          bullet.isBounced = false;
          soundManager.playReflectedAttackSound();
          toast.success("Reflect shield reflected the bullet!");
          return;
        }

        // Only check regular shield if reflect shield is NOT active
        if (paddle.hasShield && !paddle.hasReflectShield && bulletHitsPaddle) {
          // Bullet hit shield - destroy both
          soundManager.playBounce();

          // Add shield impact effect at bullet position
          setShieldImpacts((prev) => [
            ...prev,
            {
              x: bullet.x + bullet.width / 2,
              y: bullet.y + bullet.height / 2,
              startTime: Date.now(),
              duration: 600,
            },
          ]);

          // Remove from world.bullets directly
          const idx = world.bullets.indexOf(bullet);
          if (idx !== -1) {
            world.bullets.splice(idx, 1);
            bulletPool.release(bullet as typeof bullet & { id: number });
          }
          setPaddle((prev) =>
            prev
              ? {
                  ...prev,
                  hasShield: false,
                }
              : null,
          );
          toast.success("Shield absorbed the hit!");
          return;
        }

        // No shield - check if bullet hits paddle (damage case)
        const bulletHitsPaddleNoShield =
          bullet.x + bullet.width > paddle.x &&
          bullet.x < paddle.x + paddle.width &&
          bullet.y + bullet.height > paddle.y &&
          bullet.y < paddle.y + paddle.height;

        if (bulletHitsPaddleNoShield) {
          // Bounced bullet hit paddle - lose a life
          soundManager.playLoseLife();
          // Remove from world.bullets directly
          const idx = world.bullets.indexOf(bullet);
          if (idx !== -1) {
            world.bullets.splice(idx, 1);
            bulletPool.release(bullet as typeof bullet & { id: number });
          }
          setLives((prev) => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              handleGameOver();
            } else {
              handleSurviveDeath(`Bullet hit! ${newLives} lives remaining. Click to continue.`);
            }
            return newLives;
          });
        }
      });
    }

    // Update boss movement and attacks
    if (boss && !boss.isStunned && boss.phase === "moving") {
      const dx = boss.targetPosition.x - boss.x;
      const dy = boss.targetPosition.y - boss.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        setBoss((prev) =>
          prev
            ? {
                ...prev,
                phase: "attacking",
                x: boss.targetPosition.x,
                y: boss.targetPosition.y,
                dx: 0,
                dy: 0,
                lastAttackTime: world.simTimeMs,
              }
            : null,
        );
      } else {
        const isMegaType = boss.type === "mega";
        const baseMoveSpeed = isMegaType
          ? boss.isSuperAngry
            ? MEGA_BOSS_CONFIG.veryAngryMoveSpeed
            : boss.isAngry
              ? MEGA_BOSS_CONFIG.angryMoveSpeed
              : MEGA_BOSS_CONFIG.moveSpeed
          : (() => {
              const config = BOSS_CONFIG[boss.type as "cube" | "sphere" | "pyramid"];
              return boss.isSuperAngry && "superAngryMoveSpeed" in config
                ? config.superAngryMoveSpeed
                : boss.isAngry && "angryMoveSpeed" in config
                  ? config.angryMoveSpeed
                  : boss.speed;
            })();
        // Dynamic speed variation for mega boss
        const moveSpeed = isMegaType
          ? baseMoveSpeed * (1.0 + Math.sin(Date.now() / 800) * 0.35 + Math.sin(Date.now() / 1300) * 0.2)
          : baseMoveSpeed;
        setBoss((prev) =>
          prev
            ? {
                ...prev,
                x: prev.x + (dx / distance) * moveSpeed * dtSecondsRef.current * 60,
                y: prev.y + (dy / distance) * moveSpeed * dtSecondsRef.current * 60,
                rotationX: prev.rotationX + 0.05 * dtSecondsRef.current * 60,
                rotationY: prev.rotationY + 0.08 * dtSecondsRef.current * 60,
                rotationZ: prev.rotationZ + 0.03 * dtSecondsRef.current * 60,
              }
            : null,
        );
      }
    }

    // Cube boss idle spin animation when in attacking phase (stationary)
    // Cube boss idle spin animation when in attacking phase (stationary)
    if (boss && boss.type === "cube" && boss.phase === "attacking" && !boss.isStunned) {
      setBoss((prev) =>
        prev
          ? {
              ...prev,
              rotationX: prev.rotationX + 0.008 * dtSecondsRef.current * 60, // Much slower than movement spin
              rotationY: prev.rotationY + 0.012 * dtSecondsRef.current * 60, // Primary visible rotation
              rotationZ: prev.rotationZ + 0.005 * dtSecondsRef.current * 60,
            }
          : null,
      );
    }

    // Pyramid boss idle spin animation when in attacking phase (stationary)
    if (boss && boss.type === "pyramid" && boss.phase === "attacking" && !boss.isStunned) {
      setBoss((prev) =>
        prev
          ? {
              ...prev,
              rotationX: prev.rotationX + 0.013 * dtSecondsRef.current * 60, // Slower than movement (0.08)
              rotationY: prev.rotationY + 0.02 * dtSecondsRef.current * 60, // Slower than movement (0.12)
            }
          : null,
      );
    }

    // Mega Boss idle spin animation when in attacking phase (stationary)
    // Disabled when ball is captured in core OR core is exposed (catch ball phase)
    if (level === MEGA_BOSS_LEVEL && boss && isMegaBoss(boss) && boss.phase === "attacking" && !boss.isStunned) {
      const megaBoss = boss as MegaBoss;
      const shouldRotate = !megaBoss.trappedBall && !megaBoss.coreExposed;

      if (shouldRotate) {
        setBoss((prev) => {
          if (!prev || !isMegaBoss(prev)) return prev;
          return {
            ...prev,
            rotationY: prev.rotationY + 0.01 * dtSecondsRef.current * 60, // Slow constant rotation for the hexagon
          } as MegaBoss;
        });
      }
    }

    // Check if boss stun has expired
    if (boss?.isStunned && Date.now() >= (boss.stunnedUntil || 0)) {
      setBoss((prev) => (prev ? { ...prev, isStunned: false, stunnedUntil: undefined } : null));
      toast.info("Boss recovered from stun!");
    }

    // Boss attack logic - different for Mega Boss (Level 20) vs regular bosses
    if (
      boss &&
      !boss.isStunned &&
      boss.phase === "attacking" &&
      world.simTimeMs - boss.lastAttackTime >= boss.attackCooldown &&
      paddle
    ) {
      if (level === MEGA_BOSS_LEVEL && isMegaBoss(boss)) {
        // Mega Boss uses specialized attack patterns
        const megaBoss = boss as MegaBoss;
        performMegaBossAttack(
          megaBoss,
          paddle.x + paddle.width / 2,
          paddle.y,
          setBossAttacks,
          setLaserWarnings,
          setSuperWarnings,
        );
      } else {
        // Regular boss attack
        performBossAttack(
          boss,
          paddle.x + paddle.width / 2,
          paddle.y,
          setBossAttacks,
          setLaserWarnings,
          setSuperWarnings,
        );
      }
      const nextIndex = (boss.currentPositionIndex + 1) % boss.positions.length;
      setBoss((prev) =>
        prev
          ? {
              ...prev,
              phase: "moving",
              targetPosition: prev.positions[nextIndex],
              currentPositionIndex: nextIndex,
              lastAttackTime: world.simTimeMs,
            }
          : null,
      );
    }

    // ═══ MEGA BOSS (Level 20) SPECIFIC GAME LOOP LOGIC ═══
    if (level === MEGA_BOSS_LEVEL && boss && isMegaBoss(boss) && paddle) {
      const megaBoss = boss as MegaBoss;
      const now = Date.now();

      // Check if player ball enters exposed core
      if (megaBoss.coreExposed && !megaBoss.trappedBall) {
        balls.forEach((ball) => {
          if (!ball.waitingToLaunch && isBallInHatchArea(ball, megaBoss)) {
            // Mark trap time immediately so the life-loss pass can't incorrectly deduct a life
            // if state updates land on the next tick.
            megaBossTrapJustHappenedRef.current = Date.now();

            // Trap the ball in the core!
            const trappedBoss = handleMegaBossCoreHit(megaBoss, ball);
            setBoss(trappedBoss as unknown as Boss);

            // Hide the trapped ball
            setBalls((prev) => prev.filter((b) => b.id !== ball.id));

            toast.error("🔴 BALL TRAPPED IN CORE! Catch 5 danger balls!", { duration: 3000 });
            soundManager.playCannonModeSound();

            // Initialize first cannon missile time (4-7 seconds from now)
            setNextCannonMissileTime(Date.now() + 4000 + Math.random() * 3000);
          }
        });
      }

      // Handle danger ball spawning from trapped ball sequence
      if (megaBoss.trappedBall && megaBoss.scheduledDangerBalls.length > 0) {
        const nextSpawnTime = megaBoss.scheduledDangerBalls[0];
        if (now >= nextSpawnTime) {
          console.log(`[MEGA BOSS DEBUG] Spawning danger ball ${megaBoss.dangerBallsFired + 1}/5`);

          // Spawn a danger ball
          const newDangerBall = spawnDangerBall(megaBoss);
          setDangerBalls((prev) => [...prev, newDangerBall]);

          // Remove from schedule
          setBoss((prev) => {
            if (!prev || !isMegaBoss(prev)) return prev;
            const mb = prev as MegaBoss;
            return {
              ...mb,
              scheduledDangerBalls: mb.scheduledDangerBalls.slice(1),
              dangerBallsFired: mb.dangerBallsFired + 1,
            } as unknown as Boss;
          });

          toast.warning(`⚡ DANGER BALL ${megaBoss.dangerBallsFired + 1}/5!`, { duration: 1500 });
          soundManager.playDangerBallSpawn();
        }
      }

      // ═══ CANNON MISSILE ATTACK (every 4-7 seconds when cannon is visible) ═══
      if (megaBoss.cannonExtended && megaBoss.trappedBall && paddle) {
        if (now >= nextCannonMissileTime) {
          // Fire a fast missile toward the paddle
          const cannonX = megaBoss.x + megaBoss.width / 2;
          const cannonY = megaBoss.y + megaBoss.height / 2 + 60; // Cannon muzzle position
          const paddleCenterX = paddle.x + paddle.width / 2;
          const paddleCenterY = paddle.y;

          const angle = Math.atan2(paddleCenterY - cannonY, paddleCenterX - cannonX);
          const missileSpeed = 8; // Fast missile

          const missile: BossAttack = {
            bossId: megaBoss.id,
            type: "rocket",
            x: cannonX,
            y: cannonY,
            width: 10,
            height: 18,
            speed: missileSpeed,
            angle,
            dx: Math.cos(angle) * missileSpeed,
            dy: Math.sin(angle) * missileSpeed,
            damage: 1,
          };

          setBossAttacks((prev) => [...prev, missile]);
          soundManager.playShoot();

          // Schedule next missile in 4-7 seconds
          const nextDelay = 4000 + Math.random() * 3000;
          setNextCannonMissileTime(now + nextDelay);
        }
      }

      // Check if all danger balls caught - release ball and transition phase
      if (shouldReleaseBall(megaBoss)) {
        const { boss: updatedBoss, releasedBall, isDefeated } = releaseBallAndNextPhase(megaBoss);

        if (isDefeated) {
          // MEGA BOSS DEFEATED! Victory with confetti!
          soundManager.playMegaBossVictorySound();
          setScore((s) => s + MEGA_BOSS_CONFIG.points);
          if (settings.difficulty !== "godlike") {
            setLives((prev) => prev + 1); // Bonus life for defeating Mega Boss
          }
          toast.success(
            settings.difficulty === "godlike"
              ? `🎉 MEGA BOSS DEFEATED! +${MEGA_BOSS_CONFIG.points} points!`
              : `🎉 MEGA BOSS DEFEATED! +${MEGA_BOSS_CONFIG.points} points + BONUS LIFE!`,
            { duration: 5000 },
          );

          // Multiple explosion waves for dramatic effect
          const bossCenter = { x: megaBoss.x + megaBoss.width / 2, y: megaBoss.y + megaBoss.height / 2 };
          [0, 150, 300, 500].forEach((delay, i) => {
            setTimeout(() => {
              setExplosions((e) => [
                ...e,
                {
                  x: bossCenter.x + (Math.random() - 0.5) * 80,
                  y: bossCenter.y + (Math.random() - 0.5) * 80,
                  frame: 0,
                  maxFrames: 50,
                  enemyType: "cube" as EnemyType,
                  particles: createExplosionParticles(
                    bossCenter.x + (Math.random() - 0.5) * 80,
                    bossCenter.y + (Math.random() - 0.5) * 80,
                    "cube" as EnemyType,
                  ),
                },
              ]);
            }, delay);
          });

          // Create victory confetti particles using pool
          const particleCount = Math.round(150 * (qualitySettings.explosionParticles / 50));
          particlePool.acquireForHighScore(
            bossCenter.x,
            bossCenter.y,
            particleCount,
            gameLoopRef.current?.getTimeScale() ?? 1.0,
          );
          // particleRenderTick removed — pool renders directly

          setBossesKilled((k) => k + 1);
          setBossActive(false);
          setBoss(null);
          setDangerBalls([]);
          setBossAttacks([]);
          clearAllEnemies();
          clearAllBombs();
          world.bullets = [];
          bulletPool.releaseAll();

          // Do NOT release the ball after phase 3 victory - keep it trapped
          // Ball stays "consumed" for clean transition to victory screen
          setBalls([]);

          soundManager.stopBossMusic();

          // Show victory screen - check for high score first!
          setTimeout(() => {
            setGameState("won");
            // Check for high score qualification on victory too
            getQualifiedLeaderboards(scoreRef.current).then((qualification) => {
              if (qualification.daily || qualification.weekly || qualification.allTime) {
                setQualifiedLeaderboards(qualification);
                setShowHighScoreEntry(true);
                soundManager.playHighScoreMusic();
              } else {
                setShowEndScreen(true);
                soundManager.playHighScoreMusic();
              }
            });
          }, 2500);
        } else {
          // Phase transition - not defeated yet
          soundManager.playPhaseCompleteJingle();
          toast.success(`✨ PHASE ${megaBoss.corePhase} COMPLETE! Boss entering phase ${megaBoss.corePhase + 1}!`, {
            duration: 3000,
          });

          // CRT scanline flash effect for phase transition
          triggerScreenShake(8, 500);
          setBackgroundFlash(2);
          setTimeout(() => setBackgroundFlash(0), 400);

          setBoss(updatedBoss as unknown as Boss);
          if (releasedBall) {
            // Release ball at normal speed (no slow motion)
            setBalls([releasedBall]);

            // Start ball release highlight (visual only)
            setBallReleaseHighlight({ active: true, startTime: Date.now() });

            // End highlight after 1.5 seconds
            setTimeout(() => {
              setBallReleaseHighlight(null);
            }, 1500);
          }

          const phaseNum = (updatedBoss as MegaBoss).corePhase;
          if (phaseNum === 2) {
            toast.error("🔥 PHASE 2: MEGA BOSS ANGRY!", { duration: 3000 });
          } else if (phaseNum === 3) {
            toast.error("💀 PHASE 3: MEGA BOSS VERY ANGRY! Swarm incoming!", { duration: 3000 });
          }
          soundManager.playExplosion();
        }
      }

      // Core stays exposed permanently until ball enters - no timer!

      // Phase 3: Spawn swarm enemies every 5 seconds (max 8 total)
      if (shouldSpawnSwarm(megaBoss)) {
        const maxEnemies = MEGA_BOSS_CONFIG.maxSwarmEnemies;
        const currentEnemyCount = enemies.length;

        // Only spawn if under max limit
        if (currentEnemyCount < maxEnemies) {
          const canSpawn = Math.min(MEGA_BOSS_CONFIG.swarmEnemyCount, maxEnemies - currentEnemyCount);
          const enemyTypes: Array<"cube" | "sphere" | "pyramid"> = ["cube", "sphere", "pyramid"];
          const newEnemies: Enemy[] = [];

          for (let i = 0; i < canSpawn; i++) {
            const spawnX = Math.random() * (SCALED_CANVAS_WIDTH - 40) + 20;
            const spawnY = 50 + Math.random() * 50;
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 0.5;
            const enemyId = Date.now() + i;
            const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

            const newEnemy = enemyPool.acquire({
              id: enemyId,
              type: enemyType,
              x: spawnX,
              y: spawnY,
              width: 30,
              height: 30,
              dx: Math.cos(angle) * speed,
              dy: Math.sin(angle) * speed,
              speed,
              rotation: 0,
              rotationX: 0,
              rotationY: 0,
              rotationZ: 0,
              hits: 0,
            });

            if (newEnemy) {
              newEnemies.push(newEnemy);
              // Add to boss spawned enemies for power-up drops
              bossSpawnedEnemiesRef.current.add(enemyId);
            }
          }

          if (newEnemies.length > 0) {
            setEnemies((prev) => [...prev, ...newEnemies]);
            setBoss((prev) => {
              if (!prev || !isMegaBoss(prev)) return prev;
              return markSwarmSpawned(prev as MegaBoss) as unknown as Boss;
            });

            toast.warning(`⚔️ ${newEnemies.length} SWARM ENEMIES SPAWNED!`, { duration: 1500 });
          }
        } else {
          // Mark as spawned even if at max, to reset timer
          setBoss((prev) => {
            if (!prev || !isMegaBoss(prev)) return prev;
            return markSwarmSpawned(prev as MegaBoss) as unknown as Boss;
          });
        }
      }
      // Phase 3: Music-reactive background hue (only on strong beats)
      if (getMegaBossPhase(megaBoss) === 3) {
        const bassEnergy = soundManager.getBassEnergy();
        if (bassEnergy > 0.72) {
          world.backgroundHue = Math.floor(Math.random() * 360);
        } else if (bassEnergy < 0.3) {
          world.backgroundHue = 0;
        }
      }
    }

    // ═══ Hit Streak: music-reactive hue when streak >= 10 ═══
    if (hitStreakActive && (BOSS_LEVELS.includes(level) || level === MEGA_BOSS_LEVEL)) {
      const bassEnergy = soundManager.getBassEnergy();
      if (bassEnergy > 0.72) {
        world.backgroundHue = Math.floor(Math.random() * 360);
      } else if (bassEnergy < 0.3) {
        world.backgroundHue = 0;
      }
    }

    // ═══ DANGER BALL UPDATE LOOP (with reflect + homing mechanic) ═══
    if (dangerBalls.length > 0 && paddle && boss && isMegaBoss(boss)) {
      const megaBoss = boss as MegaBoss;

      setDangerBalls((prev) => {
        const updatedBalls: DangerBall[] = [];
        let coreHits = 0;
        let ballsMissed = 0;

        prev.forEach((ball) => {
          // Update position with wall bouncing
          let updatedBall = updateDangerBall(ball, SCALED_CANVAS_WIDTH, dtSecondsRef.current);

          // If ball is homing, apply homing steering toward boss core
          if (updatedBall.isHoming && boss) {
            updatedBall = applyHomingToDangerBall(updatedBall, boss.x, boss.y, boss.width, boss.height);
          }

          // Check if NOT YET REFLECTED ball hits paddle -> REFLECT it
          if (
            !updatedBall.isReflected &&
            isDangerBallIntercepted(updatedBall, paddle.x, paddle.y, paddle.width, paddle.height)
          ) {
            // Reflect the ball and enable homing
            updatedBall = reflectDangerBall(updatedBall, paddle.x, paddle.width);

            toast.info(`↩️ Danger ball reflected!`, { duration: 1000 });
            soundManager.playDangerBallCatch();
            updatedBalls.push(updatedBall);
            return;
          }

          // Check if REFLECTED ball hits the boss core
          if (
            updatedBall.isReflected &&
            boss &&
            isDangerBallAtCore(updatedBall, boss.x, boss.y, boss.width, boss.height)
          ) {
            coreHits++;

            toast.success(`💥 CORE HIT! (${megaBoss.coreHitsFromDangerBalls + coreHits}/5)`, { duration: 1000 });
            soundManager.playDangerBallCoreHitSound();
            triggerScreenShake(6, 300);
            return; // Remove ball after hitting core
          }

          // Check if NON-REFLECTED ball reached bottom (missed without reflecting)
          if (!updatedBall.isReflected && isDangerBallAtBottom(updatedBall, SCALED_CANVAS_HEIGHT)) {
            ballsMissed++;
            soundManager.playDangerBallMissedSound();
            toast.warning("⚠️ Danger ball missed!", { duration: 1000 });
            return; // Remove ball
          }

          // Check if REFLECTED ball missed (went off screen without hitting core)
          if (
            updatedBall.isReflected &&
            hasReflectedBallMissed(updatedBall, SCALED_CANVAS_WIDTH, SCALED_CANVAS_HEIGHT)
          ) {
            ballsMissed++;
            soundManager.playDangerBallMissedSound();
            toast.warning("⚠️ Reflected ball missed the core!", { duration: 1000 });
            return; // Remove ball
          }

          // Check if off screen (sides when not reflected) - safety
          if (
            !updatedBall.isReflected &&
            (updatedBall.x < -50 || updatedBall.x > SCALED_CANVAS_WIDTH + 50 || updatedBall.y < -50)
          ) {
            return; // Remove from game
          }

          updatedBalls.push(updatedBall);
        });

        // Update core hit count on boss
        if (coreHits > 0) {
          setBoss((prevBoss) => {
            if (!prevBoss || !isMegaBoss(prevBoss)) return prevBoss;
            let mb = prevBoss as MegaBoss;
            for (let i = 0; i < coreHits; i++) {
              mb = incrementCoreHit(mb);
            }
            return mb as unknown as Boss;
          });
        }

        // FAIL FAST: Immediately reset boss on ANY missed danger ball
        if (ballsMissed > 0) {
          setBoss((prevBoss) => {
            if (!prevBoss || !isMegaBoss(prevBoss)) return prevBoss;
            const currentMegaBoss = prevBoss as MegaBoss;
            const { boss: resetBoss, releasedBall } = resetMegaBossPhaseProgress(currentMegaBoss);

            if (releasedBall) {
              setBalls((prev) => [...prev, releasedBall]);
            }

            return resetBoss as unknown as Boss;
          });

          toast.error(`⚠️ Catch all 5 balls to kill enemy!`, { duration: 4000 });
          soundManager.playFailureSound();

          // Clear all remaining danger balls immediately
          return [];
        }

        return updatedBalls;
      });

      // Check if danger ball phase should end successfully (all 5 core hits)
      if (shouldEndDangerBallPhase(megaBoss) && dangerBalls.length === 0 && hasSufficientCoreHits(megaBoss)) {
        console.log(`[MEGA BOSS DEBUG] SUCCESS! All 5 core hits achieved - phase will advance via shouldReleaseBall`);
        // Success path is handled by shouldReleaseBall in the existing ball update code
      }
    }

    // Update resurrected bosses
    resurrectedBosses.forEach((resBoss, idx) => {
      if (resBoss.phase === "moving") {
        const dx = resBoss.targetPosition.x - resBoss.x;
        const dy = resBoss.targetPosition.y - resBoss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) {
          setResurrectedBosses((prev) =>
            prev.map((b, i) => (i === idx ? { ...b, phase: "attacking", lastAttackTime: world.simTimeMs } : b)),
          );
        } else if (!resBoss.isStunned) {
          setResurrectedBosses((prev) =>
            prev.map((b, i) =>
              i === idx
                ? {
                    ...b,
                    x: b.x + (dx / dist) * b.speed * dtSecondsRef.current * 60,
                    y: b.y + (dy / dist) * b.speed * dtSecondsRef.current * 60,
                    rotationX: b.rotationX + 0.08 * dtSecondsRef.current * 60,
                    rotationY: b.rotationY + 0.12 * dtSecondsRef.current * 60,
                  }
                : b,
            ),
          );
        }
      } else if (
        !resBoss.isStunned &&
        resBoss.phase === "attacking" &&
        world.simTimeMs - resBoss.lastAttackTime >= resBoss.attackCooldown &&
        paddle
      ) {
        performBossAttack(
          resBoss,
          paddle.x + paddle.width / 2,
          paddle.y,
          setBossAttacks,
          setLaserWarnings,
          setSuperWarnings,
        );
        const nextIdx = (resBoss.currentPositionIndex + 1) % resBoss.positions.length;
        setResurrectedBosses((prev) =>
          prev.map((b, i) =>
            i === idx
              ? {
                  ...b,
                  phase: "moving",
                  targetPosition: b.positions[nextIdx],
                  currentPositionIndex: nextIdx,
                  lastAttackTime: world.simTimeMs,
                }
              : b,
          ),
        );
      }
    });

    // Update boss attacks
    // Define paddle danger zone - projectiles within this Y range keep moving during stun
    const paddleDangerZoneY = paddle ? paddle.y - 100 : SCALED_CANVAS_HEIGHT - 100;

    setBossAttacks((prev) =>
      prev.filter((attack) => {
        if (attack.type === "laser") return true;

        // Check if stun is active and projectile should be frozen
        // Exception: projectiles near paddle level (within danger zone) keep moving
        const isInDangerZone = attack.y >= paddleDangerZoneY;
        if (isStunActive && !attack.isReflected && !isInDangerZone) {
          // Frozen during stun - keep attack but don't update position
          return true;
        }

        // Special handling for cross attack course changes
        if (attack.type === "cross" && !attack.isReflected) {
          const now = world.simTimeMs; // sim-time, not wall-clock

          // Check if in paddle danger zone - never stop in this area
          const isInPaddleZone = attack.y >= paddleDangerZoneY;

          if (attack.isStopped) {
            // If currently stopped but now in danger zone, resume immediately
            if (isInPaddleZone) {
              attack.isStopped = false;
              attack.nextCourseChangeTime = undefined; // Prevent future stops
              // Continue with current direction, don't return early
            } else {
              // Check if stop duration has elapsed (1 second)
              if (now - (attack.stopStartTime || 0) >= 1000) {
                // Apply pre-calculated direction
                if (attack.pendingDirection) {
                  attack.dx = attack.pendingDirection.dx;
                  attack.dy = attack.pendingDirection.dy;
                  attack.pendingDirection = undefined;
                }
                attack.isStopped = false;
                attack.nextCourseChangeTime = now + 500 + Math.random() * 1000;
              }
              // When stopped, don't update position but keep the attack
              return true;
            }
          } else if (attack.nextCourseChangeTime && now >= attack.nextCourseChangeTime) {
            // In danger zone - don't stop, continue off screen
            if (isInPaddleZone) {
              attack.nextCourseChangeTime = undefined; // Prevent future stops
              // Continue moving, don't return early
            } else {
              // Time for a course change - stop and pre-calculate new direction
              attack.isStopped = true;
              attack.stopStartTime = now;

              // Pre-calculate the new direction for visual indicator
              const currentAngle = Math.atan2(attack.dy || 0, attack.dx || 0);
              const directionChange = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 6); // ±30° change
              let newAngle = currentAngle + directionChange;

              // Ensure projectile never goes upward (dy must be positive)
              // Clamp angle to range [0, PI] which gives positive dy values
              let newDy = Math.sin(newAngle) * attack.speed;
              if (newDy < 0) {
                // Flip the direction change to keep going downward
                newAngle = currentAngle - directionChange;
                newDy = Math.sin(newAngle) * attack.speed;
                // If still negative, force horizontal movement with slight downward
                if (newDy < 0) {
                  newDy = Math.abs(newDy);
                }
              }

              attack.pendingDirection = {
                dx: Math.cos(newAngle) * attack.speed,
                dy: newDy,
              };
              return true;
            }
          }
        }

        // Apply homing behavior to reflected attacks
        if (attack.isReflected) {
          // Find closest target (boss or enemy)
          let closestTarget: { x: number; y: number; width: number; height: number } | null = null;
          let closestDist = Infinity;

          const attackCenterX = attack.x + attack.width / 2;
          const attackCenterY = attack.y + attack.height / 2;

          // Check main boss
          if (boss) {
            const bossCenterX = boss.x + boss.width / 2;
            const bossCenterY = boss.y + boss.height / 2;
            const dist = Math.sqrt(Math.pow(bossCenterX - attackCenterX, 2) + Math.pow(bossCenterY - attackCenterY, 2));
            if (dist < closestDist) {
              closestDist = dist;
              closestTarget = boss;
            }
          }

          // Check resurrected bosses
          for (const rb of resurrectedBosses) {
            const rbCenterX = rb.x + rb.width / 2;
            const rbCenterY = rb.y + rb.height / 2;
            const dist = Math.sqrt(Math.pow(rbCenterX - attackCenterX, 2) + Math.pow(rbCenterY - attackCenterY, 2));
            if (dist < closestDist) {
              closestDist = dist;
              closestTarget = rb;
            }
          }

          // Check enemies
          for (const enemy of enemies) {
            const enemyCenterX = enemy.x + enemy.width / 2;
            const enemyCenterY = enemy.y + enemy.height / 2;
            const dist = Math.sqrt(
              Math.pow(enemyCenterX - attackCenterX, 2) + Math.pow(enemyCenterY - attackCenterY, 2),
            );
            if (dist < closestDist) {
              closestDist = dist;
              closestTarget = enemy;
            }
          }

          // Steer toward closest target
          if (closestTarget) {
            const targetCenterX = closestTarget.x + closestTarget.width / 2;
            const targetCenterY = closestTarget.y + closestTarget.height / 2;

            // Calculate direction to target
            const dirX = targetCenterX - attackCenterX;
            const dirY = targetCenterY - attackCenterY;
            const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);

            if (dirLength > 0) {
              // Normalize direction
              const normDirX = dirX / dirLength;
              const normDirY = dirY / dirLength;

              // Apply steering (blend current direction with target direction)
              const steeringStrength = 0.15; // How aggressively it homes
              const currentSpeed = Math.sqrt((attack.dx || 0) ** 2 + (attack.dy || 0) ** 2);

              attack.dx = (attack.dx || 0) * (1 - steeringStrength) + normDirX * currentSpeed * steeringStrength;
              attack.dy = (attack.dy || 0) * (1 - steeringStrength) + normDirY * currentSpeed * steeringStrength;

              // Normalize to maintain speed
              const newSpeed = Math.sqrt(attack.dx * attack.dx + attack.dy * attack.dy);
              if (newSpeed > 0) {
                attack.dx = (attack.dx / newSpeed) * currentSpeed;
                attack.dy = (attack.dy / newSpeed) * currentSpeed;
              }
            }
          }
        }

        // Skip position update if cross attack is stopped
        if (attack.type === "cross" && attack.isStopped) {
          return true;
        }

        // Apply gentle homing toward player paddle for mega boss shots
        if (attack.isHomingToPlayer && !attack.isReflected && paddle) {
          const attackCX = attack.x + attack.width / 2;
          const paddleCX = paddle.x + paddle.width / 2;
          const dirX = paddleCX - attackCX;
          const currentSpeed = Math.sqrt((attack.dx || 0) ** 2 + (attack.dy || 0) ** 2);
          if (currentSpeed > 0 && Math.abs(dirX) > 5) {
            const normX = dirX / Math.abs(dirX);
            const str = attack.homingStrength || 0.03;
            const currentDx = attack.dx || 0;
            const currentDy = attack.dy || 0;
            const newDx = currentDx + normX * str * currentSpeed;
            // Re-normalize to keep speed constant
            const newMag = Math.sqrt(newDx * newDx + currentDy * currentDy);
            if (newMag > 0) {
              attack.dx = (newDx / newMag) * currentSpeed;
              attack.dy = (currentDy / newMag) * currentSpeed;
            }
          }
        }

        const newX = attack.x + (attack.dx || 0) * dtSecondsRef.current * 60;
        const newY = attack.y + (attack.dy || 0) * dtSecondsRef.current * 60;
        if (newX < 0 || newX > SCALED_CANVAS_WIDTH || newY < 0 || newY > SCALED_CANVAS_HEIGHT) return false;
        attack.x = newX;
        attack.y = newY;

        // Check reflected attacks against boss and enemies
        if (attack.isReflected) {
          // Check collision with main boss
          if (
            boss &&
            attack.x + attack.width > boss.x &&
            attack.x < boss.x + boss.width &&
            attack.y + attack.height > boss.y &&
            attack.y < boss.y + boss.height
          ) {
            // Damage the boss with proper cooldown, defeat detection, and logging
            const REFLECTED_ATTACK_COOLDOWN_MS = 1000;
            const nowMs = world.simTimeMs; // sim-time, not wall-clock

            // Use ref for synchronous cooldown check to prevent multiple hits in same frame
            const lastHitMs = reflectedAttackLastHitRef.current;
            const canDamage = nowMs - lastHitMs >= REFLECTED_ATTACK_COOLDOWN_MS;

            if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
              console.log(
                `[Collision Debug] REFLECTED ATTACK → BOSS (${boss.type}) - Cooldown check: canDamage=${canDamage}, diff=${nowMs - lastHitMs}ms`,
              );
            }

            if (!canDamage) {
              return false; // Remove attack but don't damage (on cooldown)
            }

            // Update ref immediately to prevent other attacks in same frame from dealing damage
            reflectedAttackLastHitRef.current = nowMs;

            setBoss((prevBoss) => {
              if (!prevBoss) return null;

              const newHealth = prevBoss.currentHealth - 1;

              if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
                console.log(
                  `[Collision Debug] REFLECTED ATTACK → BOSS (${prevBoss.type}) - HP: ${prevBoss.currentHealth} → ${newHealth}`,
                );
              }

              // Check for defeat
              if (newHealth <= 0) {
                // Skip defeat for Mega Boss - it has its own defeat system
                if (isMegaBoss(prevBoss)) {
                  return prevBoss;
                }
                // Boss defeated - play explosion effects
                soundManager.playExplosion();
                soundManager.playBossDefeatSound();
                const bossPoints = prevBoss.type === "cube" ? 5000 : prevBoss.type === "sphere" ? 7500 : 10000;
                setScore((prev) => prev + bossPoints);
                setBossesKilled((prev) => prev + 1);
                triggerScreenShake(15, 800);
                triggerHighlightFlash(1.0, 400);

                // Create explosion visual effect
                setExplosions((e) => [
                  ...e,
                  {
                    x: prevBoss.x + prevBoss.width / 2,
                    y: prevBoss.y + prevBoss.height / 2,
                    frame: 0,
                    maxFrames: 30,
                    enemyType: prevBoss.type as EnemyType,
                    particles: createExplosionParticles(
                      prevBoss.x + prevBoss.width / 2,
                      prevBoss.y + prevBoss.height / 2,
                      prevBoss.type as EnemyType,
                    ),
                  },
                ]);

                // Clean up game entities
                setBalls([]);
                clearAllEnemies();
                setBossAttacks([]);
                clearAllBombs();
                world.bullets = [];
                bulletPool.releaseAll();
                setLaserWarnings([]);

                // Stop boss music and resume background music
                soundManager.stopBossMusic();
                soundManager.resumeBackgroundMusic();

                toast.success(`🎉 ${prevBoss.type.toUpperCase()} BOSS DEFEATED!`, { duration: 3000 });
                setBossDefeatedTransitioning(true);
                setBossActive(false);
                setBossVictoryOverlayActive(true);
                setTimeout(() => {
                  nextLevel();
                }, 3000);
                return { ...prevBoss, currentHealth: 0, phase: "defeated" as const, lastHitAt: nowMs };
              }

              // Not defeated - show HP toast
              if (ENABLE_DEBUG_FEATURES) {
                toast.info(`BOSS: ${newHealth} HP`, { duration: 1000 });
              }
              return { ...prevBoss, currentHealth: newHealth, lastHitAt: nowMs };
            });

            soundManager.playBossHitSound();
            triggerScreenShake(8, 400);
            return false; // Remove attack
          }

          // Check collision with resurrected bosses
          for (const rb of resurrectedBosses) {
            if (
              attack.x + attack.width > rb.x &&
              attack.x < rb.x + rb.width &&
              attack.y + attack.height > rb.y &&
              attack.y < rb.y + rb.height
            ) {
              const REFLECTED_ATTACK_COOLDOWN_MS = 1000;
              const nowMs = world.simTimeMs; // sim-time, not wall-clock
              const lastHitMs = (rb as any).lastHitAt || 0;
              const canDamage = nowMs - lastHitMs >= REFLECTED_ATTACK_COOLDOWN_MS;

              if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
                console.log(`[Collision Debug] REFLECTED ATTACK → RESURRECTED BOSS - Cooldown: canDamage=${canDamage}`);
              }

              if (!canDamage) {
                return false; // Remove attack but don't damage
              }

              setResurrectedBosses((prev) => {
                const updated = prev.map((b) => {
                  if (b.id !== rb.id) return b;

                  const newHealth = b.currentHealth - 1;

                  if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
                    console.log(
                      `[Collision Debug] REFLECTED ATTACK → RESURRECTED BOSS - HP: ${b.currentHealth} → ${newHealth}`,
                    );
                  }

                  if (newHealth <= 0) {
                    // Resurrected boss defeated - play explosion effects
                    soundManager.playExplosion();
                    soundManager.playBossDefeatSound();
                    setScore((s) => s + 2500);
                    triggerScreenShake(10, 600);

                    // Create explosion visual effect
                    setExplosions((e) => [
                      ...e,
                      {
                        x: b.x + b.width / 2,
                        y: b.y + b.height / 2,
                        frame: 0,
                        maxFrames: 30,
                        enemyType: "pyramid" as EnemyType,
                        particles: createExplosionParticles(
                          b.x + b.width / 2,
                          b.y + b.height / 2,
                          "pyramid" as EnemyType,
                        ),
                      },
                    ]);

                    toast.success("Mini-boss destroyed!", { duration: 1500 });
                    return null as any; // Mark for removal
                  }

                  if (ENABLE_DEBUG_FEATURES) {
                    toast.info(`Mini-boss: ${newHealth} HP`, { duration: 1000 });
                  }
                  return { ...b, currentHealth: newHealth, lastHitAt: nowMs };
                });

                const filtered = updated.filter((b) => b !== null);

                // Check if all resurrected bosses are defeated
                if (filtered.length === 0 && boss === null) {
                  setBossesKilled((p) => p + 1);
                  toast.success("🎉 ALL MINI-BOSSES DEFEATED!", { duration: 3000 });
                  setBossDefeatedTransitioning(true);
                  setBossActive(false);
                  setBossVictoryOverlayActive(true);
                  setBalls([]);
                  clearAllEnemies();
                  setBossAttacks([]);
                  clearAllBombs();
                  world.bullets = [];
                  bulletPool.releaseAll();
                  setLaserWarnings([]);
                  soundManager.stopBossMusic();
                  soundManager.resumeBackgroundMusic();
                  setTimeout(() => {
                    nextLevel();
                  }, 3000);
                }

                return filtered;
              });

              soundManager.playBossHitSound();
              triggerScreenShake(6, 400);
              return false; // Remove attack
            }
          }

          // Check collision with enemies
          for (const enemy of enemies) {
            if (
              attack.x + attack.width > enemy.x &&
              attack.x < enemy.x + enemy.width &&
              attack.y + attack.height > enemy.y &&
              attack.y < enemy.y + enemy.height
            ) {
              // Remove enemy by ID
              enemyPool.release(enemy);
              setEnemies((prev) => prev.filter((e) => e.id !== enemy.id));
              setScore((prev) => prev + 100);
              setEnemiesKilled((prev) => prev + 1);

              // Create explosion particles
              const particles = createExplosionParticles(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                enemy.type,
              );
              setExplosions((prev) => [
                ...prev,
                {
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                  frame: 0,
                  maxFrames: 20,
                  enemyType: enemy.type,
                  particles: particles,
                },
              ]);

              // Trigger highlight flash for enemy kill (levels 1-4)
              triggerHighlightFlash(0.7, 200);

              soundManager.playCrackedBrickBreakSound();
              if (ENABLE_DEBUG_FEATURES) {
                toast.success("Reflected attack destroyed enemy!");
              }
              return false; // Remove attack
            }
          }

          return true; // Continue moving reflected attack
        }

        // Check boss shot collisions with paddle (only for non-reflected attacks)
        if (
          paddle &&
          attack.x + attack.width > paddle.x &&
          attack.x < paddle.x + paddle.width &&
          attack.y + attack.height > paddle.y &&
          attack.y < paddle.y + paddle.height
        ) {
          // Check for reflect shield FIRST (reflects back to boss) - preserves regular shield
          if (paddle.hasReflectShield) {
            soundManager.playReflectedAttackSound();

            // Mark attack as reflected and reverse direction
            attack.isReflected = true;
            attack.dy = -Math.abs(attack.dy || attack.speed); // Always go upward

            toast.success("Attack reflected!");
            return true; // Keep attack in array, now moving upward
          }

          // Only check regular shield if reflect shield is NOT active
          if (paddle.hasShield) {
            soundManager.playBounce();

            // Add shield impact effect at attack position
            setShieldImpacts((prev) => [
              ...prev,
              {
                x: attack.x + attack.width / 2,
                y: attack.y + attack.height / 2,
                startTime: Date.now(),
                duration: 600,
              },
            ]);

            setPaddle((prev) => (prev ? { ...prev, hasShield: false } : null));
            toast.success("Shield absorbed boss attack!");
            return false; // Remove attack
          }

          // No shield - take damage
          soundManager.playLoseLife();
          setLives((prev) => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              handleGameOver();
            } else {
              handleSurviveDeath(`Boss attack hit! ${newLives} lives remaining. Click to continue.`);
            }
            return newLives;
          });
          return false;
        }
        return true;
      }),
    );

    // ═══ CROSS PROJECTILE COLLISION DETECTION ═══
    // Check for collisions between non-reflected cross projectiles to spawn crossBall enemies
    const MERGE_COOLDOWN_MS = 1000; // 1 second before projectiles can merge
    const nowForMerge = world.simTimeMs; // sim-time, not wall-clock

    const crossProjectiles = bossAttacks.filter(
      (attack) =>
        attack.type === "cross" &&
        !attack.isReflected &&
        // Only allow merging after 1 second since spawn
        (attack.spawnTime ? nowForMerge - attack.spawnTime >= MERGE_COOLDOWN_MS : true),
    );

    if (crossProjectiles.length >= 2) {
      const crossCollisions: Array<{ attack1: BossAttack; attack2: BossAttack }> = [];

      for (let i = 0; i < crossProjectiles.length; i++) {
        for (let j = i + 1; j < crossProjectiles.length; j++) {
          const a1 = crossProjectiles[i];
          const a2 = crossProjectiles[j];

          // Circle-circle collision
          const cx1 = a1.x + a1.width / 2;
          const cy1 = a1.y + a1.height / 2;
          const cx2 = a2.x + a2.width / 2;
          const cy2 = a2.y + a2.height / 2;
          const r1 = a1.width / 2;
          const r2 = a2.width / 2;

          const dx = cx2 - cx1;
          const dy = cy2 - cy1;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < r1 + r2) {
            crossCollisions.push({ attack1: a1, attack2: a2 });
          }
        }
      }

      // Process collisions: remove both projectiles and spawn crossBall enemy
      if (crossCollisions.length > 0) {
        const attacksToRemove = new Set<BossAttack>();
        const newCrossBallEnemies: Enemy[] = [];
        const mergeExplosions: Array<{ x: number; y: number }> = [];

        for (const collision of crossCollisions) {
          // Skip if already processed
          if (attacksToRemove.has(collision.attack1) || attacksToRemove.has(collision.attack2)) {
            continue;
          }

          attacksToRemove.add(collision.attack1);
          attacksToRemove.add(collision.attack2);

          // Calculate midpoint for new enemy
          const midX = (collision.attack1.x + collision.attack2.x) / 2 + collision.attack1.width / 2;
          const midY = (collision.attack1.y + collision.attack2.y) / 2 + collision.attack1.height / 2;

          // Add merge explosion effect
          mergeExplosions.push({ x: midX, y: midY });

          // Create crossBall enemy
          const speed = 2.5;
          const angle = Math.random() * Math.PI * 2;
          const crossBallEnemy = enemyPool.acquire({
            id: Date.now() + Math.random() * 1000,
            type: "crossBall",
            x: midX - 17.5, // Center the 35x35 enemy
            y: midY - 17.5,
            width: 35,
            height: 35,
            rotation: 0,
            rotationX: Math.random() * Math.PI,
            rotationY: Math.random() * Math.PI,
            rotationZ: Math.random() * Math.PI,
            speed: speed,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            hits: 0,
            isAngry: false,
            isCrossBall: true,
            spawnTime: nowForMerge, // Track spawn time for merge cooldown
          });

          if (crossBallEnemy) {
            newCrossBallEnemies.push(crossBallEnemy);
          }
        }

        // Remove collided projectiles
        if (attacksToRemove.size > 0) {
          setBossAttacks((prev) => prev.filter((a) => !attacksToRemove.has(a)));
        }

        // Spawn new crossBall enemies
        if (newCrossBallEnemies.length > 0) {
          setEnemies((prev) => [...prev, ...newCrossBallEnemies]);

          // Create merge particle effects
          for (const explosion of mergeExplosions) {
            setExplosions((e) => [
              ...e,
              {
                x: explosion.x,
                y: explosion.y,
                frame: 0,
                maxFrames: 25,
                enemyType: "crossBall" as EnemyType,
                particles: createExplosionParticles(explosion.x, explosion.y, "crossBall" as EnemyType),
              },
            ]);
          }

          soundManager.playMergeSound();
          toast.warning("Cross projectiles merged into CrossBall enemy!");
        }
      }
    }

    // ═══ CROSSBALL ENEMY COLLISION DETECTION ═══
    // Check for collisions between crossBall enemies to spawn large spheres
    const crossBallEnemies = enemies.filter(
      (e) =>
        e.type === "crossBall" &&
        e.isCrossBall &&
        // Only allow merging after 1 second since spawn
        (e.spawnTime ? nowForMerge - e.spawnTime >= MERGE_COOLDOWN_MS : true),
    );

    if (crossBallEnemies.length >= 2) {
      const crossBallCollisions: Array<{ enemy1: Enemy; enemy2: Enemy }> = [];

      for (let i = 0; i < crossBallEnemies.length; i++) {
        for (let j = i + 1; j < crossBallEnemies.length; j++) {
          const e1 = crossBallEnemies[i];
          const e2 = crossBallEnemies[j];

          // Circle-circle collision
          const cx1 = e1.x + e1.width / 2;
          const cy1 = e1.y + e1.height / 2;
          const cx2 = e2.x + e2.width / 2;
          const cy2 = e2.y + e2.height / 2;
          const r1 = e1.width / 2;
          const r2 = e2.width / 2;

          const dx = cx2 - cx1;
          const dy = cy2 - cy1;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < r1 + r2) {
            crossBallCollisions.push({ enemy1: e1, enemy2: e2 });
          }
        }
      }

      // Process collisions: remove both crossBalls and spawn large sphere
      if (crossBallCollisions.length > 0) {
        const enemiesToRemove = new Set<number>();
        const newLargeSpheres: Enemy[] = [];
        const largeSphereExplosions: Array<{ x: number; y: number }> = [];

        for (const collision of crossBallCollisions) {
          // Skip if already processed
          if (enemiesToRemove.has(collision.enemy1.id!) || enemiesToRemove.has(collision.enemy2.id!)) {
            continue;
          }

          enemiesToRemove.add(collision.enemy1.id!);
          enemiesToRemove.add(collision.enemy2.id!);

          // Calculate midpoint for new enemy
          const midX = (collision.enemy1.x + collision.enemy2.x) / 2 + collision.enemy1.width / 2;
          const midY = (collision.enemy1.y + collision.enemy2.y) / 2 + collision.enemy1.height / 2;

          // Add merge explosion effect
          largeSphereExplosions.push({ x: midX, y: midY });

          // Create large sphere enemy
          const speed = 3.0;
          const angle = Math.random() * Math.PI * 2;
          const largeSphereEnemy = enemyPool.acquire({
            id: Date.now() + Math.random() * 1000,
            type: "sphere",
            x: midX - 27.5, // Center larger sprite (55/2)
            y: midY - 27.5,
            width: 55,
            height: 55,
            rotation: 0,
            rotationX: Math.random() * Math.PI,
            rotationY: Math.random() * Math.PI,
            rotationZ: Math.random() * Math.PI,
            speed: speed,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            hits: 0,
            isAngry: false,
            isLargeSphere: true,
          });

          if (largeSphereEnemy) {
            newLargeSpheres.push(largeSphereEnemy);
          }
        }

        // Remove collided crossBall enemies (release to pool)
        if (enemiesToRemove.size > 0) {
          setEnemies((prev) => {
            prev.filter((e) => enemiesToRemove.has(e.id!)).forEach((e) => enemyPool.release(e));
            return prev.filter((e) => !enemiesToRemove.has(e.id!));
          });
        }

        // Spawn new large sphere enemies (add separately to avoid filter interference)
        if (newLargeSpheres.length > 0) {
          setEnemies((prev) => [...prev, ...newLargeSpheres]);

          // Create merge particle effects
          for (const explosion of largeSphereExplosions) {
            setExplosions((e) => [
              ...e,
              {
                x: explosion.x,
                y: explosion.y,
                frame: 0,
                maxFrames: 30,
                enemyType: "sphere" as EnemyType,
                particles: createExplosionParticles(explosion.x, explosion.y, "sphere" as EnemyType),
              },
            ]);
          }

          soundManager.playMergeSound();
          toast.warning("CrossBall enemies merged into Large Sphere!");
          triggerScreenShake(8, 400);

          // Count each merge as a streak hit (crossBalls merging into sphere)
          if (BOSS_LEVELS.includes(level) || level === MEGA_BOSS_LEVEL) {
            const mergeCount = newLargeSpheres.length;
            for (let i = 0; i < mergeCount; i++) {
              setHitStreak((prev) => {
                const newStreak = prev + 1;
                hitStreakRef.current = newStreak;
                const bonus = Math.floor(100 * (1 + newStreak / 100));

                setScore((s) => s + bonus);
                if (newStreak >= 10 && !hitStreakActive) {
                  setHitStreakActive(true);
                }
                return newStreak;
              });
            }
          }
        }
      }
    }

    // Check reflected bomb collisions with boss and enemies
    const reflectedBombNow = world.simTimeMs; // sim-time, not wall-clock
    const REFLECTED_BOMB_COOLDOWN = 200; // 200ms cooldown between reflected bomb hits

    // Log bomb state for debugging
    if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging && bombs.length > 0) {
      const reflectedCount = bombs.filter((b) => b.isReflected).length;
      const newlyReflectedCount = newlyReflectedBombIdsRef.current.size;
      if (reflectedCount > 0 || newlyReflectedCount > 0) {
        console.log(
          `[Collision Debug] BOMB CHECK: total=${bombs.length} reflected=${reflectedCount} newlyReflected=${newlyReflectedCount}`,
        );
      }
    }

    bombs.forEach((bomb) => {
      // Check both state AND ref for newly reflected bombs (handles stale closure)
      const isReflectedNow = bomb.isReflected || newlyReflectedBombIdsRef.current.has(bomb.id);
      if (!isReflectedNow) return;

      // Check collision with main boss
      if (
        boss &&
        bomb.x + bomb.width > boss.x &&
        bomb.x < boss.x + boss.width &&
        bomb.y + bomb.height > boss.y &&
        bomb.y < boss.y + boss.height
      ) {
        const nowMs = world.simTimeMs; // sim-time, not wall-clock
        bombPool.release(bomb);
        setBombs((prev) => prev.filter((b) => b.id !== bomb.id));

        // Apply damage with boss-local cooldown using CURRENT boss state
        setBoss((prevBoss) => {
          if (!prevBoss) return null;

          const lastHit = prevBoss.lastHitAt || 0;
          const canDamage = nowMs - lastHit >= REFLECTED_BOMB_COOLDOWN;

          if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
            const ts = performance.now().toFixed(2);
            console.log(
              `[${ts}ms] [Collision Debug] REFLECTED BOMB → BOSS (${prevBoss.type}) - ` +
                `canDamage=${canDamage} lastHitMs=${lastHit} nowMs=${nowMs} ` +
                `bossHP=${prevBoss.currentHealth}`,
            );
          }

          if (!canDamage) {
            return prevBoss;
          }

          soundManager.playBossHitSound();
          triggerScreenShake(8, 400);
          if (ENABLE_DEBUG_FEATURES) {
            throttledToast("success", "Reflected shot hit the boss!", "reflected_hit");
          }

          const newHealth = prevBoss.currentHealth - 1;

          if (ENABLE_DEBUG_FEATURES && debugSettings.enableCollisionLogging) {
            console.log("[BossSweep] Reflected bomb damage:", {
              bossType: prevBoss.type,
              currentHealth: prevBoss.currentHealth,
              newHealth,
              willDefeat: newHealth <= 0,
            });
          }

          // Check for defeat
          if (newHealth <= 0) {
            // Mega Boss cannot be defeated by reflected bombs
            if (prevBoss.type === "mega") {
              return prevBoss;
            }
            if (prevBoss.type === "cube") {
              setTimeout(() => {
                soundManager.playExplosion();
                soundManager.playBossDefeatSound();
                setScore((s) => s + BOSS_CONFIG.cube.points);
                toast.success(`CUBE GUARDIAN DEFEATED! +${BOSS_CONFIG.cube.points} points`);
                setExplosions((e) => [
                  ...e,
                  {
                    x: prevBoss.x + prevBoss.width / 2,
                    y: prevBoss.y + prevBoss.height / 2,
                    frame: 0,
                    maxFrames: 30,
                    enemyType: "cube" as EnemyType,
                    particles: createExplosionParticles(
                      prevBoss.x + prevBoss.width / 2,
                      prevBoss.y + prevBoss.height / 2,
                      "cube" as EnemyType,
                    ),
                  },
                ]);
                setBossesKilled((k) => k + 1);
                setBossActive(false);
                setBossDefeatedTransitioning(true);
                setBalls([]);
                clearAllEnemies();
                setBossAttacks([]);
                clearAllBombs();
                world.bullets = [];
                bulletPool.releaseAll();
                soundManager.stopBossMusic();
                soundManager.resumeBackgroundMusic();
                setTimeout(() => nextLevel(), 3000);
              }, 0);
              return null;
            }

            if (prevBoss.type === "sphere") {
              if (prevBoss.currentStage === 1) {
                setTimeout(() => {
                  soundManager.playExplosion();
                  toast.error("SPHERE PHASE 2: DESTROYER MODE!");
                  setExplosions((e) => [
                    ...e,
                    {
                      x: prevBoss.x + prevBoss.width / 2,
                      y: prevBoss.y + prevBoss.height / 2,
                      frame: 0,
                      maxFrames: 30,
                      enemyType: "sphere" as EnemyType,
                      particles: createExplosionParticles(
                        prevBoss.x + prevBoss.width / 2,
                        prevBoss.y + prevBoss.height / 2,
                        "sphere" as EnemyType,
                      ),
                    },
                  ]);
                }, 0);
                return {
                  ...prevBoss,
                  currentHealth: BOSS_CONFIG.sphere.healthPhase2,
                  currentStage: 2,
                  isAngry: true,
                  speed: BOSS_CONFIG.sphere.angryMoveSpeed,
                  lastHitAt: nowMs,
                };
              }

              setTimeout(() => {
                soundManager.playExplosion();
                soundManager.playBossDefeatSound();
                setScore((s) => s + BOSS_CONFIG.sphere.points);
                toast.success(`SPHERE DESTROYER DEFEATED! +${BOSS_CONFIG.sphere.points} points`);
                setExplosions((e) => [
                  ...e,
                  {
                    x: prevBoss.x + prevBoss.width / 2,
                    y: prevBoss.y + prevBoss.height / 2,
                    frame: 0,
                    maxFrames: 30,
                    enemyType: "sphere" as EnemyType,
                    particles: createExplosionParticles(
                      prevBoss.x + prevBoss.width / 2,
                      prevBoss.y + prevBoss.height / 2,
                      "sphere" as EnemyType,
                    ),
                  },
                ]);
                setBossesKilled((k) => k + 1);
                setBossActive(false);
                setBossDefeatedTransitioning(true);
                setBalls([]);
                clearAllEnemies();
                setBossAttacks([]);
                clearAllBombs();
                world.bullets = [];
                bulletPool.releaseAll();
                soundManager.stopBossMusic();
                soundManager.resumeBackgroundMusic();
                setTimeout(() => nextLevel(), 3000);
              }, 0);
              return null;
            }

            if (prevBoss.type === "pyramid") {
              if (prevBoss.currentStage === 1) {
                setTimeout(() => {
                  soundManager.playExplosion();
                  toast.error("PYRAMID LORD SPLITS INTO 3!");
                  setExplosions((e) => [
                    ...e,
                    {
                      x: prevBoss.x + prevBoss.width / 2,
                      y: prevBoss.y + prevBoss.height / 2,
                      frame: 0,
                      maxFrames: 30,
                      enemyType: "pyramid" as EnemyType,
                      particles: createExplosionParticles(
                        prevBoss.x + prevBoss.width / 2,
                        prevBoss.y + prevBoss.height / 2,
                        "pyramid" as EnemyType,
                      ),
                    },
                  ]);
                  const resurrected: Boss[] = [];
                  for (let i = 0; i < 3; i++) {
                    resurrected.push(createResurrectedPyramid(prevBoss, i, SCALED_CANVAS_WIDTH, SCALED_CANVAS_HEIGHT));
                  }
                  setResurrectedBosses(resurrected);
                }, 0);
                return null;
              }
            }
          }

          // Not defeated
          return { ...prevBoss, currentHealth: newHealth, lastHitAt: nowMs };
        });

        return;
      }

      // Check collision with resurrected bosses
      for (const rb of resurrectedBosses) {
        if (
          bomb.x + bomb.width > rb.x &&
          bomb.x < rb.x + rb.width &&
          bomb.y + bomb.height > rb.y &&
          bomb.y < rb.y + rb.height
        ) {
          // Check cooldown
          const lastHit = rb.lastHitAt || 0;
          if (reflectedBombNow - lastHit < REFLECTED_BOMB_COOLDOWN) {
            bombPool.release(bomb);
            setBombs((prev) => prev.filter((b) => b.id !== bomb.id));
            return;
          }

          const newHealth = rb.currentHealth - 1;

          soundManager.playBossHitSound();
          triggerScreenShake(6, 400);
          throttledToast("success", "Reflected shot hit resurrected boss!", "reflected_hit");

          if (newHealth <= 0) {
            // Defeat this resurrected boss
            const config = BOSS_CONFIG.pyramid;
            setScore((s) => s + config.resurrectedPoints);
            toast.success(`PYRAMID DESTROYED! +${config.resurrectedPoints} points`);
            soundManager.playBossDefeatSound();
            soundManager.playExplosion();

            setExplosions((e) => [
              ...e,
              {
                x: rb.x + rb.width / 2,
                y: rb.y + rb.height / 2,
                frame: 0,
                maxFrames: 30,
                enemyType: "pyramid" as EnemyType,
                particles: createExplosionParticles(rb.x + rb.width / 2, rb.y + rb.height / 2, "pyramid" as EnemyType),
              },
            ]);

            // Calculate remaining resurrected bosses
            const remaining = resurrectedBosses.filter((b) => b.id !== rb.id);

            // Check if all defeated - handle outside callback
            if (remaining.length === 0) {
              toast.success("ALL PYRAMIDS DEFEATED!");
              setResurrectedBosses([]);
              setBossActive(false);
              setBossesKilled((k) => k + 1);
              setBossDefeatedTransitioning(true);
              setBalls([]);
              clearAllEnemies();
              setBossAttacks([]);
              clearAllBombs();
              world.bullets = [];
              bulletPool.releaseAll();
              soundManager.stopBossMusic();
              soundManager.resumeBackgroundMusic();
              setTimeout(() => nextLevel(), 3000);
            } else if (remaining.length === 1) {
              // Make last one super angry
              toast.error("FINAL PYRAMID ENRAGED!");
              setResurrectedBosses([
                {
                  ...remaining[0],
                  isSuperAngry: true,
                  speed: BOSS_CONFIG.pyramid.superAngryMoveSpeed,
                },
              ]);
            } else {
              setResurrectedBosses(remaining);
            }
          } else {
            setResurrectedBosses((prev) =>
              prev.map((b) => (b.id === rb.id ? { ...b, currentHealth: newHealth, lastHitAt: reflectedBombNow } : b)),
            );
          }

          // Remove bomb by ID
          bombPool.release(bomb);
          setBombs((prev) => prev.filter((b) => b.id !== bomb.id));
          return;
        }
      }

      // Check collision with enemies
      for (const enemy of enemies) {
        if (
          bomb.x + bomb.width > enemy.x &&
          bomb.x < enemy.x + enemy.width &&
          bomb.y + bomb.height > enemy.y &&
          bomb.y < enemy.y + enemy.height
        ) {
          // Remove enemy by ID
          enemyPool.release(enemy);
          setEnemies((prev) => prev.filter((e) => e.id !== enemy.id));
          setScore((prev) => prev + 100);
          setEnemiesKilled((prev) => prev + 1);

          // Create explosion particles
          const particles = createExplosionParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.type);
          setExplosions((prev) => [
            ...prev,
            {
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height / 2,
              frame: 0,
              maxFrames: 20,
              enemyType: enemy.type,
              particles: particles,
            },
          ]);

          // Trigger highlight flash for enemy kill (levels 1-4)
          triggerHighlightFlash(0.7, 200);

          soundManager.playCrackedBrickBreakSound();
          toast.success("Reflected shot destroyed enemy!");
          // Remove bomb by ID
          bombPool.release(bomb);
          setBombs((prev) => prev.filter((b) => b.id !== bomb.id));
          return;
        }
      }
    });

    // Check laser collisions with paddle separately
    bossAttacks.forEach((attack) => {
      if (attack.type === "laser" && paddle) {
        // Check if paddle is within laser X range
        const laserRight = attack.x + attack.width;
        const paddleRight = paddle.x + paddle.width;

        if (paddle.x < laserRight && paddleRight > attack.x) {
          // Check for shield first
          if (paddle.hasShield) {
            soundManager.playBounce();

            // Add shield impact effect at paddle center (laser is wide)
            setShieldImpacts((prev) => [
              ...prev,
              {
                x: paddle.x + paddle.width / 2,
                y: paddle.y,
                startTime: Date.now(),
                duration: 600,
              },
            ]);

            setPaddle((prev) => (prev ? { ...prev, hasShield: false } : null));
            toast.success("Shield absorbed laser!");
            // Remove laser attack
            setBossAttacks((prev) => prev.filter((a) => a !== attack));
            return;
          }

          // No shield - paddle is hit by laser!
          soundManager.playLoseLife();
          setLives((prev) => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              handleGameOver();
            } else {
              handleSurviveDeath(`LASER HIT! ${newLives} lives remaining. Click to continue.`);
            }
            return newLives;
          });

          // Remove the laser after hit
          setBossAttacks((prev) => prev.filter((a) => a !== attack));
        }
      }
    });

    // Clean up expired laser warnings (skip filter if empty)
    if (world.laserWarnings.length > 0) {
      const nowCleanup = Date.now();
      setLaserWarnings((prev) => prev.filter((warning) => nowCleanup - warning.startTime < 800));
    }

    // Clean up expired super warnings (skip filter if empty)
    if (world.superWarnings.length > 0) {
      const nowCleanup = Date.now();
      setSuperWarnings((prev) => prev.filter((warning) => nowCleanup - warning.startTime < 600));
    }

    // Boss collisions are now handled via CCD and shape-specific checks in Phase 3.5
    // Old collision code removed to prevent conflicts with unified boss-local cooldown system

    // Single physics step per frame using the actual (clamped) delta time.
    // The CCD engine already handles variable dt correctly via substeps, so a
    // fixed-timestep accumulator is not needed and only doubles physics work on
    // slow/integrated-GPU devices (e.g. 30 fps → 2 steps/frame with accumulator).
    // Power-ups and bullets already use delta time (fixed in the previous PR),
    // so consistency across frame rates is maintained without the accumulator.
    if (profilerEnabled) frameProfiler.startTiming("physics");
    updatePowerUps(dtSecondsRef.current);
    updateBullets(bricks, dtSecondsRef.current);
    checkCollision();
    if (profilerEnabled) frameProfiler.endTiming("physics");

    // Check power-up collision
    if (paddle) {
      checkPowerUpCollision(paddle, balls, setBalls, setPaddle, setSpeedMultiplier);
    }

    // ═══ PHASE 1: End Frame Profiling ═══
    if (profilerEnabled) {
      frameProfiler.endFrame();
      if (debugSettings.enableFrameProfilerLogging && frameProfiler.isEnabled()) {
        frameProfiler.logStats();
      }
    }

    // ═══ LAG DETECTION: Update frame end time ═══
    const frameEnd = performance.now();
    lagDetectionRef.current.lastFrameEnd = frameEnd;

    // Log slow frames if profiler is enabled (use frameNow from start of loop)
    if (profilerEnabled) {
      const frameDuration = frameEnd - frameNow;
      if (frameDuration > 50) {
        const stats = frameProfiler.getStats();
        debugLogger.addLogLite(
          "warn",
          `[SLOW FRAME] Duration: ${frameDuration.toFixed(1)}ms, fps: ${stats?.fps || "N/A"}, physics: ${stats?.timings?.physics.toFixed(1) || 0}ms`,
        );
      }
    }
  }, [
    gameState,
    checkCollision,
    updatePowerUps,
    updateBullets,
    // paddle removed — now lives in world.paddle (no React dependency)
    // balls removed — now lives in world.balls (no React dependency)
    // bricks removed — now lives in world.bricks (no React dependency)
    // speedMultiplier removed — now lives in world.speedMultiplier (no React dependency)
    // enemies removed — now lives in world.enemies (no React dependency)
    // bombs removed — now lives in world.bombs (no React dependency)
    // bossAttacks removed — now lives in world.bossAttacks (no React dependency)
    // explosions removed — now lives in world.explosions (no React dependency)
    checkPowerUpCollision,
    score,
    isHighScore,
    lastScoreMilestone,
    updateFps,
    debugSettings,
  ]);

  // Start/stop the unified game loop whenever gameState or game logic changes.
  // Including `gameLoop` in deps mirrors the previous pattern (the old useEffect
  // also depended on `gameLoop`). When `gameLoop` is recreated due to a React
  // state change (score, debug settings, etc.) the loop restarts cleanly so the
  // new closure captures fresh state. This is intentional — the restart is
  // cheap (single rAF frame gap) and was already the existing behaviour.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (gameState !== "playing") return;

    const loop = new UnifiedGameLoop(canvas, {
      onPhysicsStep: (dtSeconds) => {
        // Store the fixed dt in a ref so gameLoop can read it without needing
        // a parameter change. dtSecondsRef.current is always FIXED_PHYSICS_TIMESTEP
        // (1/60 second) — the UnifiedGameLoop's accumulator handles time scale.
        dtSecondsRef.current = dtSeconds;
        gameLoop();
      },
      onRender: (_alpha) => {
        // Render FPS tracking — fires once per display frame
        fpsTrackerRef.current.frameCount++;
        const now = performance.now();
        const renderDelta = now - fpsTrackerRef.current.lastTime;
        if (renderDelta >= 1000) {
          const fps = Math.round((fpsTrackerRef.current.frameCount * 1000) / renderDelta);
          fpsTrackerRef.current.fps = fps;
          fpsTrackerRef.current.frameCount = 0;
          fpsTrackerRef.current.lastTime = now;
          updateFps(fps);
          setCurrentFps(fps);
        }
      },
      getTimeScale: () => gameLoopRef.current?.getTimeScale() ?? DEFAULT_TIME_SCALE,
    });

    loop.start();
    unifiedLoopRef.current = loop;

    return () => {
      loop.stop();
      unifiedLoopRef.current = null;
    };
  }, [gameState, gameLoop, updateFps]);

  // Separate useEffect for timer management - handle pause/resume
  // Include all pause-like states: paused, tutorial, boss rush stats overlay
  useEffect(() => {
    const isEffectivelyPaused = gameState === "paused" || tutorialActive || bossRushStatsOverlayActive;

    if (gameState === "playing" && timerStartedRef.current && !isEffectivelyPaused) {
      // Resume timer if it was started and we're playing and not in a pause-like state
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = setInterval(() => {
          setTimer((prev) => prev + 1);
        }, 1000);
      }
    } else if (isEffectivelyPaused) {
      // Any pause-like state: clear interval but keep timerStartedRef true
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = undefined;
      }
    } else if (gameState !== "playing") {
      // Game over or not started: clear everything
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = undefined;
      }
      timerStartedRef.current = false;
      bombIntervalsRef.current.forEach((interval) => clearInterval(interval));
      bombIntervalsRef.current.clear();
    }

    // Handle total play time independently
    if (gameState === "playing" && totalPlayTimeStartedRef.current && !isEffectivelyPaused) {
      // Resume total play time if it was started, we're playing, and not paused
      if (!totalPlayTimeIntervalRef.current) {
        totalPlayTimeIntervalRef.current = setInterval(() => {
          setTotalPlayTime((prev) => prev + 1);
        }, 1000);
      }
    } else if (isEffectivelyPaused) {
      // Any pause-like state: clear interval but keep totalPlayTimeStartedRef true
      if (totalPlayTimeIntervalRef.current) {
        clearInterval(totalPlayTimeIntervalRef.current);
        totalPlayTimeIntervalRef.current = undefined;
      }
    } else if (gameState !== "playing") {
      // Game over or not started: clear total play time interval
      if (totalPlayTimeIntervalRef.current) {
        clearInterval(totalPlayTimeIntervalRef.current);
        totalPlayTimeIntervalRef.current = undefined;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (totalPlayTimeIntervalRef.current) {
        clearInterval(totalPlayTimeIntervalRef.current);
      }
      bombIntervalsRef.current.forEach((interval) => clearInterval(interval));
      bombIntervalsRef.current.clear();
    };
  }, [gameState, tutorialActive, bossRushStatsOverlayActive]);

  // Enemy spawn at regular intervals
  useEffect(() => {
    // Don't spawn normal enemies during boss fights
    if (bossActive) return;

    if (gameState === "playing" && timer > 0) {
      // Spawn interval decreases with level
      // Normal: 30s at level 1, 20s at level 2, 15s at level 3+
      // Godlike: 20s at level 1, 12s at level 2, 8s at level 3+
      const baseInterval = settings.difficulty === "godlike" ? 20 : 30;
      const minInterval = settings.difficulty === "godlike" ? 8 : 15;
      const spawnInterval = Math.max(
        minInterval,
        baseInterval - (level - 1) * (settings.difficulty === "godlike" ? 4 : 5),
      );
      if (timer - lastEnemySpawnTime >= spawnInterval) {
        // Cap speed increase at 5 enemies (30% * 5 = 150%, so cap at 200%)
        const speedIncrease = Math.min(2.0, 1 + Math.min(enemySpawnCount, 5) * 0.3);
        const enemyId = nextEnemyId.current++;

        // Determine enemy type - sphere from level 3+, pyramid from level 6+
        let enemyType: "cube" | "sphere" | "pyramid";
        if (level >= 6 && Math.random() < 0.3) {
          enemyType = "pyramid";
        } else if (level >= 3 && Math.random() > 0.5) {
          enemyType = "sphere";
        } else {
          enemyType = "cube";
        }
        let newEnemy: Enemy;
        if (enemyType === "pyramid") {
          // Pyramid enemy - very slow random movement, 3 hits to destroy
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 * speedIncrease; // Very slow
          newEnemy = enemyPool.acquire({
            id: enemyId,
            type: "pyramid",
            x: Math.random() * (SCALED_CANVAS_WIDTH - 40),
            y: 50 + Math.random() * 50,
            width: 40,
            height: 40,
            rotation: 0,
            rotationX: Math.random() * Math.PI,
            rotationY: Math.random() * Math.PI,
            rotationZ: Math.random() * Math.PI,
            speed: speed,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            hits: 0,
            isAngry: false,
          });
        } else if (enemyType === "sphere") {
          // Sphere enemy - random movement pattern
          const angle = Math.random() * Math.PI * 2;
          const speed = 2.5 * speedIncrease; // Slightly faster
          newEnemy = enemyPool.acquire({
            id: enemyId,
            type: "sphere",
            x: Math.random() * (SCALED_CANVAS_WIDTH - 40),
            y: 50 + Math.random() * 50,
            width: 35,
            height: 35,
            rotation: 0,
            rotationX: Math.random() * Math.PI,
            rotationY: Math.random() * Math.PI,
            rotationZ: Math.random() * Math.PI,
            speed: speed,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            hits: 0,
            isAngry: false,
          });
        } else {
          // Cube enemy - straight line movement
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 * speedIncrease;
          newEnemy = enemyPool.acquire({
            id: enemyId,
            type: "cube",
            x: Math.random() * (SCALED_CANVAS_WIDTH - 40),
            y: 50 + Math.random() * 50,
            width: 30,
            height: 30,
            rotation: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            speed: speed,
            dx: Math.cos(angle) * speed,
            dy: Math.abs(Math.sin(angle)) * speed, // Always move downward initially
          });
        }
        if (newEnemy) {
          setEnemies((prev) => [...prev, newEnemy]);
        }
        setLastEnemySpawnTime(timer);
        setEnemySpawnCount((prev) => prev + 1);
        const enemyName = enemyType === "sphere" ? "Sphere" : enemyType === "pyramid" ? "Pyramid" : "Cube";
        toast.warning(`${enemyName} enemy ${enemySpawnCount + 1} appeared! Speed: ${Math.round(speedIncrease * 100)}%`);

        // Trigger minion tutorial on first enemy spawn (non-boss level enemies)
        // Only set ref AFTER successful trigger to fix bug where tutorial wouldn't show
        if (tutorialEnabled && !minionTutorialTriggeredRef.current) {
          // Small delay to ensure enemy is rendered before showing tutorial
          setTimeout(() => {
            const { shouldPause } = triggerTutorial("minion_spawn", level);
            if (shouldPause) {
              minionTutorialTriggeredRef.current = true;
              setGameState("paused");
              if (gameLoopRef.current) gameLoopRef.current.pause();
            }
          }, 100);
        }

        // Start dropping projectiles for this enemy
        // Set up bomb/rocket drop with level-scaled intervals
        // Base: 7-12 seconds, increases 0.5s per level until level 8 (4-8s), then 3-7s from level 9+
        let minInterval, maxInterval;
        if (level <= 8) {
          const levelBonus = (level - 1) * 0.5;
          minInterval = Math.max(4, 7 - levelBonus);
          maxInterval = Math.max(8, 12 - levelBonus);
        } else {
          minInterval = 3;
          maxInterval = 7;
        }
        const randomInterval = minInterval * 1000 + Math.random() * (maxInterval - minInterval) * 1000;
        const projectileInterval = setInterval(() => {
          setEnemies((currentEnemies) => {
            const currentEnemy = currentEnemies.find((e) => e.id === enemyId);
            if (!currentEnemy) {
              clearInterval(projectileInterval);
              bombIntervalsRef.current.delete(enemyId);
              return currentEnemies;
            }

            // Pyramid enemies shoot bullets in random angles
            const currentTimeScale = gameLoopRef.current?.getTimeScale() ?? 1.0;
            if (currentEnemy.type === "pyramid") {
              const randomAngle = (Math.random() * 160 - 80) * (Math.PI / 180); // -80 to +80 degrees
              const bulletSpeed = 4;
              const newBullet = bombPool.acquire({
                id: Date.now() + Math.random(),
                x: currentEnemy.x + currentEnemy.width / 2 - 4,
                y: currentEnemy.y + currentEnemy.height,
                width: 8,
                height: 12,
                speed: bulletSpeed * currentTimeScale,
                enemyId: enemyId,
                type: "pyramidBullet",
                dx: Math.sin(randomAngle) * bulletSpeed * currentTimeScale,
              });
              if (newBullet) {
                soundManager.playPyramidBulletSound();
                setBombs((prev) => [...prev, newBullet]);
              }
            } else {
              const newProjectile = bombPool.acquire({
                id: Date.now() + Math.random(),
                x: currentEnemy.x + currentEnemy.width / 2 - 5,
                y: currentEnemy.y + currentEnemy.height,
                width: 10,
                height: 10,
                speed: 3 * currentTimeScale,
                enemyId: enemyId,
                type: "bomb", // Both cube and sphere enemies drop bombs
              });
              if (newProjectile) {
                soundManager.playBombDropSound();
                setBombs((prev) => [...prev, newProjectile]);
              }
            }
            return currentEnemies;
          });
        }, randomInterval);
        bombIntervalsRef.current.set(enemyId, projectileInterval);
      }
    }
  }, [timer, gameState, lastEnemySpawnTime, enemySpawnCount, level, settings.difficulty]);

  // Boss enemy spawning system
  useEffect(() => {
    if (gameState !== "playing" || !boss || bossDefeatedTransitioning) return;

    const BOSS_SPAWN_INTERVAL = 15; // 15 seconds
    const MAX_BOSS_ENEMIES = 6; // Maximum enemies on screen
    const ENEMIES_PER_SPAWN = 2; // Spawn 2 at a time

    // Check if enough time has passed and we haven't reached the cap
    if (timer - lastBossSpawnTime >= BOSS_SPAWN_INTERVAL && enemies.length < MAX_BOSS_ENEMIES) {
      const enemiesToSpawn = Math.min(ENEMIES_PER_SPAWN, MAX_BOSS_ENEMIES - enemies.length);
      const newEnemies: Enemy[] = [];

      for (let i = 0; i < enemiesToSpawn; i++) {
        const enemyId = nextEnemyId.current++;
        // For level 20 Mega Boss, spawn mixed enemy types instead of just cubes
        const enemyTypes: Array<"cube" | "sphere" | "pyramid"> = ["cube", "sphere", "pyramid"];
        const enemyType =
          level === 20
            ? enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
            : boss.type === "mega"
              ? "cube"
              : boss.type;

        // Track that this enemy was spawned by the boss
        bossSpawnedEnemiesRef.current.add(enemyId);

        // Calculate spawn position (from boss center with slight offset)
        const spawnAngle = (Math.PI / 3) * i - Math.PI / 6;
        const spawnOffsetX = Math.cos(spawnAngle) * 40;
        const spawnOffsetY = Math.sin(spawnAngle) * 40;

        // Create enemy based on type with smaller size
        let newEnemy: Enemy;
        const baseSpeed = 2.0;

        if (enemyType === "pyramid") {
          const angle = Math.random() * Math.PI * 2;
          newEnemy = enemyPool.acquire({
            id: enemyId,
            type: "pyramid",
            x: boss.x + boss.width / 2 - 17.5 + spawnOffsetX,
            y: boss.y + boss.height / 2 - 17.5 + spawnOffsetY,
            width: 35,
            height: 35,
            rotation: 0,
            rotationX: Math.random() * Math.PI,
            rotationY: Math.random() * Math.PI,
            rotationZ: Math.random() * Math.PI,
            speed: baseSpeed,
            dx: Math.cos(angle) * baseSpeed,
            dy: Math.sin(angle) * baseSpeed,
          });
        } else if (enemyType === "sphere") {
          const angle = Math.random() * Math.PI * 2;
          newEnemy = enemyPool.acquire({
            id: enemyId,
            type: "sphere",
            x: boss.x + boss.width / 2 - 15 + spawnOffsetX,
            y: boss.y + boss.height / 2 - 15 + spawnOffsetY,
            width: 30,
            height: 30,
            rotation: 0,
            rotationX: Math.random() * Math.PI,
            rotationY: Math.random() * Math.PI,
            rotationZ: Math.random() * Math.PI,
            speed: baseSpeed * 1.25,
            dx: Math.cos(angle) * baseSpeed * 1.25,
            dy: Math.sin(angle) * baseSpeed * 1.25,
            hits: 0,
            isAngry: false,
          });
        } else {
          // cube
          const angle = Math.random() * Math.PI * 2;
          newEnemy = enemyPool.acquire({
            id: enemyId,
            type: "cube",
            x: boss.x + boss.width / 2 - 12.5 + spawnOffsetX,
            y: boss.y + boss.height / 2 - 12.5 + spawnOffsetY,
            width: 25,
            height: 25,
            rotation: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            speed: baseSpeed,
            dx: Math.cos(angle) * baseSpeed,
            dy: Math.abs(Math.sin(angle)) * baseSpeed,
          });
        }

        if (newEnemy) {
          newEnemies.push(newEnemy);

          // Set up bomb dropping for this enemy
          const minInterval = 5;
          const maxInterval = 10;
          const randomInterval = minInterval * 1000 + Math.random() * (maxInterval - minInterval) * 1000;

          const projectileInterval = setInterval(() => {
            setEnemies((currentEnemies) => {
              const currentEnemy = currentEnemies.find((e) => e.id === enemyId);
              if (!currentEnemy) {
                clearInterval(projectileInterval);
                bombIntervalsRef.current.delete(enemyId);
                return currentEnemies;
              }

              const projectileType = enemyType === "pyramid" ? "pyramidBullet" : "bomb";

              const newBomb = bombPool.acquire({
                id: Date.now() + Math.random(),
                x: currentEnemy.x + currentEnemy.width / 2 - 5,
                y: currentEnemy.y + currentEnemy.height,
                width: 10,
                height: 10,
                speed: 3 * (gameLoopRef.current?.getTimeScale() ?? 1.0),
                enemyId: enemyId,
                type: projectileType,
              });

              if (newBomb) {
                setBombs((prev) => [...prev, newBomb]);

                if (enemyType === "pyramid") {
                  soundManager.playPyramidBulletSound();
                } else {
                  soundManager.playBombDropSound();
                }
              }

              return currentEnemies;
            });
          }, randomInterval);

          bombIntervalsRef.current.set(enemyId, projectileInterval);
        }
      }

      if (newEnemies.length > 0) {
        setEnemies((prev) => [...prev, ...newEnemies]);
      }
      setLastBossSpawnTime(timer);

      // Trigger minion tutorial on first boss minion spawn
      // Only set ref AFTER successful trigger to fix bug where tutorial wouldn't show
      if (tutorialEnabled && !minionTutorialTriggeredRef.current) {
        setTimeout(() => {
          const { shouldPause } = triggerTutorial("minion_spawn", level);
          if (shouldPause) {
            minionTutorialTriggeredRef.current = true;
            setGameState("paused");
            if (gameLoopRef.current) gameLoopRef.current.pause();
          }
        }, 100);
      }

      // Trigger spawn animation
      setBossSpawnAnimation({ active: true, startTime: Date.now() });
      setTimeout(() => setBossSpawnAnimation(null), 500);

      soundManager.playExplosion();
      toast.warning(`${boss.type.toUpperCase()} spawned ${enemiesToSpawn} minion${enemiesToSpawn > 1 ? "s" : ""}!`, {
        duration: 2000,
      });
    }
  }, [
    timer,
    gameState,
    boss,
    enemies.length,
    lastBossSpawnTime,
    SCALED_CANVAS_WIDTH,
    bossDefeatedTransitioning,
    level,
    isBossRush,
    bossRushIndex,
  ]);

  // Boss hit cooldown timer
  useEffect(() => {
    if (bossHitCooldown <= 0) return;

    const interval = setInterval(() => {
      setBossHitCooldown((prev) => Math.max(0, prev - 50));
    }, 50);

    return () => clearInterval(interval);
  }, [bossHitCooldown]);

  // Auto-sway launch angle oscillation (4000ms full cycle: left -> right -> left)
  const launchSwayStartRef = useRef<number | null>(null);
  const launchSwayAnimationRef = useRef<number | null>(null);
  const [isManualAimMode, setIsManualAimMode] = useState(false);

  // Reset manual aim mode when ball starts waiting (new level or after life loss)
  useEffect(() => {
    const waitingBall = balls.find((ball) => ball.waitingToLaunch);
    if (waitingBall && gameState === "playing") {
      if (launchSwayStartRef.current === null) {
        setIsManualAimMode(false);
      }
    }
  }, [balls, gameState]);

  useEffect(() => {
    const waitingBall = balls.find((ball) => ball.waitingToLaunch);
    if (gameState !== "playing" || !waitingBall || isManualAimMode) {
      if (launchSwayAnimationRef.current) {
        cancelAnimationFrame(launchSwayAnimationRef.current);
        launchSwayAnimationRef.current = null;
      }
      if (gameState !== "playing" || !waitingBall) {
        launchSwayStartRef.current = null;
      }
      return;
    }

    const updateSway = (timestamp: number) => {
      if (launchSwayStartRef.current === null) {
        launchSwayStartRef.current = timestamp;
      }

      const elapsed = timestamp - launchSwayStartRef.current;
      const swayAngle = 80 * Math.sin((elapsed / 4000) * Math.PI * 2);
      setLaunchAngle(swayAngle);
      launchSwayAnimationRef.current = requestAnimationFrame(updateSway);
    };

    launchSwayAnimationRef.current = requestAnimationFrame(updateSway);

    return () => {
      if (launchSwayAnimationRef.current) {
        cancelAnimationFrame(launchSwayAnimationRef.current);
        launchSwayAnimationRef.current = null;
      }
    };
  }, [gameState, balls, isManualAimMode]);

  // Keyboard controls: A/D/LEFT/RIGHT stop oscillation and switch to manual aim mode
  // Mousewheel scroll also stops oscillation and adjusts angle
  // Mousewheel CLICK launches the ball
  useEffect(() => {
    const waitingBall = balls.find((ball) => ball.waitingToLaunch);
    if (gameState !== "playing" || !waitingBall) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isLeftKey = e.key === "ArrowLeft" || e.key === "a" || e.key === "A";
      const isRightKey = e.key === "ArrowRight" || e.key === "d" || e.key === "D";

      if (isLeftKey || isRightKey) {
        if (!isManualAimMode) {
          setIsManualAimMode(true);
        }
        if (isLeftKey) {
          setLaunchAngle((prev) => Math.max(prev - 3, -80));
        } else {
          setLaunchAngle((prev) => Math.min(prev + 3, 80));
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isManualAimMode) {
        setIsManualAimMode(true);
      }
      if (e.deltaY < 0) {
        setLaunchAngle((prev) => Math.max(prev - 3, -80));
      } else if (e.deltaY > 0) {
        setLaunchAngle((prev) => Math.min(prev + 3, 80));
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        launchBallAtCurrentAngle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [gameState, balls, launchBallAtCurrentAngle, isManualAimMode]);
  const handleStart = () => {
    if (gameState === "ready") {
      // Check if this is level completion (all bricks destroyed)
      const isLevelComplete = bricks.every((brick) => !brick.visible) && bricks.length > 0;
      if (isLevelComplete) {
        // Start next level
        nextLevel();
      } else {
        // Continue current level - start music only if not already playing (and not boss music)
        setGameState("playing");
        // Start Boss Rush timer on first game start
        if (isBossRush && bossRushStartTime === null) {
          setBossRushStartTime(Date.now());
        }
        if (!soundManager.isMusicPlaying() && !soundManager.isBossMusicPlaying()) {
          soundManager.playBackgroundMusic(level);
        }
        toast.success("Continue!");
      }
    }
  };
  const handleRestart = useCallback(() => {
    unifiedLoopRef.current?.stop();
    unifiedLoopRef.current = null;
    soundManager.stopBossMusic();
    soundManager.stopBackgroundMusic();
    soundManager.stopHighScoreMusic();
    setShowHighScoreEntry(false);
    setShowHighScoreDisplay(false);
    setShowEndScreen(false);
    setBeatLevel50Completed(false);
    initGame();
    toast("Game Reset!");
  }, [initGame]);
  const handleHighScoreSubmit = async (name: string) => {
    try {
      // Create a burst of particles on submission using pool
      const particleCount = Math.round(150 * (qualitySettings.explosionParticles / 50));
      particlePool.acquireForHighScore(
        SCALED_CANVAS_WIDTH / 2,
        SCALED_CANVAS_HEIGHT / 2,
        particleCount,
        gameLoopRef.current?.getTimeScale() ?? 1.0,
      );
      // particleRenderTick removed — pool renders directly

      // Flash the screen
      setBackgroundFlash(1);
      setTimeout(() => setBackgroundFlash(0), 200);

      await addHighScore(
        name,
        score,
        level,
        settings.difficulty,
        beatLevel50Completed,
        collectedLetters.size === 6,
        settings.startingLives,
      );

      toast.success("🎉 HIGH SCORE SAVED! 🎉", {
        duration: 3000,
      });

      // Delay transition to show celebration
      setTimeout(() => {
        setShowHighScoreEntry(false);
        setShowHighScoreDisplay(true);
      }, 1000);
    } catch (err) {
      console.error("Failed to submit high score:", err);
      setShowHighScoreEntry(false);
      setShowHighScoreDisplay(true);
    }
  };
  const handleEndScreenContinue = () => {
    setShowEndScreen(false);
    setShowHighScoreDisplay(true);
  };

  const handleEndScreenReturnToMenu = () => {
    hasAutoFullscreenedRef.current = false;
    soundManager.stopHighScoreMusic();
    soundManager.stopBossMusic();
    soundManager.stopBackgroundMusic();
    setShowEndScreen(false);
    particlePool.releaseAll(); // Clear all particles
    resetAllPools(); // Clear all entity pools
    onReturnToMenu();
  };

  const handleCloseHighScoreDisplay = () => {
    setShowHighScoreDisplay(false);
    // If end screen hasn't been shown yet, show it
    if (!showEndScreen) {
      setShowEndScreen(true);
    } else {
      // If coming back from end screen, go to menu
      soundManager.stopHighScoreMusic();
      hasAutoFullscreenedRef.current = false;
      onReturnToMenu();
    }
  };

  const handleRetryLevel = useCallback(() => {
    // Stop all music first
    soundManager.stopHighScoreMusic();
    soundManager.stopBossMusic();
    soundManager.stopBackgroundMusic();

    // Stop game loop before restarting level
    if (gameLoopRef.current) {
      gameLoopRef.current.stop();
    }

    // Clear timer interval before resetting
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    timerStartedRef.current = false;
    bombIntervalsRef.current.forEach((interval) => clearInterval(interval));
    bombIntervalsRef.current.clear();

    // Keep the current level
    const currentLevel = level;
    const maxSpeedMultiplier = settings.difficulty === "godlike" ? 1.75 : 1.5;
    const baseMultiplier = settings.difficulty === "godlike" ? 1.25 : 1.0;
    const levelSpeedMultiplier = Math.min(maxSpeedMultiplier, baseMultiplier + (currentLevel - 1) * 0.05);
    setSpeedMultiplier(levelSpeedMultiplier);

    // Reset paddle
    const initialPaddleX = SCALED_CANVAS_WIDTH / 2 - SCALED_PADDLE_WIDTH / 2;
    setPaddle({
      x: initialPaddleX,
      y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
      width: SCALED_PADDLE_WIDTH,
      height: SCALED_PADDLE_HEIGHT,
      hasTurrets: false,
    });
    // Initialize high-priority paddle position ref
    paddleXRef.current = initialPaddleX;

    // Initialize ball with level speed - waiting to launch
    const baseSpeed = 4.5 * Math.min(levelSpeedMultiplier, 1.75);
    const initialBall: Ball = {
      x: SCALED_CANVAS_WIDTH / 2,
      y: SCALED_CANVAS_HEIGHT - SCALED_PADDLE_START_Y,
      dx: baseSpeed,
      dy: -baseSpeed,
      radius: SCALED_BALL_RADIUS,
      speed: baseSpeed,
      id: nextBallId.current++,
      isFireball: false,
      waitingToLaunch: true,
    };
    setBalls([initialBall]);
    setLaunchAngle(-20);
    launchAngleDirectionRef.current = 1;
    setShowInstructions(true);

    // Reset bricks for current level
    setBricks(initBricksForLevel(currentLevel));

    // Reset all stats and score
    setScore(0);
    setTotalBricksDestroyed(0);
    setTotalShots(0);
    setBricksHit(0);
    setLevelSkipped(false);
    setLivesLostOnCurrentLevel(0); // Reset mercy power-up counter
    setBossFirstHitShieldDropped(false); // Reset shield drop for retried boss level
    // Reset hit streak
    setHitStreak(0);
    hitStreakRef.current = 0;
    setHitStreakActive(false);
    ballHitSinceLastPaddleRef.current.clear();
    world.backgroundHue = 0;
    setPowerUpsCollectedTypes(new Set());
    setBricksDestroyedByTurrets(0);
    setBossesKilled(0);
    particlePool.releaseAll(); // Clear all particles
    resetAllPools(); // Clear all entity pools (power-ups, bullets, enemies, etc.)
    setLives(settings.startingLives);

    // Clear all entities
    setPowerUps([]);
    world.bullets = [];
    bulletPool.releaseAll();
    setTimer(0);
    setTotalPlayTime(0);
    totalPlayTimeStartedRef.current = false;
    clearAllEnemies();
    clearAllBombs();
    setExplosions([]);
    setEnemySpawnCount(0);
    setLastEnemySpawnTime(0);
    setBonusLetters([]);
    setCollectedLetters(new Set());
    setLetterLevelAssignments(createRandomLetterAssignments());
    setBrickHitSpeedAccumulated(0);
    setLastBossSpawnTime(0);
    setBossSpawnAnimation(null);
    setEnemiesKilled(0);

    // Clear boss state if not a boss level, or reset and trigger intro if it is
    if (!BOSS_LEVELS.includes(currentLevel)) {
      setBoss(null);
      setResurrectedBosses([]);
      setBossAttacks([]);
      setBossActive(false);
      setLaserWarnings([]);
      setBossIntroActive(false);
    } else {
      // Boss level - clear everything first
      setBoss(null);
      setResurrectedBosses([]);
      setBossAttacks([]);
      setBossActive(false);
      setLaserWarnings([]);
      soundManager.stopBossMusic();

      // Trigger boss intro sequence after a brief delay to ensure clean state
      setTimeout(() => {
        // Reinitialize the boss
        setBricks(initBricksForLevel(currentLevel));

        // Start intro sequence
        setBossIntroActive(true);
        soundManager.playBossIntroSound();

        // Show boss name and start boss music after 1 second
        setTimeout(() => {
          soundManager.playBossMusic(currentLevel);
          const bossName =
            currentLevel === 5 ? "CUBE GUARDIAN" : currentLevel === 10 ? "SPHERE DESTROYER" : "PYRAMID LORD";
          toast.error(`⚠️ BOSS APPROACHING: ${bossName} ⚠️`, { duration: 3000 });
        }, 1000);

        // End intro after 3 seconds
        setTimeout(() => {
          setBossIntroActive(false);
        }, 3000);
      }, 100);
    }

    // Hide screens
    setShowEndScreen(false);
    setShowHighScoreEntry(false);

    // Set to ready state
    setGameState("ready");

    toast.info(`Retrying Level ${currentLevel}`);
  }, [
    level,
    settings.startingLives,
    settings.difficulty,
    initBricksForLevel,
    setPowerUps,
    createRandomLetterAssignments,
  ]);

  const toggleFullscreen = async () => {
    if (!fullscreenContainerRef.current) return;

    // Set flag before fullscreen change
    isTogglingFullscreenRef.current = true;

    // iOS doesn't support the Fullscreen API
    // Use CSS-based fullscreen instead
    if (isIOSDevice) {
      const entering = !isFullscreen;
      setIsFullscreen(entering);

      if (entering) {
        // Scroll to top to minimize Safari UI
        window.scrollTo(0, 0);
        // Prevent scrolling during gameplay
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
      } else {
        // Restore scrolling
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      }

      // Reset flag after a short delay
      setTimeout(() => {
        isTogglingFullscreenRef.current = false;
      }, 500);
      return;
    }

    // Standard Fullscreen API for other browsers
    try {
      if (!document.fullscreenElement) {
        // Try standard API
        if (fullscreenContainerRef.current.requestFullscreen) {
          await fullscreenContainerRef.current.requestFullscreen();
        }
        // Try webkit prefix (for older Safari on non-iOS)
        else if ((fullscreenContainerRef.current as any).webkitRequestFullscreen) {
          await (fullscreenContainerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }

    // Reset flag after a short delay to allow fullscreen change to complete
    setTimeout(() => {
      isTogglingFullscreenRef.current = false;
    }, 500);
  };

  // Listen for fullscreen changes
  useEffect(() => {
    // iOS doesn't fire fullscreenchange events
    if (isIOSDevice) return;

    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
      setIsFullscreen(isNowFullscreen);

      // On mobile: if exiting fullscreen and game is playing, pause and show prompt
      if (isMobileDevice && !isNowFullscreen && gameState === "playing") {
        setGameState("paused");
        if (gameLoopRef.current) {
          gameLoopRef.current.pause();
        }
        setShowFullscreenPrompt(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [isMobileDevice, gameState, isIOSDevice]);

  // Auto-enter fullscreen when game starts
  // - Desktop: Always auto-fullscreen
  // - Mobile (non-iOS): Auto-fullscreen
  // - iOS: Disabled (API not supported, user gesture required)
  useEffect(() => {
    const shouldAutoFullscreen =
      !isIOSDevice &&
      gameState === "ready" &&
      !isFullscreen &&
      !hasAutoFullscreenedRef.current &&
      fullscreenContainerRef.current;

    if (shouldAutoFullscreen) {
      hasAutoFullscreenedRef.current = true;
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        toggleFullscreen();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMobileDevice, isIOSDevice, gameState]);

  // F key to toggle fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // iOS Safari: Document-level gesture prevention when game is active
  useEffect(() => {
    if (!isIOSDevice) return;
    if (gameState !== "playing" && gameState !== "ready") return;

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    // Add aggressive gesture prevention at document level for iOS
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
    };
  }, [isIOSDevice, gameState]);

  // Adaptive header and frame visibility based on vertical space
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    const checkFrameVisibility = () => {
      if (!fullscreenContainerRef.current) return;
      const containerHeight = fullscreenContainerRef.current.clientHeight;
      const containerWidth = fullscreenContainerRef.current.clientWidth;
      const isMobile = containerWidth < 768; // Mobile breakpoint

      const titleBarHeight = 60;
      const statsBarHeight = 80;
      const bottomBarHeight = 60;
      const sideFrameHeight = 40;

      // Desktop-specific adaptive layout
      if (!isMobile) {
        const playableAreaHeight = SCALED_CANVAS_HEIGHT;
        const statsAndBottomHeight = statsBarHeight + bottomBarHeight + sideFrameHeight;
        const fullHeightNeeded = playableAreaHeight + titleBarHeight + statsAndBottomHeight;

        // Check if we need to hide title
        const shouldShowTitle = containerHeight >= fullHeightNeeded;
        if (!shouldShowTitle && !disableAutoZoom) {
          // Hide title and calculate scale
          const availableHeight = containerHeight - statsAndBottomHeight;
          const minimalTopMargin = 20;
          const scalableHeight = playableAreaHeight + minimalTopMargin;
          let scaleFactor = availableHeight / scalableHeight;

          // Clamp scale to prevent unreadably small UI
          const minScale = 0.5;
          scaleFactor = Math.max(minScale, Math.min(1.0, scaleFactor));
          if (titleVisible || gameScale !== scaleFactor) {
            setTitleVisible(false);
            setGameScale(scaleFactor);
            console.log(`[Desktop Layout] desktopLayoutMode: titleHidden, scale: ${scaleFactor.toFixed(2)}`);
          }
        } else {
          // Show title and reset scale
          if (!titleVisible || gameScale !== 1) {
            setTitleVisible(true);
            setGameScale(1);
            console.log(`[Desktop Layout] desktopLayoutMode: titleVisible, scale: 1.0`);
          }
        }

        // Stats and controls always visible on desktop
        if (!framesVisible) {
          setFramesVisible(true);
          setHeaderVisible(true);
        }
      } else {
        // Mobile: hide all frames when in fullscreen, otherwise check space
        if (isFullscreen) {
          // Force hide all frames in fullscreen on mobile
          if (framesVisible || headerVisible || titleVisible) {
            setFramesVisible(false);
            setHeaderVisible(false);
            setTitleVisible(false);
            setGameScale(1);
            console.log(`[Layout Debug] layoutMode: mobileFullscreenFramesHidden`);
          }
        } else {
          // Normal mobile behavior - hide all frames if constrained
          const requiredHeight =
            SCALED_CANVAS_HEIGHT + titleBarHeight + statsBarHeight + bottomBarHeight + sideFrameHeight;
          const shouldShowFrames = containerHeight >= requiredHeight;
          if (shouldShowFrames !== framesVisible) {
            setFramesVisible(shouldShowFrames);
            setHeaderVisible(shouldShowFrames);
            setTitleVisible(shouldShowFrames);
            setGameScale(1);
            const layoutMode = shouldShowFrames ? "headerVisible" : "headerHidden";
            console.log(`[Layout Debug] layoutMode: ${layoutMode}`);
          }
        }
      }
    };
    const debouncedCheck = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkFrameVisibility, 120);
    };

    // Check on mount and resize
    checkFrameVisibility();
    window.addEventListener("resize", debouncedCheck);
    const handleFullscreenChange = () => {
      setTimeout(checkFrameVisibility, 100);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener("resize", debouncedCheck);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [framesVisible, titleVisible, gameScale, disableAutoZoom, SCALED_CANVAS_HEIGHT, isFullscreen]);
  // Handle tap to resume fullscreen on mobile
  const handleFullscreenPromptClick = async () => {
    setShowFullscreenPrompt(false);
    await toggleFullscreen();
    setGameState("playing");
    if (gameLoopRef.current) {
      gameLoopRef.current.resume();
    }
  };

  return (
    <div
      ref={fullscreenContainerRef}
      className={`flex items-center justify-center ${
        isIOSDevice
          ? "ios-fullscreen-container" // Always use iOS container on iOS devices
          : isFullscreen
            ? "h-screen bg-background overflow-hidden"
            : "h-screen overflow-hidden"
      }`}
    >
      {/* CRT Overlay - inside fullscreen container (Phase 5: Toggle by debug setting) */}
      {qualitySettings.backgroundEffects && debugSettings.enableCRTEffects && <CRTOverlay quality={quality} />}

      {/* Mobile fullscreen prompt overlay */}
      {showFullscreenPrompt && isMobileDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={handleFullscreenPromptClick}
        >
          <div className="text-center p-8 bg-background/90 rounded-lg border-2 border-primary">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Game Paused</h2>
            <p className="text-lg text-muted-foreground mb-2">Tap to enter fullscreen</p>
            <p className="text-sm text-muted-foreground">and resume playing</p>
          </div>
        </div>
      )}

      {showEndScreen ? (
        <EndScreen
          onContinue={handleEndScreenContinue}
          onReturnToMenu={handleEndScreenReturnToMenu}
          onRetryLevel={handleRetryLevel}
          stats={{
            totalBricksDestroyed,
            totalShots,
            accuracy: totalShots > 0 ? (bricksHit / totalShots) * 100 : 0,
            levelSkipped,
            finalScore: score,
            finalLevel: level,
            powerUpsCollected: powerUpsCollectedTypes.size,
            bricksDestroyedByTurrets,
            enemiesKilled,
            bossesKilled,
            totalPlayTime: totalPlayTime,
            isVictory: gameState === "won",
          }}
        />
      ) : showHighScoreDisplay ? (
        <HighScoreDisplay onClose={handleCloseHighScoreDisplay} initialTab={isBossRush ? "bossRush" : "normal"} />
      ) : showBossRushScoreEntry ? (
        <BossRushScoreEntry
          score={score}
          completionTimeMs={bossRushCompletionTime}
          bossLevel={bossRushGameOverLevel}
          completed={bossRushGameOverLevel === 20}
          onSubmit={async (name) => {
            try {
              const { supabase } = await import("@/integrations/supabase/client");
              // Submit to boss_rush_scores table
              const response = await supabase.functions.invoke("submit-score", {
                body: {
                  type: "boss_rush",
                  player_name: name,
                  score: score,
                  completion_time_ms: bossRushCompletionTime,
                  boss_level: bossRushGameOverLevel,
                },
              });
              if (response.error) throw response.error;
              const result = response.data as { error?: string };
              if (result?.error) throw new Error(result.error);
              // Also submit to main high_scores table with boss_rush game_mode
              try {
                await addHighScore(
                  name,
                  score,
                  bossRushGameOverLevel,
                  settings.difficulty,
                  false,
                  false,
                  settings.startingLives,
                  "boss_rush",
                );
              } catch (_) {
                // Non-critical: boss rush score already saved above
              }
              toast.success("🎉 BOSS RUSH SCORE SAVED! 🎉");
            } catch (err) {
              console.error("Failed to submit boss rush score:", err);
              toast.error("Failed to submit boss rush score");
            }
            setShowBossRushScoreEntry(false);
            setShowHighScoreDisplay(true);
          }}
        />
      ) : (
        <>
          {showHighScoreEntry ? (
            <HighScoreEntry
              score={score}
              level={level}
              onSubmit={handleHighScoreSubmit}
              qualifiedLeaderboards={qualifiedLeaderboards || undefined}
            />
          ) : (
            <div
              ref={gameContainerRef}
              className={`metal-frame ${isIOSDevice ? "mobile-fullscreen-mode" : isMobileDevice && isFullscreen ? "mobile-fullscreen-mode" : ""}`}
            >
              {/* Title Bar - Adaptive Visibility (Desktop: only title hides, Mobile: all hides) */}
              <div
                className={`metal-title-bar transition-all duration-150 ${titleVisible ? "opacity-100 max-h-[60px]" : "opacity-0 max-h-0 overflow-hidden"}`}
                style={{
                  transform: titleVisible ? "translateY(0)" : "translateY(-10px)",
                  transition: "opacity 150ms ease-in-out, max-height 150ms ease-in-out, transform 150ms ease-in-out",
                }}
              >
                <h1
                  style={{
                    color: "hsl(0, 0%, 95%)",
                    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                  }}
                  className="text-2xl sm:text-3xl retro-pixel-text tracking-widest text-center lg:text-lg"
                >
                  Vibing Arkanoid
                </h1>
              </div>

              {/* Main Content with Side Panels */}
              <div className="metal-main-content">
                {/* Left Panel */}
                <div className="metal-side-panel metal-side-panel-left">
                  <div className="panel-decoration"></div>
                  <div className="panel-decoration"></div>
                  <div className="panel-decoration"></div>
                </div>

                {/* Game Canvas - Apply scale transform when title is hidden (desktop only) */}
                <div className="metal-game-area">
                  <div
                    ref={gameGlowRef}
                    className={`game-glow relative ${isFullscreen ? "game-canvas-wrapper" : ""}`}
                    style={
                      isMobileDevice
                        ? {
                            width: `${SCALED_CANVAS_WIDTH}px`,
                            height: `${SCALED_CANVAS_HEIGHT}px`,
                            transform: `scale(${gameScale})`,
                            transformOrigin: "top center",
                            transition: "transform 150ms ease-in-out",
                          }
                        : {
                            width: `${SCALED_CANVAS_WIDTH}px`,
                            height: `${SCALED_CANVAS_HEIGHT}px`,
                            transformOrigin: "top center",
                          }
                    }
                  >
                    <GameCanvas ref={canvasRef} width={SCALED_CANVAS_WIDTH} height={SCALED_CANVAS_HEIGHT} />

                    {/* Boss Power-Up Duration Timers - Desktop only (paddle-relative positioning) */}
                    {!isMobileDevice &&
                      paddle &&
                      (bossStunnerEndTime || reflectShieldEndTime || homingBallEndTime || fireballEndTime) && (
                        <div className="absolute pointer-events-none" style={{ inset: 0 }}>
                          {bossStunnerEndTime && Date.now() < bossStunnerEndTime && (
                            <div
                              className="absolute retro-pixel-text"
                              style={{
                                left: `${((paddle.x + paddle.width / 2) / SCALED_CANVAS_WIDTH) * 100}%`,
                                top: `${((paddle.y - 45) / SCALED_CANVAS_HEIGHT) * 100}%`,
                                transform: `translateX(-50%) scale(${1 + Math.sin(Date.now() * 0.01 * 4) * 0.1})`,
                                color: `hsl(${Math.max(0, 50 - (1 - (bossStunnerEndTime - Date.now()) / 5000) * 50)}, 100%, 50%)`,
                                textShadow: `0 0 10px currentColor`,
                                fontSize: "12px",
                                fontWeight: "bold",
                              }}
                            >
                              STUN: {((bossStunnerEndTime - Date.now()) / 1000).toFixed(1)}s
                            </div>
                          )}
                          {reflectShieldEndTime && Date.now() < reflectShieldEndTime && (
                            <div
                              className="absolute retro-pixel-text"
                              style={{
                                left: `${((paddle.x + paddle.width / 2) / SCALED_CANVAS_WIDTH) * 100}%`,
                                top: `${((paddle.y - 60) / SCALED_CANVAS_HEIGHT) * 100}%`,
                                transform: `translateX(-50%) scale(${1 + Math.sin(Date.now() * 0.01 * 4) * 0.1})`,
                                color: `hsl(${Math.max(0, 50 - (1 - (reflectShieldEndTime - Date.now()) / 15000) * 50)}, 100%, 50%)`,
                                textShadow: `0 0 10px currentColor`,
                                fontSize: "12px",
                                fontWeight: "bold",
                              }}
                            >
                              REFLECT: {((reflectShieldEndTime - Date.now()) / 1000).toFixed(1)}s
                            </div>
                          )}
                          {homingBallEndTime && Date.now() < homingBallEndTime && (
                            <div
                              className="absolute retro-pixel-text"
                              style={{
                                left: `${((paddle.x + paddle.width / 2) / SCALED_CANVAS_WIDTH) * 100}%`,
                                top: `${((paddle.y - 75) / SCALED_CANVAS_HEIGHT) * 100}%`,
                                transform: `translateX(-50%) scale(${1 + Math.sin(Date.now() * 0.01 * 4) * 0.1})`,
                                color: `hsl(${Math.max(0, 50 - (1 - (homingBallEndTime - Date.now()) / 8000) * 50)}, 100%, 50%)`,
                                textShadow: `0 0 10px currentColor`,
                                fontSize: "12px",
                                fontWeight: "bold",
                              }}
                            >
                              MAGNET: {((homingBallEndTime - Date.now()) / 1000).toFixed(1)}s
                            </div>
                          )}
                          {fireballEndTime && Date.now() < fireballEndTime && (
                            <div
                              className="absolute retro-pixel-text"
                              style={{
                                left: `${((paddle.x + paddle.width / 2) / SCALED_CANVAS_WIDTH) * 100}%`,
                                top: `${((paddle.y - 90) / SCALED_CANVAS_HEIGHT) * 100}%`,
                                transform: `translateX(-50%) scale(${1 + Math.sin(Date.now() * 0.01 * 4) * 0.1})`,
                                color: `hsl(${Math.max(0, 30 - (1 - (fireballEndTime - Date.now()) / FIREBALL_DURATION) * 30)}, 100%, 50%)`,
                                textShadow: `0 0 10px currentColor`,
                                fontSize: "12px",
                                fontWeight: "bold",
                              }}
                            >
                              FIREBALL: {((fireballEndTime - Date.now()) / 1000).toFixed(1)}s
                            </div>
                          )}
                        </div>
                      )}

                    {/* Bonus Letter Floating Text Tutorial - Desktop only */}
                    {!isMobileDevice && bonusLetterFloatingText?.active && bonusLetters.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none z-[150]">
                        {(() => {
                          const letter = bonusLetters[0];
                          const elapsed = Date.now() - bonusLetterFloatingText.startTime;
                          const duration = 4000;

                          if (elapsed >= duration) {
                            setTimeout(() => setBonusLetterFloatingText(null), 0);
                            return null;
                          }

                          const zoomPhase = (elapsed / 500) * Math.PI;
                          const zoomScale = 1 + Math.sin(zoomPhase) * 0.3;
                          const opacity =
                            elapsed < 500 ? elapsed / 500 : elapsed > duration - 500 ? (duration - elapsed) / 500 : 1;

                          return (
                            <div
                              className="absolute retro-pixel-text text-center whitespace-nowrap"
                              style={{
                                left: `${((letter.x + letter.width / 2) / SCALED_CANVAS_WIDTH) * 100}%`,
                                top: `${((letter.y - 35) / SCALED_CANVAS_HEIGHT) * 100}%`,
                                transform: `translateX(-50%) scale(${zoomScale})`,
                                color: "hsl(48, 100%, 60%)",
                                textShadow: "0 0 10px hsl(48, 100%, 60%), 0 0 20px hsl(48, 100%, 50%)",
                                fontSize: "14px",
                                fontWeight: "bold",
                                opacity,
                              }}
                            >
                              Catch all letters for megabonus!
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════
                         ████████╗ DEBUG OVERLAYS - REMOVE BEFORE PRODUCTION ████████╗
                         ═══════════════════════════════════════════════════════════════ */}
                    {ENABLE_DEBUG_FEATURES && (
                      <>
                        {debugSettings.showGameLoopDebug && gameLoopRef.current && (
                          <GameLoopDebugOverlay
                            getDebugInfo={() =>
                              gameLoopRef.current?.getDebugInfo() ?? {
                                fps: 0,
                                frameTick: 0,
                                timeScale: DEFAULT_TIME_SCALE,
                                maxDeltaMs: MAX_DELTA_MS,
                                fpsCapMs: 0,
                              }
                            }
                            actualFps={currentFps}
                            visible={debugSettings.showGameLoopDebug}
                          />
                        )}
                        {debugSettings.showPowerUpWeights && (
                          <PowerUpWeightsOverlay
                            dropCounts={powerUpDropCounts}
                            difficulty={settings.difficulty}
                            currentLevel={level}
                            extraLifeUsedLevels={extraLifeUsedLevels}
                            visible={debugSettings.showPowerUpWeights}
                          />
                        )}
                      </>
                    )}
                    {/* ═══════════════════════════════════════════════════════════════ */}

                    {/* Get Ready Overlay - inside scaled container for correct positioning */}
                    {getReadyActive && balls.length > 0 && (
                      <GetReadyOverlay
                        ballPosition={{ x: balls[0].x, y: balls[0].y }}
                        canvasWidth={SCALED_CANVAS_WIDTH}
                        canvasHeight={SCALED_CANVAS_HEIGHT}
                        isMobile={isMobileDevice}
                        onComplete={() => {
                          setGetReadyActive(false);
                          setSpeedMultiplier(baseSpeedMultiplierRef.current);
                          getReadyStartTimeRef.current = null;
                          // Clear mobile glow
                          setGetReadyGlow(null);
                          getReadyGlowStartTimeRef.current = null;
                        }}
                      />
                    )}

                    {/* Tutorial Overlay - INSIDE scaled container for correct positioning */}
                    {tutorialStep && tutorialActive && (
                      <TutorialOverlay
                        step={tutorialStep}
                        onDismiss={() => {
                          // Resume game FIRST if it was paused for tutorial (before dismissTutorial sets tutorialActive=false)
                          if (tutorialStep.pauseGame) {
                            // Store current speed multiplier and start "Get Ready" sequence
                            baseSpeedMultiplierRef.current = speedMultiplier;
                            setSpeedMultiplier(speedMultiplier * 0.1); // Start at 10% speed
                            getReadyStartTimeRef.current = Date.now();
                            setGetReadyActive(true);

                            // Start mobile glow effect
                            if (isMobileDevice) {
                              getReadyGlowStartTimeRef.current = Date.now();
                              setGetReadyGlow({ opacity: 1 });
                            }

                            setGameState("playing");
                            // Re-acquire pointer lock for mouse control (desktop only)
                            if (!isMobileDevice) {
                              const canvas = canvasRef.current;
                              if (canvas && canvas.requestPointerLock) {
                                canvas.requestPointerLock();
                              }
                            }
                            if (gameLoopRef.current) {
                              gameLoopRef.current.resume();
                            }
                          }
                          // Then dismiss tutorial (sets tutorialActive = false)
                          dismissTutorial();
                        }}
                        onSkipAll={() => {
                          // Resume game FIRST before skipping tutorials
                          if (gameState === "paused") {
                            // Also trigger "Get Ready" when skipping
                            baseSpeedMultiplierRef.current = speedMultiplier;
                            setSpeedMultiplier(speedMultiplier * 0.1);
                            getReadyStartTimeRef.current = Date.now();
                            setGetReadyActive(true);

                            // Start mobile glow effect
                            if (isMobileDevice) {
                              getReadyGlowStartTimeRef.current = Date.now();
                              setGetReadyGlow({ opacity: 1 });
                            }

                            setGameState("playing");
                            // Re-acquire pointer lock for mouse control (desktop only)
                            if (!isMobileDevice) {
                              const canvas = canvasRef.current;
                              if (canvas && canvas.requestPointerLock) {
                                canvas.requestPointerLock();
                              }
                            }
                            if (gameLoopRef.current) {
                              gameLoopRef.current.resume();
                            }
                          }
                          skipAllTutorials();
                        }}
                        isPaused={tutorialStep.pauseGame}
                        isSlowMotion={false}
                        highlightPosition={
                          tutorialStep.highlight?.type === "power_up" && powerUps.length > 0
                            ? {
                                x: powerUps[0].x,
                                y: powerUps[0].y,
                                width: powerUps[0].width,
                                height: powerUps[0].height,
                                type: powerUps[0].type,
                              }
                            : tutorialStep.highlight?.type === "boss" && boss
                              ? {
                                  x: boss.x,
                                  y: boss.y,
                                  width: boss.width,
                                  height: boss.height,
                                  type: "boss",
                                  bossType: boss.type,
                                }
                              : tutorialStep.highlight?.type === "enemy" && enemies.length > 0
                                ? {
                                    x: enemies[0].x,
                                    y: enemies[0].y,
                                    width: enemies[0].width,
                                    height: enemies[0].height,
                                    type: "enemy",
                                  }
                                : null
                        }
                        canvasWidth={SCALED_CANVAS_WIDTH}
                        canvasHeight={SCALED_CANVAS_HEIGHT}
                      />
                    )}
                  </div>

                  {/* Boss Victory Celebration Overlay - only shown in normal mode, not Boss Rush */}
                  <BossVictoryOverlay
                    active={bossVictoryOverlayActive && !isBossRush}
                    onComplete={() => setBossVictoryOverlayActive(false)}
                    showExtraLife={settings.difficulty !== "godlike" ? true : false}
                  />

                  {/* Boss Rush Stats Overlay */}
                  <BossRushStatsOverlay
                    active={bossRushStatsOverlayActive && isBossRush}
                    currentTime={
                      bossRushTimeSnapshot !== null
                        ? bossRushTimeSnapshot
                        : bossRushStartTime
                          ? Date.now() - bossRushStartTime
                          : 0
                    }
                    bossName={BOSS_RUSH_CONFIG.bossNames[BOSS_RUSH_CONFIG.bossOrder[bossRushIndex]]}
                    bossIndex={bossRushIndex}
                    livesLostThisBoss={bossRushLivesLostThisBoss}
                    powerUpsThisBoss={bossRushPowerUpsThisBoss}
                    enemiesKilledThisBoss={bossRushEnemiesThisBoss}
                    accuracyThisBoss={
                      bossRushShotsThisBoss > 0 ? (bossRushHitsThisBoss / bossRushShotsThisBoss) * 100 : 0
                    }
                    totalLivesLost={bossRushTotalLivesLost}
                    totalPowerUpsCollected={bossRushTotalPowerUps}
                    totalEnemiesKilled={bossRushTotalEnemiesKilled}
                    totalAccuracy={
                      bossRushTotalShots + bossRushShotsThisBoss > 0
                        ? ((bossRushTotalHits + bossRushHitsThisBoss) / (bossRushTotalShots + bossRushShotsThisBoss)) *
                          100
                        : 0
                    }
                    livesRemaining={lives}
                    onContinue={() => {
                      statsOverlayJustClosedRef.current = Date.now();
                      setBossRushStatsOverlayActive(false);
                      setBossRushTimeSnapshot(null); // Clear time snapshot
                      soundManager.stopBossMusic();
                      // Accumulate per-boss stats into totals BEFORE resetting
                      setBossRushTotalShots((prev) => prev + bossRushShotsThisBoss);
                      setBossRushTotalHits((prev) => prev + bossRushHitsThisBoss);
                      // Reset per-boss stats
                      setBossRushLivesLostThisBoss(0);
                      setBossRushPowerUpsThisBoss(0);
                      setBossRushEnemiesThisBoss(0);
                      setBossRushShotsThisBoss(0);
                      setBossRushHitsThisBoss(0);
                      ballsPendingHitRef.current.clear();
                      // Resume game and proceed to next boss
                      gameLoopRef.current?.resume();
                      nextLevel();
                    }}
                  />

                  {/* Boss Rush Victory Overlay */}
                  <BossRushVictoryOverlay
                    active={showBossRushVictory}
                    score={score - BOSS_RUSH_CONFIG.completionBonus}
                    onComplete={() => {
                      setShowBossRushVictory(false);
                      setBossRushGameOverLevel(20); // Completed all bosses
                      if (bossRushCompletionTime > 0) {
                        setShowBossRushScoreEntry(true);
                      } else {
                        setGameState("gameOver");
                        setShowEndScreen(true);
                      }
                    }}
                  />

                  {/* Pause Overlay - only show when NOT in tutorial mode */}
                  {gameState === "paused" && !showDebugDashboard && !tutorialActive && (
                    <div className="absolute inset-0 flex items-start justify-center bg-black/70 z-50 pt-4 md:pt-16 overflow-y-auto">
                      <div className="bg-slate-900/95 border-4 border-cyan-500 rounded-lg p-4 md:p-8 max-w-md relative mx-2 my-2 max-h-[90vh] overflow-y-auto">
                        {/* X button for mobile - positioned in top right corner */}
                        {isMobileDevice && (
                          <button
                            onClick={() => {
                              setGameState("playing");
                              gameLoopRef.current?.start();
                            }}
                            className="absolute top-2 right-2 text-white hover:text-cyan-300 transition-colors p-2"
                            title="Resume Game"
                          >
                            <X size={28} />
                          </button>
                        )}

                        <h2
                          className="retro-pixel-text text-xl md:text-2xl mb-3 md:mb-6 text-center animate-pulse"
                          style={{ color: "hsl(48, 100%, 60%)" }}
                        >
                          GAME PAUSED
                        </h2>

                        <div className="space-y-2 md:space-y-3 text-white retro-pixel-text text-xs md:text-sm">
                          <div className="border-b border-cyan-500/30 pb-2 md:pb-3 mb-2 md:mb-4">
                            <div className="flex justify-between items-center">
                              <span className="text-cyan-300 font-bold">ESC or P</span>
                              <span>Resume Game</span>
                            </div>
                          </div>

                          <h3 className="text-cyan-400 font-bold text-sm md:text-base mb-1 md:mb-2">Controls:</h3>
                          <div className="flex justify-between">
                            <span className="text-cyan-300">Mouse/Touch</span>
                            <span>Move Paddle</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-cyan-300">Mouse Click</span>
                            <span>Launch Ball</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-cyan-300">Mouse Click</span>
                            <span>Fire Turrets</span>
                          </div>

                          <h3 className="text-cyan-400 font-bold text-sm md:text-base mt-2 md:mt-4 mb-1 md:mb-2">
                            Game:
                          </h3>
                          <div className="flex justify-between">
                            <span className="text-cyan-300">F</span>
                            <span>Fullscreen Toggle</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-cyan-300">M</span>
                            <span>Mute Music</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-cyan-300">N</span>
                            <span>Next Track</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-cyan-300">B</span>
                            <span>Previous Track</span>
                          </div>
                        </div>

                        <div
                          className="mt-2 md:mt-4 text-center retro-pixel-text text-[10px] md:text-xs animate-pulse"
                          style={{ color: "hsl(48, 100%, 60%)" }}
                        >
                          Press ESC or P to continue
                        </div>

                        <div className="flex gap-2 md:gap-4 mt-3 md:mt-6 w-full">
                          <Button
                            onClick={() => {
                              soundManager.playMenuClick();
                              setGameState("playing");
                              // Only resume music if it's not already playing
                              if (!soundManager.isMusicPlaying() && !soundManager.isBossMusicPlaying()) {
                                soundManager.resumeBackgroundMusic();
                              }
                              const canvas = canvasRef.current;
                              if (canvas && canvas.requestPointerLock) {
                                canvas.requestPointerLock();
                              }
                              if (gameLoopRef.current) {
                                gameLoopRef.current.resume();
                              }
                            }}
                            onMouseEnter={() => soundManager.playMenuHover()}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs md:text-sm py-2 md:py-3 retro-pixel-text"
                          >
                            RESUME
                          </Button>
                          <Button
                            onClick={() => {
                              hasAutoFullscreenedRef.current = false;
                              soundManager.stopBackgroundMusic();
                              soundManager.stopBossMusic();
                              soundManager.playMenuClick();
                              onReturnToMenu();
                            }}
                            onMouseEnter={() => soundManager.playMenuHover()}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm py-2 md:py-3 retro-pixel-text"
                          >
                            MAIN MENU
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tutorial Overlay moved inside scaled game-glow container above */}

                {/* Mobile Controls - Pause button, Music toggle, Debug button */}
                <MobileGameControls
                  isMobileDevice={isMobileDevice}
                  gameState={gameState}
                  setGameState={setGameState}
                  gameLoopRef={gameLoopRef}
                  musicEnabled={musicEnabled}
                  setMusicEnabled={setMusicEnabled}
                  showFullscreenPrompt={showFullscreenPrompt}
                  onFullscreenPromptClick={handleFullscreenPromptClick}
                  showDebugDashboard={showDebugDashboard}
                  setShowDebugDashboard={setShowDebugDashboard}
                />

                {/* ═══════════════════════════════════════════════════════════════
                     ████████╗ DEBUG UI COMPONENTS - REMOVE BEFORE PRODUCTION ████████╗
                     ═══════════════════════════════════════════════════════════════ */}
                {ENABLE_DEBUG_FEATURES && (
                  <>
                    {/* Debug Mode Indicator */}
                    {debugSettings.showDebugModeIndicator && (
                      <DebugModeIndicator
                        activeFeatureCount={calculateActiveDebugFeatures(debugSettings)}
                        onToggle={() => toggleDebugSetting("showDebugModeIndicator")}
                      />
                    )}

                    {/* Debug Dashboard */}
                    <DebugDashboard
                      isOpen={showDebugDashboard}
                      onClose={() => setShowDebugDashboard(false)}
                      settings={debugSettings}
                      onToggle={toggleDebugSetting}
                      onReset={resetDebugSettings}
                    />

                    {/* Mobile Debug Button is now in MobileGameControls */}

                    {/* Quality Indicator - Always visible */}
                    <QualityIndicator quality={quality} autoAdjustEnabled={autoAdjustEnabled} fps={currentFps} />

                    {/* Substep Debug Overlay */}
                    <SubstepDebugOverlay getDebugInfo={getSubstepDebugInfo} visible={debugSettings.showSubstepDebug} />

                    {/* Frame Profiler Overlay - Phase 1 */}
                    <FrameProfilerOverlay visible={debugSettings.showFrameProfiler} />

                    {/* Pool Stats Overlay */}
                    <PoolStatsOverlay visible={debugSettings.showPoolStats} />

                    {/* Collision History Viewer */}
                    {debugSettings.showCollisionHistory && (
                      <CollisionHistoryViewer onClose={() => toggleDebugSetting("showCollisionHistory")} />
                    )}

                    {/* CCD Performance Profiler */}
                    <CCDPerformanceOverlay
                      getPerformanceData={() => {
                        if (!ccdPerformanceRef.current) return null;
                        const stats = ccdPerformanceTrackerRef.current.getStats();
                        return {
                          ...ccdPerformanceRef.current,
                          rollingAvg: {
                            bossFirstUs: stats.bossFirst.avg,
                            ccdCoreUs: stats.ccdCore.avg,
                            postProcessingUs: stats.postProcessing.avg,
                            totalUs: stats.total.avg,
                            substeps: stats.substeps.avg,
                            collisions: stats.collisions.avg,
                            toiIterations: stats.toiIterations.avg,
                          },
                          peaks: {
                            bossFirstUs: stats.bossFirst.max,
                            ccdCoreUs: stats.ccdCore.max,
                            postProcessingUs: stats.postProcessing.max,
                            totalUs: stats.total.max,
                          },
                        };
                      }}
                      visible={debugSettings.showCCDPerformance}
                    />
                  </>
                )}
                {/* ═══════════════════════════════════════════════════════════════ */}

                {/* Right Panel - Stats and Controls */}
                <div
                  className={`metal-side-panel metal-side-panel-right transition-all duration-150 ${framesVisible ? "opacity-100" : "opacity-0"}`}
                >
                  {/* Control Buttons */}
                  <div className="flex flex-col gap-2 mb-4">
                    <button onClick={onReturnToMenu} className="right-panel-btn" title="Return to Main Menu">
                      <Home size={20} />
                    </button>
                    {!isIOSDevice && (
                      <button
                        onClick={toggleFullscreen}
                        className="right-panel-btn"
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                      >
                        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                      </button>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex flex-col gap-3">
                    {/* Score */}
                    <div className="right-stat-box">
                      <div className="right-stat-label" style={{ color: "hsl(180, 70%, 60%)" }}>
                        SCORE
                      </div>
                      <div className={`right-stat-value ${scoreBlinking ? "animate-pulse" : ""}`}>
                        {score.toString().padStart(6, "0")}
                      </div>
                    </div>

                    {/* Level */}
                    <div className="right-stat-box">
                      <div className="right-stat-label" style={{ color: "hsl(30, 75%, 55%)" }}>
                        LEVEL
                      </div>
                      <div className="right-stat-value">{level.toString().padStart(2, "0")}</div>
                    </div>

                    {/* Lives */}
                    <div className="right-stat-box">
                      <div className="right-stat-label" style={{ color: "hsl(0, 70%, 55%)" }}>
                        LIVES
                      </div>
                      <div className="right-stat-value">{lives}</div>
                    </div>

                    {/* Timer */}
                    <div className="right-stat-box">
                      <div className="right-stat-label" style={{ color: "hsl(210, 60%, 55%)" }}>
                        TIMER
                      </div>
                      <div className="right-stat-value">{timer}s</div>
                    </div>

                    {/* Speed */}
                    <div className="right-stat-box">
                      <div className="right-stat-label" style={{ color: "hsl(120, 50%, 50%)" }}>
                        SPEED
                      </div>
                      <div className="right-stat-value">{Math.round(speedMultiplier * 100)}%</div>
                    </div>

                    {/* Turret Ammo - Only show when turrets are active */}
                    {paddle?.hasTurrets && paddle?.turretShots !== undefined && (
                      <div className="right-stat-box">
                        <div
                          className="right-stat-label"
                          style={{
                            color: paddle.turretShots <= 5 ? "hsl(0, 80%, 60%)" : "hsl(280, 60%, 60%)",
                          }}
                        >
                          AMMO
                        </div>
                        <div
                          className={`right-stat-value ${paddle.turretShots <= 5 ? "animate-pulse" : ""}`}
                          style={{
                            color: paddle.turretShots <= 5 ? "hsl(0, 80%, 65%)" : "hsl(0, 0%, 85%)",
                          }}
                        >
                          {paddle.turretShots}
                        </div>
                      </div>
                    )}

                    {/* Boss Cooldown - Only show when boss is active and cooldown > 0 */}
                    {boss && bossHitCooldown > 0 && (
                      <div className="right-stat-box">
                        <div className="right-stat-label" style={{ color: "hsl(0, 80%, 60%)" }}>
                          BOSS CD
                        </div>
                        <div className="right-stat-value animate-pulse" style={{ color: "hsl(0, 80%, 65%)" }}>
                          {(bossHitCooldown / 1000).toFixed(1)}s
                        </div>
                      </div>
                    )}

                    {/* Hit Streak - Only show on boss levels */}
                    {(BOSS_LEVELS.includes(level) || level === MEGA_BOSS_LEVEL) && (
                      <>
                        <div className="right-stat-box">
                          <div className="right-stat-label" style={{ color: "hsl(48, 90%, 55%)" }}>
                            STREAK
                          </div>
                          <div
                            className={`right-stat-value ${hitStreak >= 5 ? "animate-pulse" : ""}`}
                            style={{ color: hitStreak > 0 ? "hsl(48, 100%, 60%)" : "hsl(0, 0%, 50%)" }}
                          >
                            {hitStreak > 0 ? `x${hitStreak}` : "---"}
                          </div>
                        </div>
                        <div className="right-stat-box">
                          <div className="right-stat-label" style={{ color: "hsl(48, 90%, 55%)" }}>
                            BONUS
                          </div>
                          <div
                            className={`right-stat-value ${hitStreak >= 5 ? "animate-pulse" : ""}`}
                            style={{ color: hitStreak > 0 ? "hsl(48, 100%, 60%)" : "hsl(0, 0%, 50%)" }}
                          >
                            {hitStreak > 0 ? `+${hitStreak}%` : "---"}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Power-Up Timers - Outside scaled container for correct positioning */}
              {isMobileDevice &&
                paddle &&
                (bossStunnerEndTime || reflectShieldEndTime || homingBallEndTime || fireballEndTime) && (
                  <div className="flex justify-center items-center gap-3 py-2 retro-pixel-text text-xs font-bold pointer-events-none">
                    {bossStunnerEndTime && Date.now() < bossStunnerEndTime && (
                      <span
                        style={{
                          color: `hsl(${Math.max(0, 50 - (1 - (bossStunnerEndTime - Date.now()) / 5000) * 50)}, 100%, 50%)`,
                          textShadow: "0 0 8px currentColor",
                          transform: `scale(${1 + Math.sin(Date.now() * 0.04) * 0.1})`,
                          display: "inline-block",
                        }}
                      >
                        STUN: {((bossStunnerEndTime - Date.now()) / 1000).toFixed(1)}s
                      </span>
                    )}
                    {reflectShieldEndTime && Date.now() < reflectShieldEndTime && (
                      <span
                        style={{
                          color: `hsl(${Math.max(0, 50 - (1 - (reflectShieldEndTime - Date.now()) / 15000) * 50)}, 100%, 50%)`,
                          textShadow: "0 0 8px currentColor",
                          transform: `scale(${1 + Math.sin(Date.now() * 0.04) * 0.1})`,
                          display: "inline-block",
                        }}
                      >
                        REFLECT: {((reflectShieldEndTime - Date.now()) / 1000).toFixed(1)}s
                      </span>
                    )}
                    {homingBallEndTime && Date.now() < homingBallEndTime && (
                      <span
                        style={{
                          color: `hsl(${Math.max(0, 50 - (1 - (homingBallEndTime - Date.now()) / 8000) * 50)}, 100%, 50%)`,
                          textShadow: "0 0 8px currentColor",
                          transform: `scale(${1 + Math.sin(Date.now() * 0.04) * 0.1})`,
                          display: "inline-block",
                        }}
                      >
                        MAGNET: {((homingBallEndTime - Date.now()) / 1000).toFixed(1)}s
                      </span>
                    )}
                    {fireballEndTime && Date.now() < fireballEndTime && (
                      <span
                        style={{
                          color: `hsl(${Math.max(0, 30 - (1 - (fireballEndTime - Date.now()) / FIREBALL_DURATION) * 30)}, 100%, 50%)`,
                          textShadow: "0 0 8px currentColor",
                          transform: `scale(${1 + Math.sin(Date.now() * 0.04) * 0.1})`,
                          display: "inline-block",
                        }}
                      >
                        FIREBALL: {((fireballEndTime - Date.now()) / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                )}

              {/* Mobile Bonus Letter Tutorial - Outside scaled container */}
              {isMobileDevice &&
                bonusLetterFloatingText?.active &&
                bonusLetters.length > 0 &&
                (() => {
                  const elapsed = Date.now() - bonusLetterFloatingText.startTime;
                  const duration = 4000;

                  if (elapsed >= duration) {
                    setTimeout(() => setBonusLetterFloatingText(null), 0);
                    return null;
                  }

                  const zoomPhase = (elapsed / 500) * Math.PI;
                  const zoomScale = 1 + Math.sin(zoomPhase) * 0.3;
                  const opacity =
                    elapsed < 500 ? elapsed / 500 : elapsed > duration - 500 ? (duration - elapsed) / 500 : 1;

                  return (
                    <div
                      className="flex justify-center py-1 retro-pixel-text text-xs font-bold pointer-events-none"
                      style={{
                        color: "hsl(48, 100%, 60%)",
                        textShadow: "0 0 10px hsl(48, 100%, 60%), 0 0 20px hsl(48, 100%, 50%)",
                        transform: `scale(${zoomScale})`,
                        opacity,
                      }}
                    >
                      Catch all letters for megabonus!
                    </div>
                  );
                })()}

              {/* Compact HUD Overlay - Shown when frames are hidden */}
              {!framesVisible && (
                <div
                  className="fixed top-4 left-4 z-50 flex flex-col gap-2 pointer-events-none"
                  style={{
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
                  <div className="flex gap-4 items-center bg-black/30 backdrop-blur-sm px-3 py-2 rounded">
                    <div
                      className="retro-pixel-text text-xs"
                      style={{
                        color: "hsl(180, 70%, 60%)",
                      }}
                    >
                      SCORE:{" "}
                      <span
                        style={{
                          color: "hsl(0, 0%, 95%)",
                        }}
                      >
                        {score.toString().padStart(6, "0")}
                      </span>
                    </div>
                    <div
                      className="retro-pixel-text text-xs"
                      style={{
                        color: "hsl(30, 75%, 55%)",
                      }}
                    >
                      LV:{" "}
                      <span
                        style={{
                          color: "hsl(0, 0%, 95%)",
                        }}
                      >
                        {level.toString().padStart(2, "0")}
                      </span>
                    </div>
                    <div
                      className="retro-pixel-text text-xs"
                      style={{
                        color: "hsl(0, 70%, 55%)",
                      }}
                    >
                      LIVES:{" "}
                      <span
                        style={{
                          color: "hsl(0, 0%, 95%)",
                        }}
                      >
                        {lives}
                      </span>
                    </div>
                    {boss && bossHitCooldown > 0 && (
                      <div
                        className="retro-pixel-text text-xs animate-pulse"
                        style={{
                          color: "hsl(0, 80%, 60%)",
                        }}
                      >
                        BOSS CD:{" "}
                        <span
                          style={{
                            color: "hsl(0, 80%, 70%)",
                          }}
                        >
                          {(bossHitCooldown / 1000).toFixed(1)}s
                        </span>
                      </div>
                    )}
                    {(BOSS_LEVELS.includes(level) || level === MEGA_BOSS_LEVEL) && hitStreak > 0 && (
                      <div
                        className={`retro-pixel-text text-xs ${hitStreak >= 5 ? "animate-pulse" : ""}`}
                        style={{ color: "hsl(48, 100%, 60%)" }}
                      >
                        STREAK: x{hitStreak} (+{hitStreak}%)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom Controls - Adaptive Visibility */}
              <div
                className={`metal-bottom-bar transition-all duration-150 ${framesVisible ? "opacity-100 max-h-[80px]" : "opacity-0 max-h-0 overflow-hidden"}`}
                style={{
                  transform: framesVisible ? "translateY(0)" : "translateY(10px)",
                }}
              >
                <div className="flex gap-4 justify-center items-center">
                  {gameState === "ready" && (
                    <button
                      onClick={handleStart}
                      className="amiga-box px-8 py-3 retro-pixel-text hover:bg-muted/50 transition-all text-sm"
                      style={{
                        color: "hsl(0, 0%, 85%)",
                      }}
                    >
                      {bricks.every((brick) => !brick.visible) && level > 0 ? "NEXT LEVEL" : "START GAME"}
                    </button>
                  )}
                  {(gameState === "gameOver" || gameState === "won") && (
                    <button
                      onClick={handleRestart}
                      className="amiga-box px-8 py-3 retro-pixel-text hover:bg-muted/50 transition-all text-sm"
                      style={{
                        color: "hsl(0, 0%, 85%)",
                      }}
                    >
                      PLAY AGAIN
                    </button>
                  )}
                  {gameState === "playing" && (
                    <div
                      className="retro-pixel-text text-xs"
                      style={{
                        color: "hsl(0, 0%, 60%)",
                      }}
                    >
                      Move your mouse or touch to control the paddle • Press ESC to pause • Click Canvas to Capture
                      Mouse
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
