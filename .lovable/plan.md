

## Ball Speed Issues: Diagnosis and Fixes

### Issue 1: Multiball creates slower balls
**Root cause** in `src/hooks/usePowerUps.ts` line 236-237:
```js
{ ...baseBall, id: ..., dx: baseBall.dx - 2 }
{ ...baseBall, id: ..., dx: baseBall.dx + 2 }
```
The `dx` is modified by ±2, changing actual velocity, but `ball.speed` is copied unchanged from `baseBall`. When these new balls hit the paddle, physics.ts (line 684-689) normalizes them back to `ball.speed` — which no longer matches their actual velocity vector. This makes one ball slower and one faster, then both get clamped on paddle hit.

**Fix**: After modifying `dx`, recalculate `speed` to match the new velocity magnitude:
```js
const newDx1 = baseBall.dx - 2;
const speed1 = Math.sqrt(newDx1 * newDx1 + baseBall.dy * baseBall.dy);
{ ...baseBall, dx: newDx1, speed: speed1, ... }
```
Same for the +2 ball.

### Issue 2: Ball slows down unexpectedly
**Root cause**: The paddle-hit normalization in `src/engine/physics.ts` (line 684-689) only normalizes DOWN (`currentSpd > targetSpd`), never UP. If `ball.speed` somehow becomes stale or lower than the current velocity the game expects, the ball stays slow after a paddle hit. Also, the slowdown power-up sets `ball.speed` to a reduced value, but `speedMultiplier` also decreases — potentially double-dipping.

**Fix**: Add a speed anomaly logger that fires whenever ball speed changes outside of expected causes (brick hits, slowdown power-up, gravity). This will help diagnose the exact cause.

### Issue 3: Mobile speed inconsistency (visual stutter)
Likely related to variable frame timing on mobile — the CCD converts velocity to px/sec (`dx * 60 * speedMultiplier`) and back, so frame-rate drops create visible speed fluctuations. This is harder to fix but the logger will confirm.

### Plan

**File: `src/hooks/usePowerUps.ts`**
- Fix multiball: recalculate `speed` property for new balls after modifying `dx`

**File: `src/engine/physics.ts`**
- Add speed anomaly detection: after CCD processing and before returning, log when a ball's effective speed deviates from `ball.speed` by more than 5% outside of known causes (gravity, slowdown)
- Make the normalization bidirectional — also normalize UP if ball is slower than `ball.speed` (not just faster), to prevent permanent slowdowns

**File: `src/utils/gameCCD.ts`**
- Add a speed-change log after CCD conversion back from px/sec to px/frame: if the resulting speed differs from the input speed by more than a threshold, log the event with context

These changes add always-on lightweight logging (not gated by `ENABLE_DEBUG_FEATURES`) for speed anomalies, and fix the two identified bugs.

