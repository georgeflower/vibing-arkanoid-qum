

## Plan: Player Profile System with Lifetime Statistics

This is a large feature requiring authentication, a new database table, stat accumulation logic, achievement definitions, and a profile UI page. Here is the breakdown.

### Database

**New table: `player_profiles`**
- `id` (uuid, PK, default gen_random_uuid)
- `user_id` (uuid, references auth.users ON DELETE CASCADE, unique, not null)
- `display_name` (text, not null)
- `total_bricks_destroyed` (bigint, default 0)
- `total_enemies_killed` (bigint, default 0)
- `total_bosses_killed` (bigint, default 0)
- `total_power_ups_collected` (bigint, default 0)
- `total_games_played` (integer, default 0)
- `total_time_played_seconds` (bigint, default 0)
- `best_score` (integer, default 0)
- `best_level` (integer, default 0)
- `best_combo_streak` (integer, default 0)
- `favorite_power_up` (text, nullable) — computed on update or stored as most-used
- `power_up_usage` (jsonb, default '{}') — tracks count per power-up type for favorite calculation
- `achievements` (jsonb, default '[]') — array of unlocked achievement IDs with timestamps
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

RLS: Users can SELECT/UPDATE their own row. A trigger auto-creates a profile row on auth.users insert.

### Authentication

- Add simple email/password auth (signup + login) with email confirmation
- Auth page at `/auth` route
- Optional — users can play without logging in; stats just won't save
- Login/signup button on Home page and MainMenu

### Stat Accumulation

- **`src/utils/profileStats.ts`** — new utility module
  - `submitGameStats(stats)` function: after each game ends (game over or victory), call the edge function to atomically increment lifetime counters
- **New edge function `update-profile-stats`** — receives game session stats, increments columns using SQL `UPDATE ... SET col = col + value`, updates `best_score`/`best_level` if higher, updates `power_up_usage` jsonb, recalculates `favorite_power_up`, checks and awards achievements
- **`src/components/Game.tsx`** — at game-over/victory, call `submitGameStats()` with session totals (bricks, enemies, bosses, power-ups collected with types, time played, score, level, hit streak)

### Achievements

Defined as constants in `src/constants/achievements.ts`:
- "First Blood" — destroy 1 brick (total)
- "Brick Breaker" — 1,000 total bricks
- "Demolition Expert" — 10,000 total bricks
- "Boss Slayer" — kill 10 bosses
- "Marathon" — 1 hour total play time
- "High Roller" — score 100,000 in a single game
- "Power Collector" — collect all power-up types
- "Perfect Combo" — hit streak of 10+
- "Victory Lap" — beat level 20
- "Godlike" — beat level 20 on godlike difficulty

Checked server-side in the edge function after stat update.

### Profile Page

- New route `/profile` with `src/pages/Profile.tsx`
- Retro-styled page matching the game aesthetic
- Sections: player name, lifetime stats grid, achievement badges, favorite power-up display
- Link from Home page and MainMenu

### Summary of Files

| File | Change |
|------|--------|
| Migration SQL | Create `player_profiles` table + RLS + trigger |
| `supabase/functions/update-profile-stats/index.ts` | New edge function for atomic stat updates + achievements |
| `src/constants/achievements.ts` | New — achievement definitions |
| `src/utils/profileStats.ts` | New — client helper to submit stats |
| `src/pages/Profile.tsx` | New — profile page UI |
| `src/pages/Auth.tsx` | New — login/signup page |
| `src/App.tsx` | Add `/auth` and `/profile` routes |
| `src/pages/Home.tsx` | Add login/profile buttons |
| `src/components/MainMenu.tsx` | Add profile button |
| `src/components/Game.tsx` | Call `submitGameStats()` on game end |
| `supabase/config.toml` | Add `update-profile-stats` function config |

