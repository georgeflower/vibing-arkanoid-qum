import { useState, useCallback, useEffect, useRef } from "react";
import type { QualityLevel } from "@/hooks/useAdaptiveQuality";
import { soundManager } from "@/utils/sounds";
import { supabase } from "@/integrations/supabase/client";

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
  canvasResolution: string; // derived from qualityLevel, not user-configurable
}

const STORAGE_KEY = "gameSettings";

/** Derive canvas resolution from quality level */
export function getResolutionForQuality(quality: QualityLevel): string {
  return quality === "potato" ? "640x480" : "850x650";
}

const DEFAULT_SETTINGS: GameSettings = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 30,
  sfxVolume: 70,
  currentTrack: 0,
  qualityLevel: "high",
  crtEnabled: true,
  showFpsOverlay: false,
  canvasResolution: "850x650",
};

export const SOUND_DEFAULTS: Pick<GameSettings, "musicEnabled" | "sfxEnabled" | "musicVolume" | "sfxVolume" | "currentTrack"> = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 30,
  sfxVolume: 70,
  currentTrack: 0,
};

export const VIDEO_DEFAULTS: Pick<GameSettings, "qualityLevel" | "crtEnabled" | "showFpsOverlay"> = {
  qualityLevel: "high",
  crtEnabled: true,
  showFpsOverlay: false,
};

export function loadSettings(): GameSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Strip removed keys
      const { tutorialEnabled, showQualityIndicator, ...rest } = parsed;
      const merged = { ...DEFAULT_SETTINGS, ...rest };
      // Ensure resolution matches quality
      merged.canvasResolution = getResolutionForQuality(merged.qualityLevel);
      return merged;
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettingsToLocal(settings: GameSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

async function saveSettingsToCloud(settings: GameSettings): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase
      .from("player_profiles")
      .update({ settings_json: settings as any })
      .eq("user_id", session.user.id);
  } catch {}
}

async function loadSettingsFromCloud(): Promise<GameSettings | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data } = await supabase
      .from("player_profiles")
      .select("settings_json")
      .eq("user_id", session.user.id)
      .single();
    if (data?.settings_json && typeof data.settings_json === "object") {
      const merged = { ...DEFAULT_SETTINGS, ...(data.settings_json as any) };
      // Strip removed keys and enforce resolution
      delete (merged as any).showQualityIndicator;
      merged.canvasResolution = getResolutionForQuality(merged.qualityLevel);
      return merged;
    }
  } catch {}
  return null;
}

export function parseResolution(res: string): { width: number; height: number } {
  const [w, h] = res.split("x").map(Number);
  return { width: w || 850, height: h || 650 };
}

export const useGameSettings = () => {
  const [settings, setSettingsRaw] = useState<GameSettings>(loadSettings);
  const cloudLoadedRef = useRef(false);

  // Load from cloud on mount (prefer cloud)
  useEffect(() => {
    if (cloudLoadedRef.current) return;
    cloudLoadedRef.current = true;
    loadSettingsFromCloud().then((cloud) => {
      if (cloud) {
        setSettingsRaw(cloud);
        saveSettingsToLocal(cloud);
      }
    });
  }, []);

  // Cross-instance sync: when another hook instance saves, re-read from localStorage
  useEffect(() => {
    const handler = () => setSettingsRaw(loadSettings());
    window.addEventListener('gameSettingsChanged', handler);
    return () => window.removeEventListener('gameSettingsChanged', handler);
  }, []);

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettingsRaw((prev) => {
      const next = { ...prev, ...partial };
      return next;
    });
  }, []);

  // Explicit save: writes to localStorage + cloud
  const saveSettings = useCallback((settingsToSave?: GameSettings) => {
    setSettingsRaw((prev) => {
      const toSave = settingsToSave ?? prev;
      saveSettingsToLocal(toSave);
      saveSettingsToCloud(toSave);
      window.dispatchEvent(new CustomEvent('gameSettingsChanged'));
      return toSave;
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

  return {
    settings,
    updateSettings,
    saveSettings,
    resetSoundDefaults,
    resetVideoDefaults,
  };
};
