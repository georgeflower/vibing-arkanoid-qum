

## Plan: Add Gravity to Danger Balls After 2 Seconds

### Change

**File: `src/utils/megaBossAttacks.ts`**

In `updateDangerBall()` (line ~58-86), add gravity (`BALL_GRAVITY = 0.015`) to `newDy` when the ball has existed for more than 2 seconds (using `ball.spawnTime`). The `spawnTime` field already exists on `DangerBall`.

```
// Before wall bouncing:
const age = (performance.now() - ball.spawnTime) / 1000;
if (age > 2) {
  newDy += BALL_GRAVITY;
}
```

Import `BALL_GRAVITY` from `@/engine/physics`. No other files need changes — `spawnTime` is already set at spawn time and `updateDangerBall` already receives `deltaTimeSeconds`.

Single-file, ~3-line addition.

