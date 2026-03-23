

## Fix: FPS Overlay Shows Above 60 on Mobile

### Problem
The `FpsOverlay` component runs its own independent `requestAnimationFrame` loop that counts every browser callback. On high-refresh-rate mobile screens (90/120Hz), it reports the browser's native refresh rate rather than the game's capped frame rate. The game loop and render loop correctly skip frames to stay at 60 FPS on mobile, but the FPS counter doesn't know about that cap.

### Fix

**`src/components/FpsOverlay.tsx`** — Accept an `isMobile` prop and apply the same frame-skipping pattern used in `renderLoop.ts`:

- Add a `minInterval` based on `isMobile` (16.67ms for mobile = 60 FPS cap, ~8.33ms for desktop = 120 FPS)
- Track `lastAcceptedTime` and skip rAF callbacks that arrive too soon
- Only count frames that pass the interval check toward the FPS calculation

**`src/components/Game.tsx`** (or wherever `FpsOverlay` is rendered) — Pass `isMobile={isMobileDevice}` to the overlay.

### Files
- `src/components/FpsOverlay.tsx` — add frame-skipping logic
- `src/components/Game.tsx` — pass `isMobile` prop

