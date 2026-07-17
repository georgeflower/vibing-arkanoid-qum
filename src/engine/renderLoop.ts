/**
 * engine/renderLoop.ts — Standalone requestAnimationFrame loop.
 *
 * Completely independent of React. Reads from `world` and `renderState`
 * every frame and calls `renderFrame()` to draw to the canvas.
 *
 * Returns a stop function for cleanup.
 */

import { world } from "@/engine/state";
import { renderState, type AssetRefs } from "@/engine/renderState";
import { renderFrame } from "@/engine/canvasRenderer";

/**
 * Start the render loop. Calls renderFrame every animation frame.
 * @returns A cleanup function that stops the loop.
 */
// Adaptive render cap — 120 FPS target for high-end, scales down for low quality
// This prevents GPU exhaustion on high-refresh displays with integrated graphics
// while allowing smoother rendering on capable hardware.
const TARGET_FPS_HIGH = 120;
const TARGET_FPS_LOW = 60;
const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
let currentTargetFps = TARGET_FPS_HIGH;

// ─── Vsync-aligned pacing ───
// Wall-clock frame skipping judders on panels whose refresh isn't a multiple
// of the target (Android 90Hz / adaptive LTPO). Instead: estimate the real
// refresh rate from rAF deltas and render every Nth tick — even cadence on
// any panel, self-adjusting when adaptive refresh switches rates.
let refreshEstimateMs = 1000 / 60; // EMA of rAF tick deltas
let lastTickTimestamp = 0;
let tickCounter = 0;
let frameDivider = 1;

function updateRefreshEstimate(timestamp: number): void {
  if (lastTickTimestamp > 0) {
    const delta = timestamp - lastTickTimestamp;
    // Ignore outliers (tab background, GC stalls)
    if (delta > 2 && delta < 100) {
      refreshEstimateMs = refreshEstimateMs * 0.95 + delta * 0.05;
    }
  }
  lastTickTimestamp = timestamp;
}

function computeFrameDivider(): number {
  if (currentTargetFps <= 0) return 1; // 0 = native/uncapped
  const refreshFps = 1000 / refreshEstimateMs;
  // ceil: never exceed the target; render every Nth vsync tick evenly.
  // 60Hz/60 -> 1, 120Hz/60 -> 2, 90Hz/60 -> 2 (even 45), 90Hz/30 -> 3 (even 30)
  return Math.max(1, Math.ceil(refreshFps / currentTargetFps - 0.05)); // -0.05 tolerance for 60.1Hz-style jitter
}

/** Update the render target FPS based on quality level */
export function setRenderTargetFps(qualityLevel: "potato" | "low" | "medium" | "high"): void {
  const TARGET_FPS_POTATO = 30;
  let newTarget: number;
  if (qualityLevel === "potato") {
    newTarget = TARGET_FPS_POTATO;
  } else if (qualityLevel === "low") {
    newTarget = TARGET_FPS_LOW;
  } else if (IS_MOBILE) {
    newTarget = 0; // medium/high on mobile: render every vsync tick (native rate)
  } else {
    newTarget = TARGET_FPS_HIGH;
  }
  if (newTarget !== currentTargetFps) {
    currentTargetFps = newTarget;
  }
}


