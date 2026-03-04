

# Force Resolution Scaling on Integrated GPUs in Fullscreen

## Problem
Currently, resolution scaling (`resolutionScale < 1.0`) only applies to the "low" quality preset (0.75). On integrated GPUs, medium and high quality still render at full resolution (1.0), which can cause GPU fill-rate bottlenecks — especially in fullscreen where the canvas is much larger.

## Solution
Override `resolutionScale` in `getQualitySettings()` when an integrated GPU is detected **and** the game is in fullscreen. This forces all quality levels to use reduced resolution rendering.

### Changes

**File: `src/hooks/useAdaptiveQuality.ts`**
- Add an `isFullscreen` parameter (boolean) that Game.tsx passes in, or expose a method to update it.
- In `getQualitySettings()`, when `hasIntegratedGPU` is true and fullscreen is active, override `resolutionScale` to a reduced value for medium (0.85) and high (0.75). Low already uses 0.75 so it stays.

**File: `src/components/Game.tsx`**
- Pass `isFullscreen` state into the adaptive quality hook or call a setter when fullscreen changes, so the hook can factor it into the quality settings.

### Scaling values per quality level (integrated GPU + fullscreen):
- **Low**: 0.75 (unchanged — already scaled)
- **Medium**: 0.85
- **High**: 0.75

This is a 2-file change. The render loop in `renderLoop.ts` already handles `resolutionScale < 1.0` correctly, so no changes needed there.

