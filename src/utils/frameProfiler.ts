/**
 * Frame Profiler - Phase 1 of Performance Optimization System
 * 
 * Tracks per-frame timing for each subsystem:
 * - Physics/CCD
 * - Particles
 * - Bullets
 * - Enemies
 * - Power-ups
 * - Screen shake
 * - Audio
 * - Rendering
 * - Events
 */

export interface FrameTimings {
  total: number;
  physics: number;
  particles: number;
  bullets: number;
  enemies: number;
  powerUps: number;
  screenShake: number;
  audio: number;
  rendering: number;
  events: number;
}

export interface EventCounters {
  ccdEvents: number;
  collisions: number;
  bullets: number;
  explosions: number;
  particles: number;
  bricks: number;
  enemies: number;
}

export interface FrameProfilerStats {
  fps: number;
  frameTime: number;
  timings: FrameTimings;
  counters: EventCounters;
  bottlenecks: string[];
}

// Performance thresholds for bottleneck detection
const BOTTLENECK_THRESHOLDS: Record<keyof FrameTimings, number> = {
  total: 16.67, // 60 FPS
  physics: 5.0,
  particles: 3.0,
  bullets: 2.0,
  enemies: 2.0,
  powerUps: 1.0,
  screenShake: 0.5,
  audio: 1.0,
  rendering: 4.0,
  events: 2.0,
};

class FrameProfiler {
  private enabled: boolean = false;
  private frameStartTime: number = 0;
  private currentTimings: FrameTimings = this.createEmptyTimings();
  private timingStack: Map<keyof FrameTimings, number> = new Map();
  private counters: EventCounters = this.createEmptyCounters();
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private fps: number = 60;
  private bottleneckWarningCooldown: number = 0;

  private createEmptyTimings(): FrameTimings {
    return {
      total: 0,
      physics: 0,
      particles: 0,
      bullets: 0,
      enemies: 0,
      powerUps: 0,
      screenShake: 0,
      audio: 0,
      rendering: 0,
      events: 0,
    };
  }

  private createEmptyCounters(): EventCounters {
    return {
      ccdEvents: 0,
      collisions: 0,
      bullets: 0,
      explosions: 0,
      particles: 0,
      bricks: 0,
      enemies: 0,
    };
  }

  enable() {
    this.enabled = true;
    console.log('[FrameProfiler] Enabled');
  }

  disable() {
    this.enabled = false;
    console.log('[FrameProfiler] Disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  reset() {
    this.currentTimings = this.createEmptyTimings();
    this.counters = this.createEmptyCounters();
    this.frameCount = 0;
    this.fps = 60;
  }

  startFrame() {
    if (!this.enabled) return;
    
    this.frameStartTime = performance.now();
    this.currentTimings = this.createEmptyTimings();
    this.counters = this.createEmptyCounters();
  }

  endFrame() {
    if (!this.enabled) return;

    const now = performance.now();
    this.currentTimings.total = now - this.frameStartTime;

    // Update FPS
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    // Detect bottlenecks
    this.detectBottlenecks(now);
  }

  private detectBottlenecks(now: number) {
    const bottlenecks: string[] = [];

    // Check each subsystem against thresholds
    Object.entries(this.currentTimings).forEach(([key, value]) => {
      const threshold = BOTTLENECK_THRESHOLDS[key as keyof FrameTimings];
      if (threshold && value > threshold) {
        bottlenecks.push(`${key}: ${value.toFixed(2)}ms (threshold: ${threshold}ms)`);
      }
    });

    // Log warning if bottlenecks detected and cooldown passed
    if (bottlenecks.length > 0 && now - this.bottleneckWarningCooldown > 5000) {
      console.warn(
        `[FrameProfiler] ⚠️ Performance Bottlenecks Detected:\n` +
        bottlenecks.map(b => `  - ${b}`).join('\n') +
        `\n  Total Objects: ${this.counters.bricks + this.counters.enemies + this.counters.bullets + this.counters.particles}`
      );
      this.bottleneckWarningCooldown = now;
    }
  }

  startTiming(subsystem: keyof FrameTimings) {
    if (!this.enabled) return;
    this.timingStack.set(subsystem, performance.now());
  }

  endTiming(subsystem: keyof FrameTimings) {
    if (!this.enabled) return;
    
    const startTime = this.timingStack.get(subsystem);
    if (startTime !== undefined) {
      this.currentTimings[subsystem] += performance.now() - startTime;
      this.timingStack.delete(subsystem);
    }
  }

  incrementCounter(counter: keyof EventCounters, amount: number = 1) {
    if (!this.enabled) return;
    this.counters[counter] += amount;
  }

  getStats(): FrameProfilerStats {
    const bottlenecks: string[] = [];
    Object.entries(this.currentTimings).forEach(([key, value]) => {
      const threshold = BOTTLENECK_THRESHOLDS[key as keyof FrameTimings];
      if (threshold && value > threshold) {
        bottlenecks.push(key);
      }
    });

    return {
      fps: this.fps,
      frameTime: this.currentTimings.total,
      timings: { ...this.currentTimings },
      counters: { ...this.counters },
      bottlenecks,
    };
  }

  logStats() {
    if (!this.enabled) return;

    const stats = this.getStats();
    console.log(
      `[FrameProfiler] FPS: ${stats.fps} | Frame: ${stats.frameTime.toFixed(2)}ms | ` +
      `Physics: ${stats.timings.physics.toFixed(2)}ms | ` +
      `Particles: ${stats.timings.particles.toFixed(2)}ms | ` +
      `Rendering: ${stats.timings.rendering.toFixed(2)}ms | ` +
      `Events: ${stats.counters.collisions} collisions`
    );
  }
}

// Singleton instance
export const frameProfiler = new FrameProfiler();

// Make it globally accessible for debugging
if (typeof window !== 'undefined') {
  (window as any).frameProfiler = frameProfiler;
}
