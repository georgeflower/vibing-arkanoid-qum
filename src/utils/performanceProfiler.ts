export interface FrameMetrics {
  timestamp: number;
  fps: number;
  frameNumber: number;
  
  // Object counts
  ballCount: number;
  visibleBrickCount: number;
  totalBrickCount: number;
  enemyCount: number;
  powerUpCount: number;
  bulletCount: number;
  explosionCount: number;
  totalParticleCount: number;
  bossAttackCount: number;
  laserWarningCount: number;
  bombCount: number;
  shieldImpactCount: number;
  bonusLetterCount: number;
  
  // CCD performance
  ccdTotalMs: number;
  ccdSubsteps: number;
  ccdCollisions: number;
  ccdToiIterations: number;
  
  // Rendering complexity
  qualityLevel: string;
  hasActiveBoss: boolean;
  hasScreenShake: boolean;
  hasBackgroundFlash: boolean;

  // Phase 4: Subsystem timing (optional — populated when frame profiler is active)
  simulationMs?: number;
  renderMs?: number;
  debugMs?: number;
  longFrameCount?: number;

  // System resource usage
  cpuUsagePercent?: number;   // Estimated CPU usage based on frame budget
  gpuTimeMs?: number;          // GPU frame time (via WebGL timer query)
  memoryUsedMB?: number;       // JS heap memory used
  memoryTotalMB?: number;      // JS heap memory allocated
  memoryPercent?: number;      // JS heap used / heap limit

  // Detailed frame timing
  frameTimeMs?: number;        // Total wall-clock frame time
  idleTimeMs?: number;         // Browser idle time
  layoutTimeMs?: number;       // Layout/reflow time
  paintTimeMs?: number;        // Paint time
  scriptTimeMs?: number;       // Script execution time
}

interface PerformanceThresholds {
  warningFps: number;
  criticalFps: number;
  maxFps: number;
}

const PERFORMANCE_CONFIG = {
  warningFps: 50,
  criticalFps: 40,
  maxFps: 58,
  historyWindowSize: 300,
  logCooldownMs: 10000,
  consecutiveThreshold: 3,
  particleWarningCount: 150,
  substepWarningCount: 15,
  ccdWarningMs: 10,
  objectWarningCount: 150,
  collisionWarningCount: 25,
  // System resource thresholds
  memoryWarningPercent: 85,       // % of JS heap limit
  cpuWarningPercent: 90,          // % of frame budget utilization
  gpuWarningMs: 14,               // ms (leaves 2.67ms headroom in 16.67ms budget)
  frameBudgetMs: 16.67,           // ms target for 60 FPS
  scriptWarningMs: 8,             // ms — half the frame budget
  layoutWarningMs: 2,             // ms — layout/reflow threshold
  paintWarningMs: 4,              // ms — paint threshold
};

// Type augmentation for Chrome-only performance.memory API
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

/**
 * Captures browser resource metrics (memory, CPU estimate, frame timing) each frame.
 * All APIs are optional and degrade gracefully on unsupported browsers.
 */
export class SystemResourceMonitor {
  private lastFrameTimestamp: number = 0;
  private paintObserver: PerformanceObserver | null = null;
  private lastPaintTimeMs: number | undefined = undefined;
  private lastLayoutTimeMs: number | undefined = undefined;
  private lastScriptTimeMs: number | undefined = undefined;
  private enabled: boolean = false;

  constructor() {
    // Observer is not started automatically — call enable() to activate
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.setupPerformanceObserver();
  }

