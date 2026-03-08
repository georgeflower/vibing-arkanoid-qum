

## Fix: Danger Ball Gravity & Cannon Flash

### Bug 1: Danger Ball Gravity — Time Base Mismatch

**Root cause**: `spawnTime` is set via `Date.now()` (epoch ms, ~1.7 trillion) but compared against `performance.now()` (page-relative, ~thousands) on line 66 of `megaBossAttacks.ts`. The resulting `ageSeconds` is always a massive negative number, so gravity never activates.

**Fix in `src/utils/megaBossAttacks.ts`**:
- Change `spawnTime: Date.now()` → `spawnTime: performance.now()` in `spawnDangerBall` (line 50)
- Increase gravity strength: change multiplier from `3600` to `7200` (double it) for a more noticeable pull

### Bug 2: Cannon Muzzle Flash

The `Date.now()` fix was correct for `timeToFire`. However, the blink animation on line 3574 uses the renderer's `now` (performance.now). If `isPreFireWarning` is correctly true, the blink should work. Let me verify there isn't another issue — the `nextCannonFireTime` is set in Game.tsx using `Date.now()`, and we compare with `Date.now()` in the renderer. This should be correct now. If it's still not working, it may be that the cannon isn't extended (`cannonExtended` is false) so the cannon section doesn't render at all. I'll check the cannon rendering condition.

**Verify in `src/engine/canvasRenderer.ts`**: Check if the cannon drawing section is gated behind a condition that prevents it from showing. If the cannon only renders when `cannonExtended` is true, and that flag isn't being set, the flash would never be visible regardless.

### Files Changed

| File | Change |
|------|--------|
| `src/utils/megaBossAttacks.ts` | Fix `spawnTime` to use `performance.now()`; increase gravity multiplier to `7200` |
| `src/engine/canvasRenderer.ts` | Verify cannon render condition; fix if needed |

