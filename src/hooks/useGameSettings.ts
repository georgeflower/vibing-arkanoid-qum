import { useState, useCallback, useEffect } from "react";
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
  musicSource: "radio" | "builtin";
  // Video
  qualityLevel: QualityLevel;
  qualityMode: "auto" | "manual";
  showFpsOverlay: boolean;
  canvasResolution: string; // derived from qualityLevel, not user-configurable
  updatedAt?: number;
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
  musicSource: "radio",
  qualityLevel: "high",
  qualityMode: "auto",
  showFpsOverlay: false,
  canvasResolution: "850x650",
};

export const SOUND_DEFAULTS: Pick<GameSettings, "musicEnabled" | "sfxEnabled" | "musicVolume" | "sfxVolume" | "currentTrack" | "musicSource"> = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 30,
  sfxVolume: 70,
  currentTrack: 0,
  musicSource: "radio",
};

export const VIDEO_DEFAULTS: Pick<GameSettings, "qualityLevel" | "qualityMode" | "showFpsOverlay"> = {
  qualityLevel: "high",
  qualityMode: "auto",
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
      if (merged.musicSource !== "radio" && merged.musicSource !== "builtin") {
        merged.musicSource = "radio";
      }
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
      .upsert(
        { user_id: session.user.id, settings_json: settings as any } as any,
        { onConflict: "user_id" },
      );
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
      if (merged.musicSource !== "radio" && merged.musicSource !== "builtin") {
        merged.musicSource = "radio";
      }
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

let cloudLoadDone = false;

export const useGameSettings = () => {
  const [settings, setSettingsRaw] = useState<GameSettings>(loadSettings);

  // Load from cloud once per browser session (prefer newer of local vs cloud)
  useEffect(() => {
    if (cloudLoadDone) return;
    cloudLoadDone = true;
    loadSettingsFromCloud().then((cloud) => {
      if (!cloud) return;
      const local = loadSettings();
      if ((cloud.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        setSettingsRaw(cloud);
        saveSettingsToLocal(cloud);
        window.dispatchEvent(new CustomEvent('gameSettingsChanged'));
      } else {
        // Local is newer or equal — push local up to cloud so it doesn't win next reload
        saveSettingsToCloud(local);
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
      const base = settingsToSave ?? prev;
      const toSave: GameSettings = { ...base, updatedAt: Date.now() };
      saveSettingsToLocal(toSave);
      saveSettingsToCloud(toSave);
      window.dispatchEvent(new CustomEvent('gameSettingsChanged'));
      return toSave;
    });
  }, []);

  // Sync sound settings to soundManager on changes
  useEffect(() => {
    soundManager.setMusicSource(settings.musicSource);
    soundManager.setMusicEnabled(settings.musicEnabled);
    soundManager.setSfxEnabled(settings.sfxEnabled);
    soundManager.setMusicVolume(settings.musicVolume / 100);
    soundManager.setSfxVolume(settings.sfxVolume / 100);
  }, [settings.musicSource, settings.musicEnabled, settings.sfxEnabled, settings.musicVolume, settings.sfxVolume]);

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
