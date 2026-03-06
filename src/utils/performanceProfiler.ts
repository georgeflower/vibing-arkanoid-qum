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
  logCooldownMs: 2000,
  consecutiveThreshold: 3,
  particleWarningCount: 150,
  substepWarningCount: 15,
  ccdWarningMs: 10,
  objectWarningCount: 150,
  collisionWarningCount: 25
};

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
