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
let currentTargetFps = TARGET_FPS_HIGH;
let minFrameInterval = 1000 / currentTargetFps;

/** Update the render target FPS based on quality level */
export function setRenderTargetFps(qualityLevel: "potato" | "low" | "medium" | "high"): void {
  const TARGET_FPS_POTATO = 30;
  const newTarget = qualityLevel === "potato" ? TARGET_FPS_POTATO : qualityLevel === "low" ? TARGET_FPS_LOW : TARGET_FPS_HIGH;
  if (newTarget !== currentTargetFps) {
    currentTargetFps = newTarget;
    minFrameInterval = 1000 / currentTargetFps;
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
  let lastFrameTime = 0;

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

        renderFrame(offCtx, world, renderState, assets, now);

        // Reset transform for next frame
        offCtx.setTransform(1, 0, 0, 1, 0, 0);

        // Upscale to visible canvas
        ctx.drawImage(offCanvas, 0, 0, renderState.width, renderState.height);
      }
    } else {
      renderFrame(ctx, world, renderState, assets, now);
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
