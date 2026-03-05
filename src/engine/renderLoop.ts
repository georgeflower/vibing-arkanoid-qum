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
export function setRenderTargetFps(qualityLevel: "low" | "medium" | "high"): void {
  const newTarget = qualityLevel === "low" ? TARGET_FPS_LOW : TARGET_FPS_HIGH;
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

  // Disable bilinear filtering — not needed for pixel-art assets and saves
  // GPU fill-rate on every drawImage call.
  ctx.imageSmoothingEnabled = false;

  let rafId: number | null = null;
  let running = true;
  let lastFrameTime = 0;

  // Offscreen canvas for resolution scaling (lazily created)
  let offCanvas: HTMLCanvasElement | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;
  let offW = 0;
  let offH = 0;

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

      // Lazily create / resize offscreen canvas
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
