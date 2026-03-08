

## Plan: Daily Challenges with Procedural Layouts and Objectives

### Overview

Add a "Daily Challenge" game mode with procedurally generated level layouts (seeded by date), specific objectives (e.g., "no lives lost", "beat boss under 2 min"), and streak-based achievement rewards on the player profile.

---

### 1. Database Changes

**New table: `daily_challenge_completions`**
- `id` (uuid PK)
- `user_id` (uuid, references auth.users, not null)
- `challenge_date` (date, not null) — the day of the challenge
- `completed_at` (timestamptz, default now())
- `score` (integer, not null)
- `time_seconds` (integer, not null)
- `objectives_met` (jsonb, default '[]') — which objectives were completed
- Unique constraint on `(user_id, challenge_date)` — one completion per day

**Add columns to `player_profiles`:**
- `daily_challenge_streak` (integer, default 0)
- `best_daily_streak` (integer, default 0)
- `total_daily_challenges_completed` (integer, default 0)
- `last_daily_challenge_date` (date, nullable)

RLS: Users can SELECT/INSERT their own completions. Service role can manage all.

### 2. Daily Challenge Generation (`src/utils/dailyChallenge.ts`)

New utility that deterministically generates a challenge for any given date:

- **Seeded RNG** using date string (e.g., `"2026-03-08"`) → simple hash → seed
- **Layout generation**: 13×13 grid, seed controls brick placement density (40-70%), metal brick positions, explosive brick clusters
- **Objective selection**: Pick 1 primary + 1 secondary objective from a pool, seeded by date:
  - "Complete without losing a life" (no deaths)
  - "Finish in under 3 minutes"
  - "Destroy all bricks" (no skipping)
  - "Score at least X points"
  - "Don't use any power-ups"
  - "Achieve a 5+ hit combo"
- **Modifier**: Seed picks one game rule modifier: starting lives (1-3), speed modifier, no power-ups, fireball-only, etc.
- Export: `getDailyChallenge(date: Date): DailyChallenge` returning `{ layout, objectives, modifiers, seed, dateString }`

### 3. Game Mode Extension

**`src/types/game.ts`**: Add `"dailyChallenge"` to `GameMode` type. Add optional `dailyChallengeConfig` to `GameSettings`.

**`src/components/Game.tsx`**: 
- When `gameMode === "dailyChallenge"`, use the generated layout instead of `levelLayouts[index]`
- Apply challenge modifiers (lives, speed, power-up restrictions)
- Track objective completion during gameplay (lives lost counter, timer, combo tracker — most already exist)
- On game end, evaluate objectives and call new edge function to record completion
- Single-level challenge — victory when all bricks destroyed (or boss defeated)

### 4. Edge Function: `submit-daily-challenge`

- Validates auth, checks challenge hasn't already been submitted for today
- Inserts into `daily_challenge_completions`
- Updates streak on `player_profiles`: if `last_daily_challenge_date` = yesterday, increment streak; if today, ignore; else reset to 1
- Awards streak achievements (checked server-side)

### 5. New Achievements (`src/constants/achievements.ts`)

Add to existing array + edge function checks:
- `"daily_warrior"` — Complete 1 daily challenge
- `"streak_3"` — 3-day streak
- `"streak_7"` — 7-day streak  
- `"streak_30"` — 30-day streak
- `"daily_perfectionist"` — Complete a daily challenge meeting all objectives

### 6. Daily Challenge UI

**`src/components/DailyChallengeOverlay.tsx`** — New overlay accessible from MainMenu:
- Shows today's challenge: objectives, modifiers, difficulty description
- "Play" button starts the challenge
- Shows completion status if already completed today
- Displays current streak

**`src/components/DailyChallengeResultOverlay.tsx`** — Shown after challenge ends:
- Shows which objectives were met (✅/❌)
- Score and time
- Streak update notification
- "Return to Menu" button

**`src/components/MainMenu.tsx`** — Add "Daily Challenge" button alongside existing mode selection.

**`src/pages/Profile.tsx`** — Add daily challenge stats section (streak, total completed).

### 7. File Summary

| File | Action |
|------|--------|
| Migration SQL | New table + profile columns |
| `src/utils/dailyChallenge.ts` | New — seeded layout + objective generator |
| `supabase/functions/submit-daily-challenge/index.ts` | New — validate & record completion, update streak |
| `src/constants/achievements.ts` | Add 5 daily challenge achievements |
| `src/types/game.ts` | Extend `GameMode`, `GameSettings` |
| `src/components/DailyChallengeOverlay.tsx` | New — pre-challenge info screen |
| `src/components/DailyChallengeResultOverlay.tsx` | New — post-challenge results |
| `src/components/MainMenu.tsx` | Add Daily Challenge button |
| `src/components/Game.tsx` | Handle dailyChallenge mode: custom layout, objectives, submission |
| `src/pages/Profile.tsx` | Show streak + daily stats |
| `src/utils/profileStats.ts` | Add `submitDailyChallenge()` helper |
| `supabase/functions/update-profile-stats/index.ts` | Add streak achievement checks |