export function startRenderLoop(canvas: HTMLCanvasElement, assets: AssetRefs): () => void {
  const ctx = canvas.getContext("2d", {
    // alpha: false eliminates per-pixel alpha compositing when painting the
    // canvas to the page — a significant GPU bandwidth win on integrated GPUs.
    alpha: false,
    // NOTE: desynchronized: true was removed because it causes canvas content
    // to disappear on integrated GPUs (e.g. HP laptops with Intel/AMD iGPU).
    // The async compositor path it enables is not reliably supported by all
    // 2D canvas implementations and leads to a blank gameplay area after a
    // brief blink on affected hardware.
  });
  if (!ctx) {
    console.error("[RenderLoop] Failed to get 2D context");
    return () => {};
  }

  // Apply the FPS cap for the current quality setting right away so that the
  // first frames honour it.  Game.tsx will also call setRenderTargetFps() when
  // its quality-settings effect fires, but that happens one React cycle after
  // the loop is already running.
  setRenderTargetFps(renderState.qualitySettings.level);

  // Disable bilinear filtering — not needed for pixel-art assets and saves
  // GPU fill-rate on every drawImage call.
  ctx.imageSmoothingEnabled = false;

  let rafId: number | null = null;
  let running = true;
  lastTickTimestamp = 0;
  tickCounter = 0;


  // Offscreen canvas for resolution scaling.
  // Eagerly create it for the current quality setting so that the very first
  // render frame doesn't incur a canvas-creation and context-allocation cost.
  // When quality changes the loop lazily re-creates it inside the frame loop.
  let offCanvas: HTMLCanvasElement | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;
  let offW = 0;
  let offH = 0;

  const initialScale = renderState.qualitySettings.resolutionScale;
  if (initialScale < 1.0) {
    offW = Math.round(renderState.width * initialScale);
    offH = Math.round(renderState.height * initialScale);
    offCanvas = document.createElement("canvas");
    offCanvas.width = offW;
    offCanvas.height = offH;
    offCtx = offCanvas.getContext("2d", { alpha: false });
    if (offCtx) offCtx.imageSmoothingEnabled = false;
  }

  const loop = (timestamp: number) => {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    // Skip frame if not enough time has elapsed (adaptive cap)
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < minFrameInterval) return;
    lastFrameTime = timestamp - (elapsed % minFrameInterval);

    const now = performance.now();
    const scale = renderState.qualitySettings.resolutionScale;

    if (scale < 1.0) {
      // Render at reduced resolution then upscale
      const scaledW = Math.round(renderState.width * scale);
      const scaledH = Math.round(renderState.height * scale);

      // Re-create offscreen canvas when quality changes the resolution scale
      if (!offCanvas || offW !== scaledW || offH !== scaledH) {
        offCanvas = document.createElement("canvas");
        offCanvas.width = scaledW;
        offCanvas.height = scaledH;
        offCtx = offCanvas.getContext("2d", { alpha: false });
        if (offCtx) offCtx.imageSmoothingEnabled = false;
        offW = scaledW;
        offH = scaledH;
      }

      if (offCtx) {
        // Apply scale transform so the renderer draws in the original
        // coordinate space but the GPU rasterizes fewer pixels.
        offCtx.setTransform(scale, 0, 0, scale, 0, 0);

        const alphaRaw = (now - world.lastPhysicsUpdateTime) / world.lastPhysicsDtMs;
        const alpha = Math.min(1, Math.max(0, alphaRaw));

        renderFrame(offCtx, world, renderState, assets, now, alpha);

        // Reset transform for next frame
        offCtx.setTransform(1, 0, 0, 1, 0, 0);

        // Upscale to visible canvas
        ctx.drawImage(offCanvas, 0, 0, renderState.width, renderState.height);
      }
    } else {
      const alphaRaw = (now - world.lastPhysicsUpdateTime) / world.lastPhysicsDtMs;
      const alpha = Math.min(1, Math.max(0, alphaRaw));
      renderFrame(ctx, world, renderState, assets, now, alpha);
    }
  };

  // Kick off
  rafId = requestAnimationFrame(loop);

  // Return stop function
  return () => {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
/**
 * Pre-create offscreen canvas contexts for every sub-1.0 resolution scale used
 * by the quality presets (potato: 0.25, low: 0.75, medium: 0.8).  Creating a
 * canvas and drawing to it forces the browser/GPU driver to compile the 2D
 * compositing shaders for that exact format and size.  Without this warm-up the
 * compilation happens on the first gameplay frame, causing a 30 FPS stall for
 * several seconds on integrated GPUs.
 *
 * @param width  - Logical canvas width (renderState.width)
 * @param height - Logical canvas height (renderState.height)
 */
export function warmUpCanvasContexts(width: number, height: number): void {
  // All resolution scales < 1.0 that appear in QUALITY_PRESETS
  const subScales = [0.25, 0.75, 0.8];

  subScales.forEach((scale) => {
    const scaledW = Math.round(width * scale);
    const scaledH = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = scaledW;
    canvas.height = scaledH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // A minimal draw forces GPU shader/pipeline compilation for this context.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, scaledW, scaledH);

    // Shrink the canvas immediately to release GPU texture memory.
    canvas.width = 0;
    canvas.height = 0;
  });
}
