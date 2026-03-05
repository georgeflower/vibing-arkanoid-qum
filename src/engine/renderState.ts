/**
 * engine/renderState.ts — Mutable singleton for rendering-only state.
 *
 * State that the render loop needs but doesn't belong in `world`
 * (game entities). Game.tsx writes to this; canvasRenderer reads it.
 *
 * Same pattern as `world` and `hudSnapshot`: plain mutable object,
 * no Proxy, no reactivity.
 */

import type { GameState, BonusLetterType } from "@/types/game";
import type { QualitySettings } from "@/hooks/useAdaptiveQuality";
import { QUALITY_PRESETS } from "@/hooks/useAdaptiveQuality";

// ─── Render State Interface ──────────────────────────────────

export interface RenderState {
  // Canvas dimensions
  width: number;
  height: number;

  // Game state
  gameState: GameState;
  level: number;

  // Collections
  collectedLetters: Set<BonusLetterType>;

  // powerUps live in world.powerUps — rendered directly from there, no renderState bridge needed
  // bullets live in world.bullets — rendered directly from there, no renderState bridge needed

  // Quality
  qualitySettings: QualitySettings;

  // UI flags
  showHighScoreEntry: boolean;
  bossIntroActive: boolean;
  bossSpawnAnimation: { active: boolean; startTime: number } | null;
  tutorialHighlight: {
    type: "power_up" | "boss" | "enemy" | "bonus_letter";
    zoomScale?: number;
  } | null;
  debugEnabled: boolean;
  isMobile: boolean;

  // Visual effects
  getReadyGlow: { opacity: number } | null;
  secondChanceImpact: { x: number; y: number; startTime: number } | null;
  ballReleaseHighlight: { active: boolean; startTime: number } | null;
}

// ─── Asset References ────────────────────────────────────────

export interface AssetRefs {
  powerUpImages: Record<string, HTMLImageElement>;
  bonusLetterImages: Record<string, HTMLImageElement>;
  paddleImage: HTMLImageElement | null;
  paddleTurretsImage: HTMLImageElement | null;
  missileImage: HTMLImageElement | null;
  megaBossImage: HTMLImageElement | null;

  // Background tile images
  backgroundImage4: HTMLImageElement | null;
  backgroundImage69: HTMLImageElement | null;
  backgroundImage1114: HTMLImageElement | null;
  backgroundImage1620: HTMLImageElement | null;

  // Boss level fitted backgrounds
  bossLevel5Bg: HTMLImageElement | null;
  bossLevel10Bg: HTMLImageElement | null;
  bossLevel15Bg: HTMLImageElement | null;
  bossLevel20Bg: HTMLImageElement | null;

  // Lazily-created canvas patterns (keyed by background name)
  patterns: Record<string, CanvasPattern | null>;
}

// ─── Singleton Instance ──────────────────────────────────────

export const renderState: RenderState = {
  width: 850,
  height: 650,

  gameState: "ready",
  level: 1,

  collectedLetters: new Set(),

  // powerUps live in world.powerUps — no bridge needed
  // bullets live in world.bullets — no bridge needed

  qualitySettings: { level: 'medium', autoAdjust: true, ...QUALITY_PRESETS.medium },

  showHighScoreEntry: false,
  bossIntroActive: false,
  bossSpawnAnimation: null,
  tutorialHighlight: null,
  debugEnabled: false,
  isMobile: false,

  getReadyGlow: null,
  secondChanceImpact: null,
  ballReleaseHighlight: null,
};

/**
 * Create a fresh AssetRefs object (all nulls). Called once on mount.
 */
export function createAssetRefs(): AssetRefs {
  return {
    powerUpImages: {},
    bonusLetterImages: {},
    paddleImage: null,
    paddleTurretsImage: null,
    missileImage: null,
    megaBossImage: null,
    backgroundImage4: null,
    backgroundImage69: null,
    backgroundImage1114: null,
    backgroundImage1620: null,
    bossLevel5Bg: null,
    bossLevel10Bg: null,
    bossLevel15Bg: null,
    bossLevel20Bg: null,
    patterns: {},
  };
}