  disable(): void {
    this.destroy();
  }

  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined' || !this.enabled) return;
    try {
      // Observe paint and longtask entries for script/layout/paint time estimation
      this.paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            // Only record paint duration when the browser reports a non-zero value;
            // entry.startTime is the timestamp of when the paint began (not a duration)
            // so we discard it to avoid misleading metrics.
            if (entry.duration > 0) {
              this.lastPaintTimeMs = entry.duration;
            }
          } else if (entry.entryType === 'longtask') {
            // longtask duration approximates blocked script time
            this.lastScriptTimeMs = entry.duration;
          }
        }
      });
      this.paintObserver.observe({ entryTypes: ['paint', 'longtask'] });
    } catch {
      // PerformanceObserver may not support all entry types; ignore safely
    }
  }

  captureMetrics(): Partial<FrameMetrics> {
    if (!this.enabled) return {};

    const now = performance.now();
    const metrics: Partial<FrameMetrics> = {};

    // Memory usage (Chrome/Edge only)
    if (performance.memory) {
      const mem = performance.memory;
      metrics.memoryUsedMB = mem.usedJSHeapSize / (1024 * 1024);
      metrics.memoryTotalMB = mem.totalJSHeapSize / (1024 * 1024);
      metrics.memoryPercent = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
    }

    // Frame time and frame-budget utilization (proxy for CPU load on the main thread).
    // NOTE: This measures wall-clock frame time which includes GPU idle and vsync wait, so
    // it over-estimates CPU usage on high-refresh-rate displays and GPU-bound scenarios.
    // It is labelled "cpuUsagePercent" to match the FrameMetrics interface but should be
    // interpreted as "frame budget consumed" rather than true OS-level CPU usage.
    const frameBudget = PERFORMANCE_CONFIG.frameBudgetMs;
    if (this.lastFrameTimestamp > 0) {
      const actualFrameTime = now - this.lastFrameTimestamp;
      // Only record if reasonable (< 100ms) to avoid false measurements from
      // captureMetrics being called once per second instead of per frame
      if (actualFrameTime < 100) {
        metrics.frameTimeMs = actualFrameTime;
        metrics.cpuUsagePercent = Math.min(100, (actualFrameTime / frameBudget) * 100);
      }
    }
    this.lastFrameTimestamp = now;

    // Propagate paint/script timing gathered by PerformanceObserver
    if (this.lastPaintTimeMs !== undefined) {
      metrics.paintTimeMs = this.lastPaintTimeMs;
    }
    if (this.lastScriptTimeMs !== undefined) {
      metrics.scriptTimeMs = this.lastScriptTimeMs;
    }

    return metrics;
  }

  destroy(): void {
    if (this.paintObserver) {
      this.paintObserver.disconnect();
      this.paintObserver = null;
    }
    this.enabled = false;
  }
}

class PerformanceProfiler {
  private frameHistory: FrameMetrics[] = [];
  private maxHistorySize: number = PERFORMANCE_CONFIG.historyWindowSize;
  private thresholds: PerformanceThresholds = {
    warningFps: PERFORMANCE_CONFIG.warningFps,
    criticalFps: PERFORMANCE_CONFIG.criticalFps,
    maxFps: PERFORMANCE_CONFIG.maxFps
  };
  private lastLogTime: number = 0;
  private logCooldownMs: number = PERFORMANCE_CONFIG.logCooldownMs;
  private consecutiveLowFrames: number = 0;
  private lowFpsThreshold: number = PERFORMANCE_CONFIG.consecutiveThreshold;
  private sessionStartTime: number = performance.now();

