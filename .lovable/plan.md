

## Daily Challenge Fixes: Completion Logic, Hidden Level, and Brick Hits

Three issues found in the daily challenge mode.

### Problem 1: Dying still counts as "completed"
When the player loses all lives, `handleGameOver` (line 1862) evaluates objectives with `allBricksDestroyed: false` and the auto-submit at line 7892 submits the result to the database. This marks the challenge as "completed" even though the player failed. Only timed-out challenges are blocked from submission.

**Fix in `src/components/Game.tsx`:**
- In `handleGameOver` (line 1862-1875), when `isDailyChallenge` and player died (not won), set `dailyChallengeTimedOut` to `true` (or add a new `dailyChallengeFailed` flag) to prevent auto-submission. The result overlay still shows (so the player sees their stats) but it won't submit as a completion.
- Alternative simpler approach: just add a check in the auto-submit useEffect (line 7892) — only submit when `gameState === "won"`.

### Problem 2: Level "21" displayed in HUD
Daily challenges start at `startingLevel: 21` which shows in three HUD locations.

**Fix in `src/components/Game.tsx`:**
- Desktop right-panel level display (~line 9193-9199): wrap in `{!isDailyChallenge && (...)}` or show "DAILY" instead
- Mobile compact HUD (~line 9427-9441): same conditional hide
- Mobile timer row already handles daily challenges separately

### Problem 3: Bricks require too many hits
`getBrickHits(21, row)` returns up to 4 hits (level 21 falls in the `< 25` bracket). Daily challenges should use a virtual level between 5-15 for hit calculation.

**Fix in `src/components/Game.tsx` (~line 2340):**
- When `isDailyChallenge`, use a clamped level for `getBrickHits`: something like `getBrickHits(Math.min(15, Math.max(5, dailyChallengeData?.brickHitLevel ?? 10)), row)` — a fixed moderate level (e.g., 10) gives max 3 hits on top rows, 2 on mid rows, 1 on bottom rows.
- A sensible default of level 10 means: rows 0-1 get 3 hits, rows 2-3 get 2 hits, rest get 1 hit (the `< 12` bracket).

**Fix in `src/utils/dailyChallenge.ts`:**
- Optionally add a `brickHitLevel` field to the challenge generator (seeded from RNG, range 5-15) so each daily challenge has varied difficulty. If not desired, a hardcoded level 10 in Game.tsx is simpler.

### Summary of file changes:
- **`src/components/Game.tsx`**: 
  - Block daily challenge submission on death (add failed state or check gameState)
  - Hide level display in desktop + mobile HUD when `isDailyChallenge`
  - Use virtual level (10) for `getBrickHits` call when `isDailyChallenge`
- **`src/types/game.ts`** (optional): Add `brickHitLevel` to `DailyChallengeConfig` if we want per-challenge variety

