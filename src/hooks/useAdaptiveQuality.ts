import { useState, useEffect, useRef, useCallback } from "react";
import { debugToast as toast } from "@/utils/debugToast";
import { ENABLE_HIGH_QUALITY } from "@/constants/game";

export type QualityLevel = "potato" | "low" | "medium" | "high";

const LAST_QUALITY_STORAGE_KEY = "va_lastQuality";
const QUALITY_ORDER: QualityLevel[] = ["potato", "low", "medium", "high"];
const MAX_FPS_SAMPLES = 10;
const MIN_WARMUP_SAMPLES = 5;
const DEFAULT_LOW_END_CORE_COUNT = 4;
const UNKNOWN_CORE_COUNT_FALLBACK = 8;

interface PerformanceProfilerSummary {
  totalObjects: number;
}

interface PerformanceProfiler {
  getFrameSummary(): PerformanceProfilerSummary;
}

declare global {
  interface Window {
    performanceProfiler?: PerformanceProfiler;
  }
}

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
  isFullscreen?: boolean;
}

const QUALITY_PRESETS: Record<QualityLevel, Omit<QualitySettings, "level" | "autoAdjust">> = {
  potato: {
    particleMultiplier: 0.15,
    shadowsEnabled: false,
    glowEnabled: false,
    screenShakeMultiplier: 0.25,
    explosionParticles: 3,
    backgroundEffects: false,
    resolutionScale: 0.25,
    chaosGlowEnabled: false,
    animatedDashesEnabled: false,
    shieldArcsEnabled: false,
    superWarningEffects: false,
    ambientFlickerEnabled: false,
  },
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

let cachedGPUDetection: boolean | null = null;

function isQualityLevel(value: string | null): value is QualityLevel {
  return value !== null && QUALITY_ORDER.includes(value as QualityLevel);
}

function clampQualityLevel(requested: QualityLevel, maxLevel: QualityLevel): QualityLevel {
  return QUALITY_ORDER.indexOf(requested) > QUALITY_ORDER.indexOf(maxLevel) ? maxLevel : requested;
}

function getStoredQuality(): QualityLevel | null {
  try {
    const storedQuality = localStorage.getItem(LAST_QUALITY_STORAGE_KEY);
    return isQualityLevel(storedQuality) ? storedQuality : null;
  } catch {
    return null;
  }
}

function persistQuality(quality: QualityLevel): void {
  try {
    localStorage.setItem(LAST_QUALITY_STORAGE_KEY, quality);
  } catch {
    // Ignore storage failures (e.g. private browsing)
  }
}

function detectIntegratedGPU(): boolean {
  if (cachedGPUDetection !== null) {
    return cachedGPUDetection;
  }

  try {
    const canvas = document.createElement("canvas");
    const webglCtx = canvas.getContext("webgl");
    const gl = (webglCtx ?? (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null)) as WebGLRenderingContext | null;

    if (!gl) {
      cachedGPUDetection = false;
      return false;
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    if (!debugInfo) {
      const loseContext = gl.getExtension("WEBGL_lose_context");
      if (loseContext) loseContext.loseContext();
      cachedGPUDetection = false;
      return false;
    }

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
    const integratedIndicators = ["intel", "uhd", "iris", "arc", "integrated"];
    const isIntegrated = integratedIndicators.some((indicator) => renderer.includes(indicator));

    const loseContext = gl.getExtension("WEBGL_lose_context");
    if (loseContext) loseContext.loseContext();

    cachedGPUDetection = isIntegrated;
    return isIntegrated;
  } catch {
    cachedGPUDetection = false;
    return false;
  }
}

function detectLowEndDevice(): boolean {
  const isMobileUA = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const lowCores = (navigator.hardwareConcurrency ?? UNKNOWN_CORE_COUNT_FALLBACK) <= DEFAULT_LOW_END_CORE_COUNT;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const lowMemory = deviceMemory !== undefined && deviceMemory <= 4;
  return isMobileUA || lowCores || lowMemory;
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
    enableLogging = true,
  } = options;

  // GPU detection: force medium on integrated GPUs
  const hasIntegratedGPU = useRef(detectIntegratedGPU()).current;
  const isLowEndDevice = useRef(detectLowEndDevice()).current;
  const storedQuality = useRef(getStoredQuality()).current;
  const maxInitialQuality = !ENABLE_HIGH_QUALITY || hasIntegratedGPU ? "medium" : "high";
  const preferredInitialQuality = storedQuality ?? (isLowEndDevice ? "medium" : initialQuality);
  const forcedInitial = clampQualityLevel(preferredInitialQuality, maxInitialQuality);

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
  const lockoutEscapeCounterRef = useRef<number>(0);
  const warningThresholdRef = useRef<number>(0);
  const qualityStatsRef = useRef<Record<QualityLevel, { min: number; max: number; samples: number; sum: number }>>({
    potato: { min: Infinity, max: 0, samples: 0, sum: 0 },
    low: { min: Infinity, max: 0, samples: 0, sum: 0 },
    medium: { min: Infinity, max: 0, samples: 0, sum: 0 },
    high: { min: Infinity, max: 0, samples: 0, sum: 0 },
  });

  // Silent programmatic quality override (used to sync from persisted settings on mount).
  // Does NOT clear the lockout and does NOT show a toast.
  const applyQualitySilently = useCallback((q: QualityLevel) => {
    const capped = !ENABLE_HIGH_QUALITY && q === "high" ? "medium" : q;
    setQuality(capped);
    persistQuality(capped);
    fpsHistoryRef.current = [];
    lastAdjustmentTimeRef.current = performance.now();
  }, []);


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

        // Console log current performance (disabled on mobile for better performance)
        if (enableLogging && !(/Mobi|Android/i.test(navigator.userAgent))) {
          const avgFps = stats.samples > 0 ? (stats.sum / stats.samples).toFixed(1) : '0.0';
          const baseLog = `[Performance Monitor] FPS: ${fps.toFixed(1)} | Quality: ${quality.toUpperCase()} | ` +
            `Avg: ${avgFps} | Min: ${stats.min.toFixed(0)} | Max: ${stats.max.toFixed(0)}`;
          
          // If detailed metrics are available (from performance profiler), include them
          if (window.performanceProfiler) {
            const summary = window.performanceProfiler.getFrameSummary();
            console.log(baseLog + ` | Objects: ${summary.totalObjects}`);
          } else {
            console.log(baseLog);
          }
        }
        
        lastPerformanceLogMs.current = now;
      }

      if (!autoAdjustEnabled) return;

      // Lockout escape hatch: sustained good FPS while locked to LOW clears the lock.
      if (lockedToLow) {
        if (fps >= highFpsThreshold) {
          lockoutEscapeCounterRef.current++;
          if (lockoutEscapeCounterRef.current >= 60) {
            setLockedToLow(false);
            lowQualityDropCountRef.current = 1;
            lockoutEscapeCounterRef.current = 0;
            console.log('[Performance] LOW-quality lockout cleared after 60s of sustained good FPS');
          }
        } else {
          lockoutEscapeCounterRef.current = 0;
        }
      } else {
        lockoutEscapeCounterRef.current = 0;
      }

      fpsHistoryRef.current.push(fps);
      if (fpsHistoryRef.current.length > MAX_FPS_SAMPLES) {
        fpsHistoryRef.current.shift();
      }


      const isWarmingUp = fpsHistoryRef.current.length < MIN_WARMUP_SAMPLES;
      const isCoolingDown = now - lastAdjustmentTimeRef.current < adjustmentCooldownMs;

      if (isWarmingUp || isCoolingDown) {
        // Early warning system
        if (!isWarmingUp && fpsHistoryRef.current.length === MAX_FPS_SAMPLES) {
          const recentAvg =
            fpsHistoryRef.current.slice(-MAX_FPS_SAMPLES).reduce((sum, f) => sum + f, 0) / MAX_FPS_SAMPLES;
          const threshold = quality === 'high' ? mediumFpsThreshold : lowFpsThreshold;
          
          if (recentAvg < threshold && now - warningThresholdRef.current > 5000) {
            const timeToDowngrade = ((adjustmentCooldownMs - (now - lastAdjustmentTimeRef.current)) / 1000).toFixed(1);
            console.warn(
              `[Performance Warning] FPS dropped to ${recentAvg.toFixed(1)} (threshold: ${threshold}) - ` +
              `will downgrade in ${timeToDowngrade}s if sustained`
            );
            warningThresholdRef.current = now;
          }
        }
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
          console.log(`[Performance] Dropped to LOW quality (count: ${lowQualityDropCountRef.current})`);
          
          if (lowQualityDropCountRef.current >= 2 && !lockedToLow) {
            setLockedToLow(true);
            console.log('[Performance] Quality LOCKED to LOW for remainder of game session');
            toast.info("Quality locked to LOW for this game session", { duration: 4000 });
          }
        }

        // Log quality change
        const timeSinceStart = (now / 1000).toFixed(1);
        console.log(
          `[Performance] Quality: ${quality.toUpperCase()} → ${targetQuality.toUpperCase()} | ` +
          `Avg FPS: ${avgFps.toFixed(1)} | Time: ${timeSinceStart}s`
        );

        setQuality(targetQuality);
        persistQuality(targetQuality);
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
    [quality, autoAdjustEnabled, lowFpsThreshold, mediumFpsThreshold, highFpsThreshold, lockedToLow, enableLogging],
  );

  const setManualQuality = useCallback((newQuality: QualityLevel) => {
    const capped = !ENABLE_HIGH_QUALITY && newQuality === "high" ? "medium" : newQuality;
    setQuality(capped);
    persistQuality(capped);
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
    console.log('[Performance] Quality lockout reset for new game');
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
