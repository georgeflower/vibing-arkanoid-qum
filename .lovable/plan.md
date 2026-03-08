

## Fix: Daily Challenge Not Starting

### Root Cause

The daily challenge procedural layout generates a **13×13 grid** (`ROWS = 13` in `dailyChallenge.ts`), but the brick loading loop in `Game.tsx` iterates over **14 rows** (`BRICK_ROWS = 14` from `constants/game.ts`).

When `row = 13`, `layout[13]` is `undefined`, causing `layout[13][col]` to throw a runtime error — the game crashes silently before rendering.

### Fix

In `src/utils/dailyChallenge.ts`, change `ROWS` from 13 to 14 to match `BRICK_ROWS`:

```typescript
const ROWS = 14; // Was 13, must match BRICK_ROWS in constants/game.ts
```

This single-line change aligns the procedural layout dimensions with the game engine's expectations.

### Files Changed

| File | Change |
|------|--------|
| `src/utils/dailyChallenge.ts` | Change `ROWS = 13` → `ROWS = 14` |

