/**
 * Simplified game loop utility for frame counting and pause/resume management
 *
 * Features:
 * - Frame tick counter for deterministic cooldowns
 * - FPS tracking
 * - Pause/resume support
 * - TimeScale support
 */

export interface GameLoopConfig {
  maxDeltaMs: number; // max frame delta to prevent issues (default 250ms)
  timeScale: number; // 1.0 = normal speed, 0.5 = half speed, etc.
  fpsCapMs: number; // minimum milliseconds between frames (default ~8.33ms = 120 FPS cap)
}

export interface GameLoopState {
  lastTime: number;
  isPaused: boolean;
  fps: number;
}

export interface GameLoopDebug {
  fps: number;
  frameTick: number;
  timeScale: number;
  maxDeltaMs: number;
  fpsCapMs: number;
}

export class FixedStepGameLoop {
  private config: GameLoopConfig;
  private state: GameLoopState;
  private frameCount: number = 0;
  private frameTick: number = 0; // Deterministic frame counter
  private fpsLastTime: number = 0;
  private animationFrameId: number | null = null;

  constructor(config?: Partial<GameLoopConfig>) {
    this.config = {
      maxDeltaMs: 250,
      timeScale: 1,
      fpsCapMs: 1000 / 120,
      ...config,
    };

    this.state = {
      lastTime: performance.now(),
      isPaused: false,
      fps: 60,
    };
  }

  /**
   * Start the game loop (for FPS tracking and frame counting)
   */
  start() {
    if (this.animationFrameId !== null) return;

    this.state.lastTime = performance.now();
    this.fpsLastTime = this.state.lastTime;
    this.frameCount = 0;

    this.loop(this.state.lastTime);
  }

  /**
   * Stop the game loop
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main loop - tracks FPS and increments frameTick
   */
  private loop = (currentTime: number) => {
    this.animationFrameId = requestAnimationFrame(this.loop);

    // Skip frame if it occurs too soon (FPS cap)
    if (currentTime - this.state.lastTime < this.config.fpsCapMs) {
      return;
    }

    this.state.lastTime = currentTime;

    // Update FPS counter
    this.frameCount++;
    if (currentTime - this.fpsLastTime >= 1000) {
      this.state.fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsLastTime));
      this.frameCount = 0;
      this.fpsLastTime = currentTime;
    }

    // Increment frame tick when not paused
    if (!this.state.isPaused) {
      this.frameTick++;
    }
  };

  /**
   * Pause the game loop
   */
  pause() {
    this.state.isPaused = true;
  }

  /**
   * Resume the game loop
   */
  resume() {
    this.state.isPaused = false;
    // Reset last time to prevent huge delta
    this.state.lastTime = performance.now();
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    if (this.state.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Set time scale (0.5 = half speed, 2.0 = double speed)
   */
  setTimeScale(scale: number) {
    this.config.timeScale = Math.max(0, scale);
  }

  /**
   * Get current time scale
   */
  getTimeScale(): number {
    return this.config.timeScale;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Get debug info
   */
  getDebugInfo(): GameLoopDebug {
    return {
      fps: this.state.fps,
      frameTick: this.frameTick,
      timeScale: this.config.timeScale,
      maxDeltaMs: this.config.maxDeltaMs,
      fpsCapMs: this.config.fpsCapMs,
    };
  }

  /**
   * Get current state
   */
  getState(): GameLoopState {
    return { ...this.state };
  }

  /**
   * Get current frame tick (deterministic counter)
   */
  getFrameTick(): number {
    return this.frameTick;
  }
}
