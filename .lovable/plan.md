

## Plan: Aggressive Ball Speed Increase for Last 10 Bricks

### Problem
Currently, when ≤10 bricks remain, the speed increase per brick destroyed is only `0.01` (vs `0.005` normally) — barely noticeable. The user wants a much more dramatic ramp-up that escalates as fewer bricks remain.

### Fix

**`src/engine/physics.ts` (lines 1081-1084)** — Replace the flat `0.01` boost with a scaling formula based on how few bricks remain:

```typescript
// Current:
const baseSpeedIncrease = remainingBrickCount <= 10 ? 0.01 : 0.005;

// New — escalating speed boost for last 10 bricks:
let baseSpeedIncrease = 0.005;
if (remainingBrickCount <= 10) {
  // Scale from 0.02 (10 left) up to 0.06 (1 left)
  baseSpeedIncrease = 0.02 + (10 - remainingBrickCount) * 0.0044;
}
```

This gives roughly:
- 10 bricks left: +0.020 per destroy (4× current)
- 7 bricks left: +0.033
- 4 bricks left: +0.046
- 1 brick left: +0.060 (12× current)

The existing `maxTotalSpeed` cap still applies, preventing runaway speeds.

### Files
- `src/engine/physics.ts` — one line change in the speed increase calculation

