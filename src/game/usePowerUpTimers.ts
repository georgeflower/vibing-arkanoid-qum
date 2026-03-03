/**
 * game/usePowerUpTimers.ts — Manages boss power-up timer state and handlers.
 *
 * Extracted from Game.tsx to reduce component size.
 * Handles: boss stunner, reflect shield, homing ball, fireball, second chance timers.
 */

import { useState, useRef, useCallback } from "react";
import type { Boss, Ball, Paddle } from "@/types/game";
import { debugToast as toast } from "@/utils/debugToast";
import { FIREBALL_DURATION } from "@/constants/game";

interface PowerUpTimerDeps {
  setBoss: (updater: Boss | null | ((prev: Boss | null) => Boss | null)) => void;
  setResurrectedBosses: (updater: Boss[] | ((prev: Boss[]) => Boss[])) => void;
  setPaddle: (updater: Paddle | null | ((prev: Paddle | null) => Paddle | null)) => void;
  setBalls: (updater: Ball[] | ((prev: Ball[]) => Ball[])) => void;
}

export function usePowerUpTimers(deps: PowerUpTimerDeps) {
  const { setBoss, setResurrectedBosses, setPaddle, setBalls } = deps;

  // Boss power-up active states
  const [reflectShieldActive, setReflectShieldActive] = useState(false);
  const [homingBallActive, setHomingBallActive] = useState(false);

  // Boss power-up end times (for countdown display)
  const [bossStunnerEndTime, setBossStunnerEndTime] = useState<number | null>(null);
  const [reflectShieldEndTime, setReflectShieldEndTime] = useState<number | null>(null);
  const [homingBallEndTime, setHomingBallEndTime] = useState<number | null>(null);

  // Fireball timer state
  const [fireballEndTime, setFireballEndTime] = useState<number | null>(null);

  // Second chance impact effect state
  const [secondChanceImpact, setSecondChanceImpact] = useState<{
    x: number;
    y: number;
    startTime: number;
  } | null>(null);

  // Timeout refs
  const bossStunnerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reflectShieldTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const homingBallTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pause-aware timer tracking
  const savedTimerDurationsRef = useRef<{
    bossStunner: number | null;
    reflectShield: number | null;
    homingBall: number | null;
    fireball: number | null;
  }>({ bossStunner: null, reflectShield: null, homingBall: null, fireball: null });

  const handleBossStunner = useCallback(() => {
    const duration = 5000;
    const endTime = Date.now() + duration;
    setBossStunnerEndTime(endTime);

    setBoss((prev) =>
      prev
        ? {
            ...prev,
            isStunned: true,
            stunnedUntil: endTime,
          }
        : null,
    );

    setResurrectedBosses((prev) =>
      prev.map((rb) => ({
        ...rb,
        isStunned: true,
        stunnedUntil: endTime,
      })),
    );

    if (bossStunnerTimeoutRef.current) {
      clearTimeout(bossStunnerTimeoutRef.current);
    }

    bossStunnerTimeoutRef.current = setTimeout(() => {
      setBossStunnerEndTime(null);

      setBoss((prev) =>
        prev
          ? {
              ...prev,
              isStunned: false,
              stunnedUntil: undefined,
            }
          : null,
      );

      setResurrectedBosses((prev) =>
        prev.map((rb) => ({
          ...rb,
          isStunned: false,
          stunnedUntil: undefined,
        })),
      );
    }, duration);
  }, [setBoss, setResurrectedBosses]);

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
  }, [setPaddle]);

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
  }, [setBalls]);

  const handleFireballStart = useCallback(() => {
    setFireballEndTime(Date.now() + FIREBALL_DURATION);
  }, []);

  const handleFireballEnd = useCallback(() => {
    setFireballEndTime(null);
  }, []);

  const handleSecondChance = useCallback(() => {
    // Just for tracking - the paddle state is set in usePowerUps
  }, []);

  /** Clear all power-up timers and state. Called on death, level transition, etc. */
  const clearAllPowerUpTimers = useCallback(() => {
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
    if (bossStunnerTimeoutRef.current) {
      clearTimeout(bossStunnerTimeoutRef.current);
      bossStunnerTimeoutRef.current = null;
    }
  }, []);

  /** Cleanup all timeout refs. Call on unmount. */
  const cleanupTimeouts = useCallback(() => {
    if (bossStunnerTimeoutRef.current) clearTimeout(bossStunnerTimeoutRef.current);
    if (reflectShieldTimeoutRef.current) clearTimeout(reflectShieldTimeoutRef.current);
    if (homingBallTimeoutRef.current) clearTimeout(homingBallTimeoutRef.current);
  }, []);

  return {
    // State
    reflectShieldActive,
    homingBallActive,
    bossStunnerEndTime,
    reflectShieldEndTime,
    homingBallEndTime,
    fireballEndTime,
    secondChanceImpact,
    setSecondChanceImpact,
    savedTimerDurationsRef,

    // Setters (for pause/resume adjustment)
    setBossStunnerEndTime,
    setReflectShieldEndTime,
    setHomingBallEndTime,
    setFireballEndTime,
    setReflectShieldActive,
    setHomingBallActive,

    // Refs (for pause/resume cleanup)
    bossStunnerTimeoutRef,
    reflectShieldTimeoutRef,
    homingBallTimeoutRef,

    // Handlers
    handleBossStunner,
    handleReflectShield,
    handleHomingBall,
    handleFireballStart,
    handleFireballEnd,
    handleSecondChance,
    clearAllPowerUpTimers,
    cleanupTimeouts,
  };
}
