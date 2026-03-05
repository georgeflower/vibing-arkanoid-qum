/**
 * engine/unifiedLoop.ts — Unified game loop with fixed-timestep physics
 * and variable-rate rendering.
 *
 * Physics runs at a fixed 60 Hz cadence (deterministic, consistent across
 * devices) while rendering runs at the display refresh rate. An accumulator
 * absorbs the difference so neither loop starves the other.
 *
 * Based on Glenn Fiedler's "Fix Your Timestep":
 * https://gafferongames.com/post/fix_your_timestep/
 *
 * Replaces the dual-loop architecture (Game.tsx game loop + renderLoop.ts
 * render loop) with a single requestAnimationFrame loop that handles both
 * physics stepping and rendering.
 */

import { world } from "@/engine/state";
import { renderState, assets } from "@/engine/renderState";
import { renderFrame } from "@/engine/canvasRenderer";
import { FIXED_PHYSICS_TIMESTEP, MAX_DELTA_MS } from "@/constants/gameLoopConfig";

/** Fixed physics timestep in milliseconds (16.666…ms = 60 Hz). */
const FIXED_TIMESTEP_MS = FIXED_PHYSICS_TIMESTEP * 1000;

/**
 * Maximum physics steps allowed per display frame.
 * Caps the "spiral of death" when the device falls badly behind (e.g. 5 Hz
 * display would normally need 12 steps; capping at 5 limits catchup to ~83ms
 * of game time per frame). When the cap is reached the accumulator retains
 * the overflow, gradually slowing the simulation rather than crashing.
 */
const MAX_PHYSICS_STEPS = 5;

// ─── Render FPS cap ──────────────────────────────────────────────────────────
// On low-quality settings an explicit 60 FPS render cap saves GPU fill-rate
// on integrated/mobile GPUs. High-quality defaults to 120 FPS.
let minRenderIntervalMs = 1000 / 120; // default: 120 FPS cap

/**
 * Adjust the render FPS cap based on the active quality level.
 * Replaces the equivalent function that was previously in renderLoop.ts.
 */
export function setRenderTargetFps(qualityLevel: "low" | "medium" | "high"): void {
  const targetFps = qualityLevel === "low" ? 60 : 120;
  minRenderIntervalMs = 1000 / targetFps;
}

// ─── Callback interface ───────────────────────────────────────────────────────

export interface UnifiedLoopCallbacks {
  /** Called once per fixed physics step. dt is always FIXED_PHYSICS_TIMESTEP seconds. */
  onPhysicsStep: (dtSeconds: number) => void;
  /**
   * Called once per display frame with the interpolation alpha in [0, 1).
   * Alpha = accumulator / FIXED_TIMESTEP_MS — can be used to lerp between
   * the previous and current physics states for extra-smooth rendering.
   */
  onRender: (alpha: number) => void;
  /** Returns the current time scale (e.g. 0.5 = slow-mo, 1.0 = normal). */
  getTimeScale: () => number;
}

// ─── UnifiedGameLoop class ────────────────────────────────────────────────────

export class UnifiedGameLoop {
  private running = false;
  private rafId: number | null = null;

  /** Accumulated "game time" waiting to be consumed by physics steps (ms). */
  private accumulator = 0;
  private lastTimestamp = 0;
  private lastRenderTimestamp = 0;

  /** Deterministic frame counter — incremented once per physics step. */
  private frameTick = 0;

  // FPS tracking (render FPS, not physics FPS)
  private renderFrameCount = 0;
  private fpsTimer = 0;
  private currentFps = 60;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: UnifiedLoopCallbacks;

  // Offscreen canvas for resolution scaling (lazily created/resized)
  private offCanvas: HTMLCanvasElement | null = null;
  private offCtx: CanvasRenderingContext2D | null = null;
  private offW = 0;
  private offH = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: UnifiedLoopCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    const ctx = canvas.getContext("2d", {
      // alpha: false eliminates per-pixel alpha compositing — GPU bandwidth win.
      alpha: false,
    });
    if (!ctx) throw new Error("[UnifiedGameLoop] Failed to get 2D context");
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.lastRenderTimestamp = this.lastTimestamp;
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Deterministic frame tick counter.
   * Incremented once per fixed physics step (not per display frame).
   * Use this wherever FixedStepGameLoop.getFrameTick() was used before.
   */
  getFrameTick(): number {
    return this.frameTick;
  }

  /** Current render FPS (updated once per second). */
  getFPS(): number {
    return this.currentFps;
  }

  private loop = (timestamp: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    // Cap frame time to prevent spiral-of-death on tab resume / GC pauses.
    let frameTime = timestamp - this.lastTimestamp;
    if (frameTime > MAX_DELTA_MS) frameTime = MAX_DELTA_MS;
    this.lastTimestamp = timestamp;

    // Update render FPS (counts display frames, not physics steps)
    this.renderFrameCount++;
    if (timestamp - this.fpsTimer >= 1000) {
      this.currentFps = Math.round(
        (this.renderFrameCount * 1000) / (timestamp - this.fpsTimer),
      );
      this.renderFrameCount = 0;
      this.fpsTimer = timestamp;
    }

    // Accumulate scaled game time
    const timeScale = this.callbacks.getTimeScale();
    this.accumulator += frameTime * timeScale;

    // Drain the accumulator with fixed-size physics steps
    let physicsSteps = 0;
    while (this.accumulator >= FIXED_TIMESTEP_MS && physicsSteps < MAX_PHYSICS_STEPS) {
      this.callbacks.onPhysicsStep(FIXED_PHYSICS_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP_MS;
      physicsSteps++;
      this.frameTick++;
    }

    // Optional render FPS cap (saves GPU fill-rate on low-quality / mobile)
    const renderElapsed = timestamp - this.lastRenderTimestamp;
    if (renderElapsed < minRenderIntervalMs) return;
    // Carry forward fractional frame time so the next render deadline stays
    // accurate (prevents gradual drift from the target interval).
    this.lastRenderTimestamp = timestamp - (renderElapsed % minRenderIntervalMs);

    // Notify caller with interpolation alpha for optional position blending
    const alpha = this.accumulator / FIXED_TIMESTEP_MS;
    this.callbacks.onRender(alpha);

    // Render current world state to canvas
    this.render();
  };

  private render(): void {
    const scale = renderState.qualitySettings.resolutionScale;
    const now = performance.now();

    if (scale < 1.0) {
      // Render at reduced resolution then upscale — saves GPU fill-rate
      const scaledW = Math.round(renderState.width * scale);
      const scaledH = Math.round(renderState.height * scale);

      // Lazily create / resize offscreen canvas
      if (!this.offCanvas || this.offW !== scaledW || this.offH !== scaledH) {
        this.offCanvas = document.createElement("canvas");
        this.offCanvas.width = scaledW;
        this.offCanvas.height = scaledH;
        this.offCtx = this.offCanvas.getContext("2d", { alpha: false });
        if (this.offCtx) this.offCtx.imageSmoothingEnabled = false;
        this.offW = scaledW;
        this.offH = scaledH;
      }

      if (this.offCtx) {
        // Draw in original coordinate space; GPU rasterises fewer pixels
        this.offCtx.setTransform(scale, 0, 0, scale, 0, 0);
        renderFrame(this.offCtx, world, renderState, assets, now);
        this.offCtx.setTransform(1, 0, 0, 1, 0, 0);
        // Upscale to the visible canvas
        this.ctx.drawImage(this.offCanvas, 0, 0, renderState.width, renderState.height);
      }
    } else {
      renderFrame(this.ctx, world, renderState, assets, now);
    }
  }
}
