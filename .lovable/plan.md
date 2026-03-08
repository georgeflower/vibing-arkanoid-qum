
Goal: Fix why player profile stats are not updating after gameplay.

What I found
- The backend update path works: calling `update-profile-stats` directly updates `player_profiles` correctly.
- During normal gameplay, there are no `update-profile-stats` requests from the client.
- Root cause is client-side gating:
  - `submitGameStats(...)` is skipped when `isDebugModeActive(debugSettings)` is true.
  - In `useDebugSettings`, `showDebugModeIndicator` defaults to `true` and is counted as “debug mode active”, so stat submission is effectively always blocked.

Implementation plan

1) Fix debug-mode detection logic
- File: `src/hooks/useDebugSettings.ts`
- Update `isDebugModeActive(...)` so it does NOT treat `showDebugModeIndicator` as active debug mode.
- Keep actual debug overlays/logging toggles as the criteria.

2) Make stat-submission guard production-safe
- File: `src/components/Game.tsx`
- Update both `submitGameStats(...)` call sites to skip only when real debug instrumentation is active (not just indicator visibility).
- Apply at:
  - game-over submission block
  - final-victory submission block

3) Ensure submission uses current match values
- File: `src/components/Game.tsx`
- Prevent stale closure values at submit time by reading current values (via refs or corrected callback dependencies) for:
  - bricks destroyed, enemies killed, bosses killed, power-ups collected, play time, level, combo
- This avoids sending outdated zeros even after gating is fixed.

4) Keep backend unchanged
- No database schema or RLS changes are needed.
- `update-profile-stats` function is already functional and authenticated correctly.

Validation plan
1. Play a short non-debug run and lose.
2. Confirm client sends `update-profile-stats` request.
3. Confirm profile row increments (`total_games_played`, bricks/time/etc.).
4. Open player profile page and verify updated stats render correctly.
5. Repeat once more to confirm cumulative increments.
