

# Fix Resolution Scaling (Zoom-In Bug)

## Root Cause

The current implementation temporarily overrides `renderState.width` and `renderState.height` to the scaled-down values (e.g., 637x487 instead of 850x650). However, all game entities (balls, paddle, bricks, enemies, bosses) have positions calculated for the original 850x650 coordinate space. The renderer clips entities outside the smaller canvas, and the subsequent upscale produces a "zoomed in" effect showing only a portion of the game area.

## Fix

**File: `src/engine/renderLoop.ts`**

Instead of overriding renderState dimensions, apply a `ctx.scale(scale, scale)` transform on the offscreen context. This way:
- The offscreen canvas is still smaller (fewer pixels to fill = GPU savings)
- The renderer still sees the original `width` and `height` from renderState
- All entity positions remain correct in the original coordinate space
- The scale transform makes the GPU rasterize at reduced resolution
- The final `drawImage` upscales to the visible canvas

```text
Before (broken):
  offscreen canvas = 637x487
  renderState.width/height = 637x487   <-- entities clip!
  renderFrame draws at wrong scale
  drawImage upscales = zoomed in

After (fixed):
  offscreen canvas = 637x487
  offCtx.scale(0.75, 0.75)             <-- GPU draws fewer pixels
  renderState.width/height = 850x650   <-- unchanged, entities correct
  renderFrame draws full scene
  drawImage upscales = correct view at lower resolution
```

### Specific changes (lines 80-111):

Remove the `renderState.width/height` override. Instead:
1. Clear the offscreen canvas
2. Apply `offCtx.scale(scale, scale)` before calling `renderFrame`
3. Call `renderFrame` with the offscreen context but **original** renderState (no dimension override)
4. Reset the transform after rendering
5. Upscale to visible canvas with `ctx.drawImage`

This is a single-file change to `src/engine/renderLoop.ts`, approximately 10 lines modified.

