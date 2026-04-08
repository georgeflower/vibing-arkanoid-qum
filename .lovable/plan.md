

## Analysis: Ball Speed Drops on Paddle Hit

### Root Cause

When a ball destroys a brick, its velocity (`dx`/`dy`) is scaled up (lines 1094-1095 in `physics.ts`):
```
ccdResult.ball.dx *= 1 + speedIncrease;
ccdResult.ball.dy *= 1 + speedIncrease;
```

But `ball.speed` (the target speed property) is **never updated** to reflect this increase.

Then when the ball hits the paddle (lines 671-678), speed is normalized **bidirectionally** back to `ball.speed`:
```
const targetSpd = ccdResult.ball.speed;  // still the old, lower value
const scale = targetSpd / currentSpd;
ccdResult.ball.dx *= scale;  // scales DOWN to stale target
ccdResult.ball.dy *= scale;
```

This erases all accumulated brick-hit speed gains every paddle bounce — exactly matching the logs (e.g., 5.02 → 4.50, 4.59 → 4.50).

### Fix

**File: `src/engine/physics.ts`** — After scaling `dx`/`dy` on brick destruction (lines 1094-1095), also update `ball.speed` to match:

```typescript
ccdResult.ball.dx *= 1 + speedIncrease;
ccdResult.ball.dy *= 1 + speedIncrease;
// Sync ball.speed so paddle normalization preserves the increase
ccdResult.ball.speed = Math.hypot(ccdResult.ball.dx, ccdResult.ball.dy);
```

This is a one-line addition. The paddle normalization will then normalize to the correct (increased) speed, and the slowdown power-up reset in `usePowerUps.ts` (which already reduces `speedMultiplier` by 10% and resets `brickHitSpeedAccumulated`) will continue to work correctly since it operates on the multiplier, not `ball.speed` directly.

### Files
- `src/engine/physics.ts` — add 1 line after line 1095

