

## Plan: Fix Daily Challenge Level — Use Level 21+ Instead of 0

### Problem
Setting `startingLevel: 0` causes the Game component to crash. When `initBricksForLevel(0)` runs, the fallback path accesses `levelLayouts[-1]` (undefined), crashing the game. Multiple other systems also assume `level >= 1` (speed calculations, enemy gating, etc.).

### Solution
Use the user's suggestion: daily challenges use level numbers **starting at 21** (one above `FINAL_LEVEL = 20`), incrementing daily. This avoids all edge cases with level 0 and clearly separates daily challenge levels from the normal 1-20 progression.

The daily challenge layout is already handled correctly via `isDailyChallenge && settings.dailyChallengeConfig` — the level number just needs to not break other systems.

### Changes

**`src/components/MainMenu.tsx`** (~line 132):
- Change `startingLevel: 0` → `startingLevel: 21` (or compute a day-based offset: `21 + daysSinceLaunch`)

**`src/components/Game.tsx`**:
1. **Speed clamp** (~line 318-322): When `isDailyChallenge`, use the daily config's `speedMultiplier` directly instead of the level-based formula (this is already done in the initialization at line 333-334, but `calculateSpeedForLevel` also needs a daily challenge guard).
2. **Level display**: Where `LEVEL ${currentLevel}` is shown in toasts/UI, show "DAILY" instead when `isDailyChallenge` is active.
3. **Win condition** (~line 3822): The `level >= FINAL_LEVEL` check already has a daily challenge branch above it, so level 21 won't trigger the "beat the game" ending.
4. **Enemy spawning**: The daily challenge bypass (all 4 types) is already in place.
5. **Level progression**: Daily challenge doesn't advance levels, so level 21 won't try to load `levelLayouts[20]` for a "next level."

**`src/utils/dailyChallenge.ts`**: No changes needed — the level number is set in MainMenu, not here.

### Files Changed

| File | Change |
|------|--------|
| `src/components/MainMenu.tsx` | `startingLevel: 21` for daily challenge |
| `src/components/Game.tsx` | Guard `calculateSpeedForLevel` for daily mode; display "DAILY" instead of level number |

