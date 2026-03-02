

# Fix Build Error + Add Resolution Scaling for Extreme Low-End GPUs

## Step 1: Fix package.json syntax error (blocking build)

**File: `package.json`**

Line 11 is missing a comma after `"preview": "vite preview"`, and line 12 has an `"start"` entry that breaks JSON parsing. Also line 13-14 have a misplaced `}` and extra blank line.

Fix: add comma after line 11, and move the closing `}` for scripts to line 13.

---

## Step 2: Add `resolutionScale` to the quality system

**File: `src/hooks/useAdaptiveQuality.ts`**

- Add `resolutionScale: number` to `QualitySettings` interface
- Set preset values:
  - `low`: `resolutionScale: 0.75` (render at 75% resolution)
  - `medium`: `resolutionScale: 1.0`
  - `high`: `resolutionScale: 1.0`

---

## Step 3: Add `resolutionScale` to renderState default

**File: `src/engine/renderState.ts`**

The default `qualitySettings` spreads from `QUALITY_PRESETS.medium`, so `resolutionScale: 1.0` will be included automatically. No change needed.

---

## Step 4: Implement resolution scaling in the render loop

**File: `src/engine/renderLoop.ts`**

When `renderState.qualitySettings.resolutionScale < 1.0`:
1. Create an offscreen canvas at `width * scale` x `height * scale`
2. Call `renderFrame` with the offscreen context and scaled dimensions
3. Draw the offscreen canvas onto the visible canvas using `ctx.drawImage()` which upscales it

When scale is 1.0 (medium/high), render directly to the main canvas as before (zero overhead).

The offscreen canvas is created lazily and reused across frames. It's only recreated if the scale or dimensions change.

---

## Step 5: Pass scaled dimensions to renderFrame

**File: `src/engine/canvasRenderer.ts`**

The `renderFrame` function already reads `rs.width` and `rs.height` from the render state. The render loop will temporarily override these to the scaled values when rendering to the offscreen canvas, then restore them. This means all rendering code (backgrounds, entities, HUD) automatically works at reduced resolution with no changes needed inside canvasRenderer.

---

## Summary of changes

| File | Change |
|------|--------|
| `package.json` | Fix JSON syntax error (missing comma) |
| `src/hooks/useAdaptiveQuality.ts` | Add `resolutionScale` field to interface + presets |
| `src/engine/renderLoop.ts` | Offscreen canvas rendering when scale < 1.0 |

No changes to `canvasRenderer.ts` or `GameCanvas.tsx` -- the scaling is transparent to the rest of the rendering pipeline.

