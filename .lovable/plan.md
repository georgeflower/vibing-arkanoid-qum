

## Fix: FPS Overlay Hidden Behind Debug Flag + Mobile Canvas Too Small After Resolution Change

### Issue 1: FPS Overlay Not Showing

The `FpsOverlay` component (line 9067) is nested inside the `{ENABLE_DEBUG_FEATURES && (...)}` block (line 9039). It only renders when the debug constant is true, making the user setting in Video tab ineffective.

**Fix in `src/components/Game.tsx`:**
- Move the `<FpsOverlay visible={gameSettingsData.showFpsOverlay} />` line **outside** the `{ENABLE_DEBUG_FEATURES && (...)}` block, placing it right after the debug block closes (after line 9104).

### Issue 2: Canvas Super Small on Mobile After Resolution Change

When resolution changes to Kartoffel (640×480), `SCALED_CANVAS_WIDTH/HEIGHT` becomes 640×480. On mobile, `gameScale` is hardcoded to `1` (lines 8296, 8308), so the canvas renders at its native 640×480 pixels — far too small for the phone screen.

On mobile, the game should always scale the canvas to fill the available viewport width, regardless of the logical resolution.

**Fix in `src/components/Game.tsx` (~lines 8288-8312, mobile layout logic):**
- Calculate a viewport-fitting scale for mobile: `const mobileScale = Math.min(containerWidth / SCALED_CANVAS_WIDTH, containerHeight / SCALED_CANVAS_HEIGHT);`
- Use this instead of hardcoded `setGameScale(1)` in both the fullscreen and normal mobile branches.

This ensures that whether the logical resolution is 850×650 or 640×480, the canvas always scales up to fill the phone's viewport.

