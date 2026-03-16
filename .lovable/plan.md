

## Fix: Mobile Canvas Not Resizing Correctly

### Root Cause

The `.game-glow` container receives inline styles `width: 850px; height: 650px` (the logical canvas dimensions). On mobile viewports (~360px wide), this wrapper overflows the screen. The CSS constraints (`max-width: 92vw`) only apply to the `canvas` element inside, not to the `.game-glow` wrapper itself. The canvas shrinks but the wrapper stays at 850px, breaking the layout.

### Fix

**`src/components/Game.tsx`** (~lines 8506-8523):
- On mobile (`isMobileDevice`), do NOT set explicit `width`/`height` inline styles on the `.game-glow` div. Instead, let CSS handle sizing via `max-width`/`max-height` constraints.
- Change the mobile branch to only set `transform` and `transformOrigin` (both will be identity/neutral since `gameScale` is always 1 on mobile).

**`src/index.css`** (~lines 158-164):
- Add `max-width: 92vw` and `max-height: 75vh` constraints to `.game-glow` itself (not just its canvas child) in the mobile media query, so the wrapper also shrinks to fit the viewport.
- Add `width: fit-content` to `.game-glow` in the mobile media query so it wraps tightly around the canvas.

### Summary
Two small changes:
1. **Game.tsx**: Remove explicit `width`/`height` inline styles from `.game-glow` on mobile
2. **index.css**: Add matching size constraints to `.game-glow` wrapper on mobile (not just canvas)

