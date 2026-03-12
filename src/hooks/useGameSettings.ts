import { useState, useCallback, useEffect } from "react";
import type { QualityLevel } from "@/hooks/useAdaptiveQuality";
import { soundManager } from "@/utils/sounds";

export interface ResolutionPreset {
  width: number;
  height: number;
  label: string;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { width: 320, height: 200, label: "320×200 (CGA)" },
  { width: 640, height: 400, label: "640×400 (Amiga)" },
  { width: 640, height: 480, label: "640×480 (VGA)" },
  { width: 800, height: 600, label: "800×600 (SVGA)" },
  { width: 850, height: 650, label: "850×650 (Default)" },
  { width: 1024, height: 768, label: "1024×768 (XGA)" },
  { width: 1280, height: 960, label: "1280×960 (SXGA)" },
  { width: 1600, height: 1200, label: "1600×1200 (UXGA)" },
];

export interface GameSettings {
  // Sound
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number; // 0-100
  sfxVolume: number; // 0-100
  currentTrack: number;
  // Video
  qualityLevel: QualityLevel;
  crtEnabled: boolean;
  showFpsOverlay: boolean;
  showQualityIndicator: boolean;
  canvasResolution: string; // "850x650" format
  // General
  tutorialEnabled: boolean;
}

const STORAGE_KEY = "gameSettings";

const DEFAULT_SETTINGS: GameSettings = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 30,
  sfxVolume: 70,
  currentTrack: 0,
  qualityLevel: "high",
  crtEnabled: true,
  showFpsOverlay: false,
  showQualityIndicator: true,
  canvasResolution: "850x650",
  tutorialEnabled: true,
};

export const SOUND_DEFAULTS: Pick<GameSettings, "musicEnabled" | "sfxEnabled" | "musicVolume" | "sfxVolume" | "currentTrack"> = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 30,
  sfxVolume: 70,
  currentTrack: 0,
};

export const VIDEO_DEFAULTS: Pick<GameSettings, "qualityLevel" | "crtEnabled" | "showFpsOverlay" | "showQualityIndicator" | "canvasResolution"> = {
  qualityLevel: "high",
  crtEnabled: true,
  showFpsOverlay: false,
  showQualityIndicator: true,
  canvasResolution: "850x650",
};

export const GENERAL_DEFAULTS: Pick<GameSettings, "tutorialEnabled"> = {
  tutorialEnabled: true,
};

function loadSettings(): GameSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: GameSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function parseResolution(res: string): { width: number; height: number } {
  const [w, h] = res.split("x").map(Number);
  return { width: w || 850, height: h || 650 };
}

export const useGameSettings = () => {
  const [settings, setSettingsRaw] = useState<GameSettings>(loadSettings);

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettingsRaw((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  // Sync sound settings to soundManager on changes
  useEffect(() => {
    soundManager.setMusicEnabled(settings.musicEnabled);
    soundManager.setSfxEnabled(settings.sfxEnabled);
    soundManager.setMusicVolume(settings.musicVolume / 100);
    soundManager.setSfxVolume(settings.sfxVolume / 100);
  }, [settings.musicEnabled, settings.sfxEnabled, settings.musicVolume, settings.sfxVolume]);

  const resetSoundDefaults = useCallback(() => {
    updateSettings(SOUND_DEFAULTS);
  }, [updateSettings]);

  const resetVideoDefaults = useCallback(() => {
    updateSettings(VIDEO_DEFAULTS);
  }, [updateSettings]);

  const resetGeneralDefaults = useCallback(() => {
    updateSettings(GENERAL_DEFAULTS);
  }, [updateSettings]);

  return {
    settings,
    updateSettings,
    resetSoundDefaults,
    resetVideoDefaults,
    resetGeneralDefaults,
  };
};
