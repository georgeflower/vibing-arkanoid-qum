

# Potato Quality: 25% Resolution, Maximum Performance

## Changes

**`src/hooks/useAdaptiveQuality.ts`** (line 44)
- Change `resolutionScale: 0.5` → `resolutionScale: 0.25` in the `potato` preset

That's the only code change needed. Here's why:

- **CRT already disabled** for potato quality (CRTOverlay returns null when `quality === 'potato'`)
- **All effects already off** (particles 0, glow off, shadows off, screen shake off, background effects off, all granular toggles off)
- **FPS already capped at 30** in renderLoop for potato
- **Zoom compensation already works** — the render loop renders at 25% resolution (e.g. 212×162 for an 850×650 canvas) using an offscreen canvas with `ctx.setTransform(0.25, ...)`, then upscales via `drawImage` to fill the visible canvas. The game logic coordinates stay at full resolution — only GPU rasterization is reduced.

This gives potato quality ~6× fewer pixels to rasterize compared to the current 50% setting (0.25² = 6.25% vs 0.5² = 25% of full pixel count), making it viable on very old hardware.

