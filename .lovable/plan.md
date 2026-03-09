

## Plan: Daily Challenge Improvements + Star Brick Bug Fix

### 1. Bug Fix: Star Enemy Bricks Unreachable

The star enemy builds bricks at any grid position (rows 0-7, cols 0-9). The issue is likely that star enemies can build bricks in positions that are physically unreachable by the ball (e.g., behind existing indestructible bricks, or in rows that the ball path cannot reach due to layout geometry).

**Fix in `src/components/Game.tsx`** (star build AI, ~line 4470-4500):
- When star enemy selects a build target, skip grid positions where `row >= 6` (bottom rows near paddle) to avoid placing bricks in hard-to-reach spots behind the paddle area.
- Also skip positions that are surrounded by indestructible bricks on all sides.
- Alternatively, mark star-built bricks with a flag so the level-clear check (`physics.ts` line 1202) can exclude them: `bricks.every((b) => !b.visible || b.isIndestructible || b.starBuilt)`. This ensures star-built bricks never block level completion.

**Recommended approach**: Add a `starBuilt?: boolean` flag to the Brick type. Set it on star-created bricks. In the win-condition check in `physics.ts`, ignore star-built bricks so they never block level completion. The ball can still destroy them for points, but they won't prevent clearing the level.

### 2. New Database Table: `daily_challenge_scores`

Create a new table to store per-day daily challenge high scores (top 3 per day).

```sql
CREATE TABLE public.daily_challenge_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL,
  player_name text NOT NULL,
  user_id uuid,
  score integer NOT NULL,
  time_seconds integer NOT NULL,
  objectives_met jsonb NOT NULL DEFAULT '[]',
  all_objectives_met boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_challenge_scores ENABLE ROW LEVEL SECURITY;

-- Anyone can view daily challenge scores
CREATE POLICY "Anyone can view daily challenge scores"
  ON public.daily_challenge_scores FOR SELECT
  USING (true);

-- Only backend can insert
CREATE POLICY "Only backend can insert daily challenge scores"
  ON public.daily_challenge_scores FOR INSERT
  WITH CHECK (true);
```

### 3. Update Edge Function: `submit-daily-challenge`

Modify `supabase/functions/submit-daily-challenge/index.ts` to:
- After saving completion, also insert into `daily_challenge_scores`.
- Enforce top-3 per day: if there are already 3 scores for this date, only insert if the new score beats one, then delete the lowest.
- Return the daily leaderboard in the response.

### 4. Update `DailyChallengeResultOverlay.tsx`

Expand to show:
- Current stats (score, time, objectives) -- already present
- **Daily leaderboard** (top 3 for today) fetched after submission
- **"RETRY" button** to replay the challenge (not for rewards if already completed)
- **"DAILY CHALLENGES" button** to go back to the daily challenge overlay (not main menu)
- Remove "RETURN TO MENU" as the only option

Props changes:
- Add `onRetry: () => void`
- Add `onBackToDaily: () => void`
- Add `dailyScores: Array<{player_name, score, time_seconds, rank}>` (passed from Game.tsx after submission response)

### 5. Update `DailyChallengeOverlay.tsx`

Add a section showing **today's top 3 scores** fetched from `daily_challenge_scores` where `challenge_date = today`. Display as a small leaderboard below the challenge info.

Also add a way to view past days' scores from the archive.

### 6. Update `src/components/Game.tsx`

- Wire up `onRetry` callback on `DailyChallengeResultOverlay` to restart the daily challenge.
- Wire up `onBackToDaily` to return to the daily challenge overlay instead of main menu.
- Pass daily scores data from the submission response to the result overlay.
- Update `submitDailyChallenge` call sites to handle new response shape (includes `dailyScores`).

### 7. Update `src/utils/dailyChallengeSubmit.ts`

Update the response type to include `dailyScores` array from the edge function.

### 8. Ensure Daily Scores Are NOT in Main High Score Page

No changes needed to `useHighScores.ts` or `HighScoreDisplay.tsx` — these query `high_scores` table only, which is separate from `daily_challenge_scores`.

### Files Modified
- `src/types/game.ts` — add `starBuilt?: boolean` to Brick
- `src/components/Game.tsx` — star brick flag, retry/back-to-daily wiring, pass daily scores
- `src/engine/physics.ts` — exclude `starBuilt` bricks from win condition
- `src/components/DailyChallengeResultOverlay.tsx` — add leaderboard, retry, back-to-daily buttons
- `src/components/DailyChallengeOverlay.tsx` — show today's top 3 scores
- `src/utils/dailyChallengeSubmit.ts` — updated response type
- `supabase/functions/submit-daily-challenge/index.ts` — insert into daily_challenge_scores, enforce top 3, return scores
- **New migration** — create `daily_challenge_scores` table

