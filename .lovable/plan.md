

## Fix: Mobile Canvas Scaling + Settings Dialog Invisible on Mobile

### Issue 1: Canvas Too Small on Mobile

**Root cause**: The previous fix added `transform: scale(mobileScale)` to the game-glow container on mobile. But the CSS already handles mobile canvas scaling via `max-width: 92vw` / `max-height: 75vh` constraints on the canvas element (line 160-163 in index.css), and mobile-fullscreen CSS forces `width: 100vw !important`. The transform results in **double scaling** — the CSS shrinks the canvas to fit, then the transform shrinks it again.

**Fix in `src/components/Game.tsx`** (~lines 8288-8314):
- Revert mobile branches to `setGameScale(1)` — let the existing CSS handle viewport-fitting on mobile
- The `mobileScale` calculation and `transform: scale()` approach conflicts