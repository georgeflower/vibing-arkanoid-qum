

## Fix: Boss Rush Incorrectly Triggers Campaign Achievements

### Problem
When dying in Boss Rush mode, `submitGameStats` sends `level: levelRef.current` (the boss level number, e.g. 15) to the server. The server runs `newBestLevel = Math.max(profile.best_level, level)` and checks achievements against it. If the player previously reached level 20+ in campaign, `best_level` stays at 20+ and achievements like "Victory Lap" and "Godlike" fire — even though the player only died on boss 15 in Boss Rush.

Boss Rush levels (5/10/15/20) represent boss encounters, not campaign progress. They should not update `best_level` or trigger campaign-specific achievements.

### Changes

**`src/utils/profileStats.ts`** — Add `gameMode` to `GameSessionStats` interface:
- Add `gameMode?: string` field (defaults to `"campaign"`)

**`src/components/Game.tsx`** — Pass `gameMode` in both `submitGameStats` calls (game over + victory):
- Add `gameMode: settings.gameMode` to both stat submission objects (lines ~1845 and ~4098)

**`supabase/functions/update-profile-stats/index.ts`** — Handle `gameMode`:
- Extract `gameMode` from request body, default to `"campaign"`
- Skip updating `best_level` when `gameMode === "bossRush"` (keep existing value)
- Skip campaign-specific achievement checks (`victory_lap`, `godlike`) when `gameMode === "bossRush"`
- Still update all other cumulative stats (bricks, enemies, bosses killed, time played, etc.) since those are lifetime stats

### Files
- `src/utils/profileStats.ts`
- `src/components/Game.tsx`
- `supabase/functions/update-profile-stats/index.ts`

