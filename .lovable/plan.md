

## Fix: Danger Ball Gravity & Cannon Muzzle Flash

### Bug 1: Danger Ball Gravity Not Working

**Root cause**: `BALL_GRAVITY` (0.015) is a per-frame value designed for 60fps frame-based physics. But danger ball velocities (`dx`/`dy`) are in **px/s** (180 px/s). Adding 0.015 to 180 each frame is negligible — effectively zero gravity.

**Fix in `src/utils/megaBossAttacks.ts`** (`updateDangerBall`):
- Convert gravity to px/s² units: multiply `BALL_GRAVITY` by `3600` (60fps × 60 to get per-second-squared), then multiply by `deltaTimeSeconds` for frame-rate independence.
- Result: `newDy += BALL_GRAVITY * 3600 * gravityMultiplier * deltaTimeSeconds`

### Bug 2: Cannon Muzzle Flash Not Working

**Root cause**: `nextCannonFireTime` is set using `Date.now()` (epoch ms, ~1.7 trillion) in `Game.tsx`, but the renderer's `now` parameter comes from `performance.now()` (page-relative, ~thousands). The difference `nextCannonFireTime - now` is always enormous, so the pre-fire warning never triggers.

**Fix in `src/engine/canvasRenderer.ts`** (drawMegaBoss cannon section):
- Change `megaBoss.nextCannonFireTime - now` to use `Date.now()` instead of the renderer's `now` parameter for this specific comparison: `const timeToFire = megaBoss.nextCannonFireTime > 0 ? megaBoss.nextCannonFireTime - Date.now() : Infinity`

### Files Changed

| File | Change |
|------|--------|
| `src/utils/megaBossAttacks.ts` | Fix gravity: scale `BALL_GRAVITY` to px/s² and apply `deltaTimeSeconds` |
| `src/engine/canvasRenderer.ts` | Fix cannon flash: use `Date.now()` for `timeToFire` calculation |

