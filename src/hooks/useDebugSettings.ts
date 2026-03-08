import { useState, useCallback } from "react";

export interface DebugSettings {
  showDebugModeIndicator: boolean;
  showGameLoopDebug: boolean;
  showSubstepDebug: boolean;
  showCCDPerformance: boolean;
  showCollisionHistory: boolean;
  showFrameProfiler: boolean;
  showPowerUpWeights: boolean;
  showPoolStats: boolean;
  enableCollisionLogging: boolean;
  enablePowerUpLogging: boolean;
  enablePerformanceLogging: boolean;
  enableFPSLogging: boolean;
  enableDetailedFrameLogging: boolean;
  enablePaddleLogging: boolean;
  enableBossLogging: boolean;
  enableFrameProfilerLogging: boolean;
  enableScreenShakeLogging: boolean;
  enablePointerLockLogging: boolean;
  enableGCLogging: boolean;
  enableLagLogging: boolean;
  enableScreenShake: boolean;
  enableParticles: boolean;
  enableExplosions: boolean;
  enableCRTEffects: boolean;
}

const DEFAULT_SETTINGS: DebugSettings = {
  showDebugModeIndicator: true,
  showGameLoopDebug: false,
  showSubstepDebug: false,
  showCCDPerformance: false,
  showCollisionHistory: false,
  showFrameProfiler: false,
  showPowerUpWeights: false,
  showPoolStats: false,
  enableCollisionLogging: false,
  enablePowerUpLogging: false,
  enablePerformanceLogging: false, // Off by default to reduce hot-path overhead
  enableFPSLogging: false, // Off by default — enable via debug dashboard
  enableDetailedFrameLogging: false, // Off by default (verbose)
  enablePaddleLogging: false,
  enableBossLogging: false,
  enableFrameProfilerLogging: false,
  enableScreenShakeLogging: false, // Screen shake logging off by default
  enablePointerLockLogging: false, // Pointer lock logging off by default
  enableGCLogging: false, // GC detection off by default to reduce hot-path overhead
  enableLagLogging: false, // Lag detection off by default to reduce hot-path overhead
  enableScreenShake: true, // Screen shake enabled by default
  enableParticles: true, // Particles enabled by default
  enableExplosions: true, // Explosions enabled by default
  enableCRTEffects: true, // CRT effects enabled by default
};

export const useDebugSettings = () => {
  const [settings, setSettings] = useState<DebugSettings>(DEFAULT_SETTINGS);

  const toggleSetting = useCallback((key: keyof DebugSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const isDebugModeActive = useCallback((currentSettings: DebugSettings = settings): boolean => {
    // Check if any actual debug visualization or logging feature is enabled
    // Excludes gameplay features like particles, screen shake, CRT effects
    return (
      currentSettings.showDebugModeIndicator ||
      currentSettings.showGameLoopDebug ||
      currentSettings.showSubstepDebug ||
      currentSettings.showCCDPerformance ||
      currentSettings.showCollisionHistory ||
      currentSettings.showFrameProfiler ||
      currentSettings.showPowerUpWeights ||
      currentSettings.showPoolStats ||
      currentSettings.enableCollisionLogging ||
      currentSettings.enablePowerUpLogging ||
      currentSettings.enablePerformanceLogging ||
      currentSettings.enableFPSLogging ||
      currentSettings.enableDetailedFrameLogging ||
      currentSettings.enablePaddleLogging ||
      currentSettings.enableBossLogging ||
      currentSettings.enableFrameProfilerLogging ||
      currentSettings.enableScreenShakeLogging ||
      currentSettings.enablePointerLockLogging ||
      currentSettings.enableGCLogging ||
      currentSettings.enableLagLogging
    );
  }, [settings]);

  return {
    settings,
    toggleSetting,
    resetSettings,
    isDebugModeActive,
  };
};
