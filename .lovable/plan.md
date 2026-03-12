

## Plan: Daily Challenge Overhaul + Cache Fix

### 1. Time Limit Enforcement — Fail on Timeout

Currently when the timer expires, `Game.tsx` sets lives to 0 and calls `handleGameOver()`, which still evaluates objectives and allows score submission. The fix:

- In `Game.tsx` (line 7074-7084): When time runs out, mark the challenge as **failed** — set a flag like `dailyChallengeTimedOut` so the game-over handler skips objective evaluation and score submission. Instead, go directly to the result overlay showing "TIME'S UP — CHALLENGE FAILED" with a retry button.
- In `handleGameOver` (line 1673-1686): Check if the challenge timed out. If so, set `dailyChallengeResult` with empty `objectivesMet` and `allObjectivesMet: false`, skip score entry entirely, and go straight to the result overlay.

### 2. Reset Daily Challenges — Flower First, Starting Tomorrow

Change the seed system so that **2026-03-13** (tomorrow) deterministically generates the **Flower** shape as the first challenge.

- Modify `getDailyChallenge()` in `dailyChallenge.ts`: Change the seed string to include a new epoch so the RNG cycle resets. Specifically, reorder SHAPE_TEMPLATES to put Flower at index 0, and add a day-offset from a new epoch date (2026-03-13) to force Flower on day 1. Alternatively, hardcode day 1 = Flower by checking if `dateString === "2026-03-13"`.
- Update `DailyChallengeArchive.tsx`: Change `LAUNCH_DATE` from `2026-03-08` to `2026-03-13`.

### 3. Reset All Achievements

- Create a database migration to clear all achievements from `player_profiles`:
  ```sql
  UPDATE player_profiles SET achievements = '[]'::jsonb;
  UPDATE player_profiles SET daily_challenge_streak = 0, best_daily_streak = 0, total_daily_challenges_completed = 0, last_daily_challenge_date = NULL;
  ```
  This needs to be done via the insert/update tool (data operation, not schema change).

### 4. Remove Daily Challenge High Score System Entirely

Remove the `daily_challenge_scores` table and all associated code:

**Database**: Drop the table via migration:
```sql
DROP TABLE IF EXISTS public.daily_challenge_scores;
```

**Edge function** (`submit-daily-challenge/index.ts`): Remove all code that inserts into / queries `daily_challenge_scores`. Remove `dailyScores` from the response. Keep the completion tracking and streak/achievement logic.

**Client code**:
- `dailyChallengeSubmit.ts`: Remove `fetchDailyChallengeScores`, `DailyChallengeScoreEntry` type, and `dailyScores` from submit response.
- `Game.tsx`: Remove `dailyChallengeScores` state, `showDailyChallengeScoreEntry`, `handleDailyChallengeScoreSubmit`, auto-submit logic for daily challenges, and the `HighScoreEntry` rendering for daily challenges. After game over/win in daily challenge mode, go directly to the result overlay (no name entry).
- `DailyChallengeResultOverlay.tsx`: Remove the `dailyScores` prop and leaderboard section.
- `DailyChallengeOverlay.tsx`: Remove `todayScores` state, `fetchDailyChallengeScores` import, and the "TODAY'S TOP SCORES" section.

### 5. Fix Old Version Caching in Preview

The PWA service worker aggressively caches assets. In the Lovable preview, this causes stale versions to persist. The fix:

- In `vite.config.ts`: Disable the PWA plugin entirely when in development mode (`mode === 'development'`). This prevents the service worker from being registered in the preview environment, eliminating cache staleness.

### Files Modified
- `src/utils/dailyChallenge.ts` — reset seed epoch, ensure Flower on day 1
- `src/components/DailyChallengeArchive.tsx` — update LAUNCH_DATE
- `src/components/Game.tsx` — time-out = fail, remove daily score entry/submission, go directly to result overlay
- `src/utils/dailyChallengeSubmit.ts` — remove score fetching/types, simplify submit response
- `supabase/functions/submit-daily-challenge/index.ts` — remove daily_challenge_scores logic
- `src/components/DailyChallengeResultOverlay.tsx` — remove dailyScores prop/leaderboard
- `src/components/DailyChallengeOverlay.tsx` — remove today's scores section
- `vite.config.ts` — disable PWA in development
- **New migration** — drop `daily_challenge_scores` table
- **Data update** — reset achievements in `player_profiles`

