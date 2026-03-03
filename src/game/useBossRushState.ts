/**
 * game/useBossRushState.ts — Boss Rush mode state management.
 *
 * Extracted from Game.tsx to reduce component size.
 * Manages all Boss Rush session state, per-boss stats, and accumulated totals.
 */

import { useState, useRef, useCallback } from "react";

export function useBossRushState(isBossRush: boolean) {
  // Session progression
  const [bossRushIndex, setBossRushIndex] = useState(0);
  const [showBossRushVictory, setShowBossRushVictory] = useState(false);
  const [bossRushStartTime, setBossRushStartTime] = useState<number | null>(null);
  const [bossRushCompletionTime, setBossRushCompletionTime] = useState<number>(0);
  const [showBossRushScoreEntry, setShowBossRushScoreEntry] = useState(false);
  const [bossRushGameOverLevel, setBossRushGameOverLevel] = useState<number>(5);

  // Overlay state
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

  /** Reset ALL Boss Rush session state (called when starting a new Boss Rush run) */
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
    // Accumulated totals
    setBossRushTotalLivesLost(0);
    setBossRushTotalPowerUps(0);
    setBossRushTotalEnemiesKilled(0);
    setBossRushTotalShots(0);
    setBossRushTotalHits(0);
  }, []);

  /** Reset per-boss stats only (called between bosses) */
  const resetPerBossStats = useCallback(() => {
    setBossRushLivesLostThisBoss(0);
    setBossRushPowerUpsThisBoss(0);
    setBossRushEnemiesThisBoss(0);
    setBossRushShotsThisBoss(0);
    setBossRushHitsThisBoss(0);
    ballsPendingHitRef.current.clear();
  }, []);

  return {
    // Session state
    bossRushIndex,
    setBossRushIndex,
    showBossRushVictory,
    setShowBossRushVictory,
    bossRushStartTime,
    setBossRushStartTime,
    bossRushCompletionTime,
    setBossRushCompletionTime,
    showBossRushScoreEntry,
    setShowBossRushScoreEntry,
    bossRushGameOverLevel,
    setBossRushGameOverLevel,

    // Overlay
    bossRushStatsOverlayActive,
    setBossRushStatsOverlayActive,
    statsOverlayJustClosedRef,
    bossRushTimeSnapshot,
    setBossRushTimeSnapshot,

    // Per-boss stats
    bossRushLivesLostThisBoss,
    setBossRushLivesLostThisBoss,
    bossRushPowerUpsThisBoss,
    setBossRushPowerUpsThisBoss,
    bossRushEnemiesThisBoss,
    setBossRushEnemiesThisBoss,
    bossRushShotsThisBoss,
    setBossRushShotsThisBoss,
    bossRushHitsThisBoss,
    setBossRushHitsThisBoss,

    // Accumulated stats
    bossRushTotalLivesLost,
    setBossRushTotalLivesLost,
    bossRushTotalPowerUps,
    setBossRushTotalPowerUps,
    bossRushTotalEnemiesKilled,
    setBossRushTotalEnemiesKilled,
    bossRushTotalShots,
    setBossRushTotalShots,
    bossRushTotalHits,
    setBossRushTotalHits,

    // Refs
    ballsPendingHitRef,

    // Actions
    resetBossRushSessionState,
    resetPerBossStats,
  };
}
