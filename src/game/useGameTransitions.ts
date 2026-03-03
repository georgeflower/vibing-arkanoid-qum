/**
 * game/useGameTransitions.ts — Unified game transition handlers.
 *
 * Extracted from Game.tsx to reduce component size.
 * Contains: handleGameOver, handleSurviveDeath, handleBossDefeat
 *
 * These three handlers standardize all death, victory, and boss-defeat transitions
 * to ensure consistent physics reset, entity cleanup, and state management.
 */

import { useCallback } from "react";
import type { Ball, Boss, Paddle, PowerUp, PowerUpType, EnemyType, Particle, GameState } from "@/types/game";
import { world } from "@/engine/state";
import { bulletPool } from "@/utils/entityPool";
import { soundManager } from "@/utils/sounds";
import { debugToast as toast } from "@/utils/debugToast";
import { particlePool } from "@/utils/particlePool";
import { BOSS_RUSH_CONFIG, type BossRushLevel } from "@/constants/bossRushConfig";
import { POWERUP_SIZE, POWERUP_FALL_SPEED } from "@/constants/game";

interface TransitionDeps {
  // State setters
  setGameState: (state: GameState) => void;
  setScore: (updater: number | ((prev: number) => number)) => void;
  setLives: (updater: number | ((prev: number) => number)) => void;
  setBalls: (updater: Ball[] | ((prev: Ball[]) => Ball[])) => void;
  setPaddle: (updater: Paddle | null | ((prev: Paddle | null) => Paddle | null)) => void;
  setBossAttacks: (updater: any[] | ((prev: any[]) => any[])) => void;
  setLaserWarnings: (updater: any[] | ((prev: any[]) => any[])) => void;
  setBonusLetters: (updater: any[] | ((prev: any[]) => any[])) => void;
  setExplosions: (updater: any[] | ((prev: any[]) => any[])) => void;
  setPowerUps: (updater: PowerUp[] | ((prev: PowerUp[]) => PowerUp[])) => void;
  setSpeedMultiplier: (updater: number | ((prev: number) => number)) => void;
  setBrickHitSpeedAccumulated: (updater: number | ((prev: number) => number)) => void;
  setTimer: (val: number) => void;
  setLastEnemySpawnTime: (updater: number | ((prev: number) => number)) => void;
  setShowInstructions: (val: boolean) => void;
  setLaunchAngle: (updater: number | ((prev: number) => number)) => void;
  setShowHighScoreEntry: (val: boolean) => void;
  setShowEndScreen: (val: boolean) => void;
  setBossActive: (updater: boolean | ((prev: boolean) => boolean)) => void;
  setBossDefeatedTransitioning: (val: boolean) => void;
  setBossVictoryOverlayActive: (val: boolean) => void;
  setBossesKilled: (updater: number | ((prev: number) => number)) => void;
  setLivesLostOnCurrentLevel: (updater: number | ((prev: number) => number)) => void;
  setShowBossRushScoreEntry: (val: boolean) => void;
  setBossRushGameOverLevel: (val: number) => void;
  setBossRushCompletionTime: (val: number) => void;
  setQualifiedLeaderboards: (val: { daily: boolean; weekly: boolean; allTime: boolean } | null) => void;

  // Helpers
  clearAllEnemies: () => void;
  clearAllBombs: () => void;
  clearAllPowerUpTimers: () => void;
  createExplosionParticles: (x: number, y: number, enemyType: EnemyType) => Particle[];

  // Refs
  scoreRef: React.MutableRefObject<number>;
  nextBallIdRef: React.MutableRefObject<number>;
  launchAngleDirectionRef: React.MutableRefObject<number>;
  bombIntervalsRef: React.MutableRefObject<Map<number, NodeJS.Timeout>>;
  nextLevelRef: React.MutableRefObject<(() => void) | null>;
  gameLoopRef: React.MutableRefObject<any>;
  bossRushStartTime: number | null;
  bossRushTimeSnapshot: number | null;

  // Boss Rush setters
  setBossRushTimeSnapshot: (val: number | null) => void;
  setBossRushStatsOverlayActive: (val: boolean) => void;
  setBossRushLivesLostThisBoss: (updater: number | ((prev: number) => number)) => void;
  setBossRushTotalLivesLost: (updater: number | ((prev: number) => number)) => void;

