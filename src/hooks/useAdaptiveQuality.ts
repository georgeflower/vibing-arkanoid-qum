import { useState, useEffect, useRef, useCallback } from "react";
import { debugToast as toast } from "@/utils/debugToast";
import { ENABLE_HIGH_QUALITY } from "@/constants/game";

export type QualityLevel = "low" | "medium" | "high";

export interface QualitySettings {
  level: QualityLevel;
  particleMultiplier: number;
  shadowsEnabled: boolean;
  glowEnabled: boolean;
  screenShakeMultiplier: number;
  explosionParticles: number;
  backgroundEffects: boolean;
  autoAdjust: boolean;
  resolutionScale: number;
  // Granular effect toggles (Phase 1)
  chaosGlowEnabled: boolean;
  animatedDashesEnabled: boolean;
  shieldArcsEnabled: boolean;
  superWarningEffects: boolean;
  ambientFlickerEnabled: boolean;
}

interface AdaptiveQualityOptions {
  initialQuality?: QualityLevel;
  autoAdjust?: boolean;
  lowFpsThreshold?: number;
  mediumFpsThreshold?: number;
  highFpsThreshold?: number;
  sampleWindow?: number;
  enableLogging?: boolean;
}

const QUALITY_PRESETS: Record<QualityLevel, Omit<QualitySettings, "level" | "autoAdjust">> = {
  low: {
    particleMultiplier: 0.15,
    shadowsEnabled: false,
    glowEnabled: false,
    screenShakeMultiplier: 0.25,
    explosionParticles: 3,
    backgroundEffects: false,
    resolutionScale: 0.75,
    chaosGlowEnabled: false,
    animatedDashesEnabled: false,
    shieldArcsEnabled: false,
    superWarningEffects: false,
    ambientFlickerEnabled: false,
  },
  medium: {
    particleMultiplier: 0.4,
    shadowsEnabled: true,
    glowEnabled: false,
    screenShakeMultiplier: 0.75,
    explosionParticles: 8,
    backgroundEffects: true,
    resolutionScale: 0.8,
    chaosGlowEnabled: false,
    animatedDashesEnabled: true,
    shieldArcsEnabled: false,
    superWarningEffects: false,
    ambientFlickerEnabled: false,
  },
  high: {
    particleMultiplier: 1.0,
    shadowsEnabled: true,
    glowEnabled: true,
    screenShakeMultiplier: 1.0,
    explosionParticles: 15,
    backgroundEffects: true,
    resolutionScale: 1.0,
    chaosGlowEnabled: true,
    animatedDashesEnabled: true,
    shieldArcsEnabled: true,
    superWarningEffects: true,
    ambientFlickerEnabled: true,
  },
};

export { QUALITY_PRESETS };

// ─── GPU Hardware Detection ──────────────────────────────────

function detectIntegratedGPU(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return false;
    const glCtx = gl as WebGLRenderingContext;
    const debugInfo = glCtx.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return false;
    const renderer = glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
    const integratedIndicators = ["intel", "uhd", "iris", "arc", "integrated", "mali", "adreno"];
    return integratedIndicators.some((indicator) => renderer.includes(indicator));
  } catch {
    return false;
  }
}

interface PerformanceLogEntry {
  timestamp: number;
  fps: number;
  quality: QualityLevel;
}

