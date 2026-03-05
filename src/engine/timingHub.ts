/**
 * Centralized timing hub for game and render loops.
 * Provides consistent high-resolution timestamps across the entire application.
 *
 * Usage:
 *   - Call timingHub.update(timestamp) once per frame at the start of the game loop.
 *   - Use timingHub.now everywhere instead of Date.now() or performance.now().
 */

export class TimingHub {
  private _now: number = performance.now();
  private _deltaMs: number = 0;
  private _lastUpdate: number = 0;
  private _totalTime: number = 0;

  /**
   * Update timing state (call once per frame at the start of game loop).
   * @param timestamp High-resolution timestamp from requestAnimationFrame
   */
  update(timestamp: number): void {
    // On the first call, seed _lastUpdate to avoid a large initial delta
    if (this._lastUpdate === 0) {
      this._lastUpdate = timestamp;
    }
    this._deltaMs = timestamp - this._lastUpdate;
    this._lastUpdate = timestamp;
    this._now = timestamp;
    this._totalTime += this._deltaMs;
  }

  /**
   * Get current high-resolution timestamp (milliseconds).
   * Use this instead of Date.now() or performance.now() for game timing.
   */
  get now(): number {
    return this._now;
  }

  /**
   * Get delta time in seconds (clamped for safety).
   * @param maxDelta Maximum delta in seconds (default 0.05 = 50ms)
   */
  getDeltaSeconds(maxDelta: number = 0.05): number {
    return Math.min(this._deltaMs / 1000, maxDelta);
  }

  /**
   * Get raw delta in milliseconds.
   */
  get deltaMs(): number {
    return this._deltaMs;
  }

  /**
   * Get total accumulated time since start (milliseconds).
   */
  get totalTime(): number {
    return this._totalTime;
  }
}

// Export singleton instance
export const timingHub = new TimingHub();

// Make globally accessible for debugging
if (typeof window !== "undefined") {
  (window as any).timingHub = timingHub;
}