  // Config
  isBossRush: boolean;
  bossRushIndex: number;
  levelSkipped: boolean;
  scaledCanvasWidth: number;
  scaledCanvasHeight: number;
  scaledPaddleStartY: number;
  scaledBallRadius: number;
  scaledPaddleWidth: number;
  difficulty: string;

  // High score
  getQualifiedLeaderboards: (score: number) => Promise<{ daily: boolean; weekly: boolean; allTime: boolean }>;
}

export function useGameTransitions(deps: TransitionDeps) {
  const {
    setGameState, setScore, setLives, setBalls, setPaddle, setBossAttacks,
    setLaserWarnings, setBonusLetters, setExplosions, setPowerUps,
    setSpeedMultiplier, setBrickHitSpeedAccumulated, setTimer, setLastEnemySpawnTime,
    setShowInstructions, setLaunchAngle, setShowHighScoreEntry, setShowEndScreen,
    setBossActive, setBossDefeatedTransitioning, setBossVictoryOverlayActive,
    setBossesKilled, setLivesLostOnCurrentLevel, setShowBossRushScoreEntry,
    setBossRushGameOverLevel, setBossRushCompletionTime, setQualifiedLeaderboards,
    clearAllEnemies, clearAllBombs, clearAllPowerUpTimers, createExplosionParticles,
    scoreRef, nextBallIdRef, launchAngleDirectionRef, bombIntervalsRef,
    nextLevelRef, gameLoopRef,
    bossRushStartTime, setBossRushTimeSnapshot, setBossRushStatsOverlayActive,
    setBossRushLivesLostThisBoss, setBossRushTotalLivesLost,
    isBossRush, bossRushIndex, levelSkipped,
    scaledCanvasWidth, scaledCanvasHeight, scaledPaddleStartY,
    scaledBallRadius, scaledPaddleWidth, difficulty,
    getQualifiedLeaderboards,
  } = deps;

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
  const handleSurviveDeath = useCallback((toastMessage: string, opts?: { spawnMercy?: boolean }) => {
    const baseSpeed = 4.5;
    const initialAngle = (-20 * Math.PI) / 180;
    const resetBall: Ball = {
      x: scaledCanvasWidth / 2,
      y: scaledCanvasHeight - scaledPaddleStartY,
      dx: baseSpeed * Math.sin(initialAngle),
      dy: -baseSpeed * Math.cos(initialAngle),
      radius: scaledBallRadius,
      speed: baseSpeed,
      id: nextBallIdRef.current++,
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
        if (difficulty === "godlike") {
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
          x: scaledCanvasWidth / 2 - POWERUP_SIZE / 2,
          y: 100,
          width: POWERUP_SIZE,
          height: POWERUP_SIZE,
          speed: POWERUP_FALL_SPEED,
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
        ? { ...prev, hasTurrets: false, hasShield: false, hasReflectShield: false, width: scaledPaddleWidth }
        : null,
    );

    // Clear all power-up timers
    clearAllPowerUpTimers();

    world.bullets = []; bulletPool.releaseAll();
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
  }, [
    scaledCanvasWidth, scaledCanvasHeight, scaledPaddleStartY,
    scaledBallRadius, scaledPaddleWidth, difficulty,
    clearAllEnemies, clearAllBombs, clearAllPowerUpTimers,
  ]);

  /**
   * Boss defeat: plays sounds, awards points + bonus life, creates explosion,
   * cleans up entities, and transitions to victory overlay or next Boss Rush stage.
   */
  const handleBossDefeat = useCallback((
    bossType: EnemyType,
    defeatedBoss: Boss,
    points: number,
    toastMessage: string,
  ) => {
    soundManager.playExplosion();
    soundManager.playBossDefeatSound();
    setScore((s) => s + points);
    if (difficulty !== "godlike") {
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
    world.bullets = []; bulletPool.releaseAll();

    if (isBossRush) {
      gameLoopRef.current?.pause();
      setBossRushTimeSnapshot(bossRushStartTime ? Date.now() - bossRushStartTime : 0);
      setBossRushStatsOverlayActive(true);
    } else {
      soundManager.stopBossMusic();
      soundManager.resumeBackgroundMusic();
      setTimeout(() => nextLevelRef.current?.(), 3000);
    }
  }, [isBossRush, bossRushStartTime, createExplosionParticles, clearAllEnemies, clearAllBombs]);

  return {
    handleGameOver,
    handleSurviveDeath,
    handleBossDefeat,
  };
}