  recordFrame(metrics: FrameMetrics): void {
    this.frameHistory.push(metrics);

    // Keep only recent frames
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }
  }

  detectPerformanceIssue(): boolean {
    if (this.frameHistory.length < 10) return false;

    const recentFrames = this.frameHistory.slice(-10);
    const avgFps = recentFrames.reduce((sum, f) => sum + f.fps, 0) / 10;

    // Critical: FPS < 40
    if (avgFps < this.thresholds.criticalFps) {
      this.consecutiveLowFrames++;

      if (this.consecutiveLowFrames >= this.lowFpsThreshold) {
        const now = performance.now();
        if (now - this.lastLogTime > this.logCooldownMs) {
          this.lastLogTime = now;
          return true;
        }
      }
    }
    // Warning: FPS < 50
    else if (avgFps < this.thresholds.warningFps) {
      this.consecutiveLowFrames++;
      if (this.consecutiveLowFrames === 30) {
        const now = performance.now();
        if (now - this.lastLogTime > this.logCooldownMs * 2) {
          this.lastLogTime = now;
          return true;
        }
      }
    } else {
      this.consecutiveLowFrames = 0;
    }

    return false;
  }

  logDetailedMetrics(): void {
    if (this.frameHistory.length === 0) return;

    const recentFrames = this.frameHistory.slice(-10);
    const latestMetrics = this.frameHistory[this.frameHistory.length - 1];
    const avgFps = recentFrames.reduce((sum, f) => sum + f.fps, 0) / 10;
    const duration = ((latestMetrics.timestamp - this.sessionStartTime) / 1000).toFixed(1);

    const totalObjects =
      latestMetrics.ballCount +
      latestMetrics.visibleBrickCount +
      latestMetrics.enemyCount +
      latestMetrics.powerUpCount +
      latestMetrics.bulletCount +
      latestMetrics.explosionCount;

    const bottlenecks = this.analyzeBottlenecks(latestMetrics);
    const severityLevel = avgFps < this.thresholds.criticalFps ? 'CRITICAL' : 'WARNING';

    console.group(`%c[Performance Issue Detected - ${severityLevel}]`, `color: ${avgFps < 40 ? '#ff4444' : '#ffaa44'}; font-weight: bold;`);
    
    console.log(`%c├─ FPS: ${latestMetrics.fps.toFixed(1)} (avg: ${avgFps.toFixed(1)} over last 10 frames)`, 'color: #ff8844');
    console.log(`├─ Frame: #${latestMetrics.frameNumber}`);
    console.log(`├─ Duration: ${duration}s into gameplay`);
    console.log('│');

    console.log('%c├─ OBJECT COUNTS', 'color: #44aaff; font-weight: bold;');
    console.log(`│  ├─ Balls: ${latestMetrics.ballCount}`);
    console.log(`│  ├─ Bricks: ${latestMetrics.visibleBrickCount} visible / ${latestMetrics.totalBrickCount} total`);
    console.log(`│  ├─ Enemies: ${latestMetrics.enemyCount}`);
    console.log(`│  ├─ Power-ups: ${latestMetrics.powerUpCount}`);
    console.log(`│  ├─ Bullets: ${latestMetrics.bulletCount}`);
    console.log(`│  ├─ Explosions: ${latestMetrics.explosionCount}`);
    console.log(`│  ├─ Particles: ${latestMetrics.totalParticleCount}`);
    console.log(`│  ├─ Boss Attacks: ${latestMetrics.bossAttackCount}`);
    console.log(`│  ├─ Laser Warnings: ${latestMetrics.laserWarningCount}`);
    console.log(`│  ├─ Bombs: ${latestMetrics.bombCount}`);
    console.log(`│  ├─ Shield Impacts: ${latestMetrics.shieldImpactCount}`);
    console.log(`│  ├─ Bonus Letters: ${latestMetrics.bonusLetterCount}`);
    console.log(`│  └─ Total Active Objects: ${totalObjects}`);
    console.log('│');

    console.log('%c├─ CCD PERFORMANCE', 'color: #ff44ff; font-weight: bold;');
    console.log(`│  ├─ Total Time: ${latestMetrics.ccdTotalMs.toFixed(1)}ms`);
    console.log(`│  ├─ Substeps: ${latestMetrics.ccdSubsteps}`);
    console.log(`│  ├─ Collisions: ${latestMetrics.ccdCollisions}`);
    console.log(`│  └─ TOI Iterations: ${latestMetrics.ccdToiIterations}`);
    console.log('│');

    console.log('%c├─ RENDERING COMPLEXITY', 'color: #44ff44; font-weight: bold;');
    console.log(`│  ├─ Quality: ${latestMetrics.qualityLevel.toUpperCase()}`);
    console.log(`│  ├─ Boss Active: ${latestMetrics.hasActiveBoss ? 'Yes' : 'No'}`);
    console.log(`│  ├─ Screen Shake: ${latestMetrics.hasScreenShake ? 'Yes' : 'No'}`);
    console.log(`│  └─ Background Flash: ${latestMetrics.hasBackgroundFlash ? 'Yes' : 'No'}`);
    console.log('│');

    // Phase 4: Subsystem timings (if available)
    if (latestMetrics.simulationMs !== undefined || latestMetrics.renderMs !== undefined) {
      console.log('%c├─ SUBSYSTEM TIMING', 'color: #ff88ff; font-weight: bold;');
      if (latestMetrics.simulationMs !== undefined) console.log(`│  ├─ Simulation: ${latestMetrics.simulationMs.toFixed(2)}ms`);
      if (latestMetrics.renderMs !== undefined) console.log(`│  ├─ Render: ${latestMetrics.renderMs.toFixed(2)}ms`);
      if (latestMetrics.debugMs !== undefined) console.log(`│  ├─ Debug: ${latestMetrics.debugMs.toFixed(2)}ms`);
      if (latestMetrics.longFrameCount !== undefined) console.log(`│  └─ Long frames (>20ms): ${latestMetrics.longFrameCount}`);
      console.log('│');
    }

    // System resource metrics (if available)
    if (
      latestMetrics.cpuUsagePercent !== undefined ||
      latestMetrics.gpuTimeMs !== undefined ||
      latestMetrics.memoryUsedMB !== undefined ||
      latestMetrics.frameTimeMs !== undefined
    ) {
      console.log('%c├─ SYSTEM RESOURCES', 'color: #ff44aa; font-weight: bold;');
      if (latestMetrics.cpuUsagePercent !== undefined) {
        console.log(`│  ├─ CPU Usage: ${latestMetrics.cpuUsagePercent.toFixed(1)}%`);
      }
      if (latestMetrics.gpuTimeMs !== undefined) {
        console.log(`│  ├─ GPU Time: ${latestMetrics.gpuTimeMs.toFixed(2)}ms`);
      }
      if (latestMetrics.memoryUsedMB !== undefined) {
        console.log(`│  ├─ Memory: ${latestMetrics.memoryUsedMB.toFixed(0)}MB / ${latestMetrics.memoryTotalMB?.toFixed(0)}MB (${latestMetrics.memoryPercent?.toFixed(1)}%)`);
      }
      if (latestMetrics.frameTimeMs !== undefined) {
        console.log(`│  ├─ Frame Time: ${latestMetrics.frameTimeMs.toFixed(2)}ms`);
        if (latestMetrics.scriptTimeMs !== undefined) {
          console.log(`│  │  ├─ Script: ${latestMetrics.scriptTimeMs.toFixed(2)}ms`);
        }
        if (latestMetrics.layoutTimeMs !== undefined) {
          console.log(`│  │  ├─ Layout: ${latestMetrics.layoutTimeMs.toFixed(2)}ms`);
        }
        if (latestMetrics.paintTimeMs !== undefined) {
          console.log(`│  │  └─ Paint: ${latestMetrics.paintTimeMs.toFixed(2)}ms`);
        }
      }
      console.log('│');
    }

    if (bottlenecks.length > 0) {
      console.log('%c└─ BOTTLENECK ANALYSIS', 'color: #ffaa00; font-weight: bold;');
      bottlenecks.forEach((issue) => {
        console.log(`   ${issue}`);
      });
    } else {
      console.log('└─ No specific bottlenecks detected');
    }

    console.groupEnd();
  }

  private analyzeBottlenecks(metrics: FrameMetrics): string[] {
    const issues: string[] = [];

    if (metrics.totalParticleCount > PERFORMANCE_CONFIG.particleWarningCount) {
      issues.push(`⚠️ High particle count (${metrics.totalParticleCount}) - reduce explosion effects`);
    }

    if (metrics.ccdSubsteps > PERFORMANCE_CONFIG.substepWarningCount) {
      issues.push(`⚠️ High CCD substeps (${metrics.ccdSubsteps}) - multiple fast balls or high speed`);
    }

    if (metrics.ccdTotalMs > PERFORMANCE_CONFIG.ccdWarningMs) {
      issues.push(`⚠️ CCD taking ${metrics.ccdTotalMs.toFixed(1)}ms - collision detection overhead`);
    }

    const totalObjects =
      metrics.ballCount +
      metrics.visibleBrickCount +
      metrics.enemyCount +
      metrics.powerUpCount +
      metrics.bulletCount +
      metrics.explosionCount;

    if (totalObjects > PERFORMANCE_CONFIG.objectWarningCount) {
      issues.push(`⚠️ ${totalObjects} active objects - consider object pooling`);
    }

    if (metrics.hasActiveBoss && metrics.enemyCount > 6) {
      issues.push(`⚠️ Boss + ${metrics.enemyCount} enemies active - high entity count`);
    }

    if (metrics.ccdCollisions > PERFORMANCE_CONFIG.collisionWarningCount) {
      issues.push(`⚠️ ${metrics.ccdCollisions} collisions per frame - high collision density`);
    }

    // Memory pressure detection
    if (metrics.memoryPercent !== undefined && metrics.memoryPercent > PERFORMANCE_CONFIG.memoryWarningPercent) {
      issues.push(`⚠️ HIGH MEMORY USAGE: ${metrics.memoryPercent.toFixed(1)}% (${metrics.memoryUsedMB?.toFixed(0)}MB used)`);
    }

    // CPU bottleneck (main thread saturated)
    if (metrics.cpuUsagePercent !== undefined && metrics.cpuUsagePercent > PERFORMANCE_CONFIG.cpuWarningPercent) {
      issues.push(`🔥 CPU BOTTLENECK: ${metrics.cpuUsagePercent.toFixed(1)}% usage - main thread saturated`);
    }

    // GPU bottleneck
    if (metrics.gpuTimeMs !== undefined && metrics.gpuTimeMs > PERFORMANCE_CONFIG.gpuWarningMs) {
      issues.push(`🎨 GPU BOTTLENECK: ${metrics.gpuTimeMs.toFixed(2)}ms render time (target: <${PERFORMANCE_CONFIG.gpuWarningMs}ms)`);
    }

    // Long frame with breakdown
    if (metrics.frameTimeMs !== undefined && metrics.frameTimeMs > PERFORMANCE_CONFIG.frameBudgetMs) {
      issues.push(`⏱️  LONG FRAME: ${metrics.frameTimeMs.toFixed(2)}ms (target: ${PERFORMANCE_CONFIG.frameBudgetMs}ms for 60 FPS)`);
      if (metrics.scriptTimeMs !== undefined && metrics.scriptTimeMs > PERFORMANCE_CONFIG.scriptWarningMs) {
        issues.push(`   └─ JavaScript execution: ${metrics.scriptTimeMs.toFixed(2)}ms`);
      }
      if (metrics.layoutTimeMs !== undefined && metrics.layoutTimeMs > PERFORMANCE_CONFIG.layoutWarningMs) {
        issues.push(`   └─ Layout/Reflow: ${metrics.layoutTimeMs.toFixed(2)}ms`);
      }
      if (metrics.paintTimeMs !== undefined && metrics.paintTimeMs > PERFORMANCE_CONFIG.paintWarningMs) {
        issues.push(`   └─ Paint: ${metrics.paintTimeMs.toFixed(2)}ms`);
      }
    }

    // Low FPS with no bottleneck detected at all — likely a GPU driver or hardware issue
    if (metrics.fps < 40 && issues.length === 0) {
      issues.push(`❓ LOW FPS with no detected bottleneck - likely GPU/driver issue`);
      issues.push(`   Check: GPU acceleration enabled, hardware acceleration, graphics drivers`);
    }

    return issues;
  }

  getAverageMetrics(windowSize: number): FrameMetrics | null {
    if (this.frameHistory.length === 0) return null;

    const frames = this.frameHistory.slice(-Math.min(windowSize, this.frameHistory.length));
    const avgFps = frames.reduce((sum, f) => sum + f.fps, 0) / frames.length;

    return {
      ...frames[frames.length - 1],
      fps: avgFps
    };
  }

  getFrameSummary(): { totalObjects: number; avgFps: number } {
    if (this.frameHistory.length === 0) {
      return { totalObjects: 0, avgFps: 0 };
    }

    const latest = this.frameHistory[this.frameHistory.length - 1];
    const recentFrames = this.frameHistory.slice(-10);
    const avgFps = recentFrames.reduce((sum, f) => sum + f.fps, 0) / recentFrames.length;

    const totalObjects =
      latest.ballCount +
      latest.visibleBrickCount +
      latest.enemyCount +
      latest.powerUpCount +
      latest.bulletCount +
      latest.explosionCount;

    return { totalObjects, avgFps };
  }

  exportPerformanceLogs(): string {
    return JSON.stringify(
      {
        session: Date.now(),
        frames: this.frameHistory,
        summary: {
          avgFps: this.getAverageMetrics(this.frameHistory.length)?.fps || 0,
          minFps: Math.min(...this.frameHistory.map((f) => f.fps)),
          maxFps: Math.max(...this.frameHistory.map((f) => f.fps)),
          totalFrames: this.frameHistory.length
        }
      },
      null,
      2
    );
  }

  reset(): void {
    this.frameHistory = [];
    this.consecutiveLowFrames = 0;
    this.lastLogTime = 0;
    this.sessionStartTime = performance.now();
  }
}

// Export singleton instance
export const performanceProfiler = new PerformanceProfiler();

// Make it globally accessible for debugging
if (typeof window !== 'undefined') {
  (window as any).performanceProfiler = performanceProfiler;
}