export const useAdaptiveQuality = (options: AdaptiveQualityOptions = {}) => {
  const {
    initialQuality = ENABLE_HIGH_QUALITY ? "high" : "medium",
    autoAdjust = true,
    lowFpsThreshold = 45,
    mediumFpsThreshold = 52,
    highFpsThreshold = 58,
    sampleWindow = 2,
    enableLogging = true,
  } = options;

  // GPU detection: force medium on integrated GPUs
  const hasIntegratedGPU = useRef(detectIntegratedGPU()).current;
  const forcedInitial = hasIntegratedGPU && initialQuality === "high" ? "medium" : initialQuality;

  const [quality, setQuality] = useState<QualityLevel>(forcedInitial);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(autoAdjust);
  const [lockedToLow, setLockedToLow] = useState(false);
  const gpuToastShown = useRef(false);

  const fpsHistoryRef = useRef<number[]>([]);
  const lastAdjustmentTimeRef = useRef<number>(0);
  const adjustmentCooldownMs = 2000;
  const notificationCooldownRef = useRef<number>(0);
  const performanceLogRef = useRef<PerformanceLogEntry[]>([]);
  const lastPerformanceLogMs = useRef<number>(0);
  const lowQualityDropCountRef = useRef<number>(0);
  const qualityStatsRef = useRef<Record<QualityLevel, { min: number; max: number; samples: number; sum: number }>>({
    low: { min: Infinity, max: 0, samples: 0, sum: 0 },
    medium: { min: Infinity, max: 0, samples: 0, sum: 0 },
    high: { min: Infinity, max: 0, samples: 0, sum: 0 },
  });

  // Show GPU detection toast once
  useEffect(() => {
    if (hasIntegratedGPU && !gpuToastShown.current) {
      gpuToastShown.current = true;
      toast.info("Integrated GPU detected — quality set to medium", { duration: 4000 });
    }
  }, [hasIntegratedGPU]);

  const getQualitySettings = useCallback((): QualitySettings => {
    return {
      level: quality,
      autoAdjust: autoAdjustEnabled,
      ...QUALITY_PRESETS[quality],
    };
  }, [quality, autoAdjustEnabled]);

  const updateFps = useCallback(
    (fps: number) => {
      const now = performance.now();

      const stats = qualityStatsRef.current[quality];
      stats.min = Math.min(stats.min, fps);
      stats.max = Math.max(stats.max, fps);
      stats.samples++;
      stats.sum += fps;

      if (now - lastPerformanceLogMs.current >= 5000) {
        performanceLogRef.current.push({ timestamp: now, fps, quality });
        if (performanceLogRef.current.length > 12) {
          performanceLogRef.current.shift();
        }
        lastPerformanceLogMs.current = now;
      }

      if (!autoAdjustEnabled) return;

      fpsHistoryRef.current.push(fps);
      const maxSamples = sampleWindow * 10;
      if (fpsHistoryRef.current.length > maxSamples) {
        fpsHistoryRef.current.shift();
      }

      if (fpsHistoryRef.current.length < 30 || now - lastAdjustmentTimeRef.current < adjustmentCooldownMs) {
        return;
      }

      const avgFps = fpsHistoryRef.current.reduce((sum, f) => sum + f, 0) / fpsHistoryRef.current.length;

      let targetQuality: QualityLevel = quality;

      if (avgFps < lowFpsThreshold) {
        targetQuality = "low";
      } else if (avgFps < mediumFpsThreshold) {
        targetQuality = lockedToLow ? "low" : "medium";
      } else if (avgFps >= highFpsThreshold) {
        targetQuality = lockedToLow ? "low" : ENABLE_HIGH_QUALITY ? "high" : "medium";
      }

      if (targetQuality !== quality) {
        const isDowngrade =
          (quality === "high" && (targetQuality === "medium" || targetQuality === "low")) ||
          (quality === "medium" && targetQuality === "low");

        if (targetQuality === "low" && isDowngrade) {
          lowQualityDropCountRef.current++;
          if (lowQualityDropCountRef.current >= 2 && !lockedToLow) {
            setLockedToLow(true);
            toast.info("Quality locked to LOW for this game session", { duration: 4000 });
          }
        }

        setQuality(targetQuality);
        lastAdjustmentTimeRef.current = now;
        fpsHistoryRef.current = [];
        qualityStatsRef.current[targetQuality] = { min: Infinity, max: 0, samples: 0, sum: 0 };

        if (now - notificationCooldownRef.current > 10000) {
          const message = isDowngrade
            ? `Quality adjusted to ${targetQuality} for better performance`
            : `Quality upgraded to ${targetQuality}`;
          toast.info(message, { duration: 3000 });
          notificationCooldownRef.current = now;
        }
      }
    },
    [quality, autoAdjustEnabled, lowFpsThreshold, mediumFpsThreshold, highFpsThreshold, sampleWindow, lockedToLow],
  );

  const setManualQuality = useCallback((newQuality: QualityLevel) => {
    const capped = !ENABLE_HIGH_QUALITY && newQuality === "high" ? "medium" : newQuality;
    setQuality(capped);
    fpsHistoryRef.current = [];
    lastAdjustmentTimeRef.current = performance.now();
    toast.success(`Quality set to ${capped}`);
  }, []);

  const toggleAutoAdjust = useCallback(() => {
    setAutoAdjustEnabled((prev) => {
      const newValue = !prev;
      toast.success(newValue ? "Auto quality adjustment enabled" : "Auto quality adjustment disabled");
      return newValue;
    });
  }, []);

  const resetQualityLockout = useCallback(() => {
    lowQualityDropCountRef.current = 0;
    setLockedToLow(false);
    setQuality(ENABLE_HIGH_QUALITY ? initialQuality : "medium");
    fpsHistoryRef.current = [];
  }, [initialQuality]);

  const getPerformanceLog = useCallback(() => {
    return {
      log: performanceLogRef.current,
      stats: qualityStatsRef.current,
      currentQuality: quality,
    };
  }, [quality]);

  return {
    quality,
    qualitySettings: getQualitySettings(),
    updateFps,
    setQuality: setManualQuality,
    autoAdjustEnabled,
    toggleAutoAdjust,
    getPerformanceLog,
    resetQualityLockout,
    lockedToLow,
    isIntegratedGPU: hasIntegratedGPU,
  };
};
