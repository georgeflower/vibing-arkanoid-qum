

## Plan: Daily Challenge — 125% Speed, No Extra Lives, Enemy Spawns, Music-Reactive Background

### Changes

**1. `src/utils/dailyChallenge.ts`** — Hardcode daily challenge parameters:
- Set `startingLives = 3` always (no extra lives from modifiers — remove `one_life`/`two_lives` modifiers or just override)
- Actually, the user wants "no extra lives" meaning fixed at 3 (the default). Keep modifiers but override lives to always be 3.
- Wait — re-reading: "no extra lives" likely means no life power-ups drop. Will add a flag for that.

**2. `src/types/game.ts`** — Add to `DailyChallengeConfig`:
- `speedMultiplier: number` (1.25 for 125%)
- `enemySpawnInterval: number` (10 seconds)
- `musicReactiveBackground: boolean`
- `noExtraLives: boolean` (prevent life power-ups)

**3. `src/components/MainMenu.tsx`** — Pass new config fields from challenge data when building `DailyChallengeConfig`.

**4. `src/components/Game.tsx`** — Three changes:
- **Speed**: In the `speedMultiplierInitialized` block (~line 330), add a daily challenge branch: `world.speedMultiplier = 1.25` (or read from config).
- **Enemy spawning** (~line 6800): When `isDailyChallenge`, use a fixed 10-second spawn interval instead of the level-based calculation. Remove the `if (bossActive) return` guard for daily challenge so enemies spawn regardless.
- **Music-reactive background**: In the game loop (~line 5176 area), add a new condition: if `isDailyChallenge && dailyChallengeConfig.musicReactiveBackground`, apply the same `world.backgroundHue` logic that's used for mega boss phase 3 / hit streak x10.
- **No extra lives**: When `isDailyChallenge`, filter out `"life"` from power-up drops (in the power-up assignment or wherever life power-ups are generated).

**5. `src/utils/dailyChallenge.ts`** — Update the generator:
- Always set `startingLives = 3`
- Add `speedMultiplier: 1.25`, `enemySpawnInterval: 10`, `musicReactiveBackground: true`, `noExtraLives: true` to the returned challenge object.

### File Summary

| File | Change |
|------|--------|
| `src/types/game.ts` | Add `speedMultiplier`, `enemySpawnInterval`, `musicReactiveBackground`, `noExtraLives` to `DailyChallengeConfig` |
| `src/utils/dailyChallenge.ts` | Set fixed values: speed 1.25, enemies every 10s, music bg on, no extra lives, lives=3 |
| `src/components/MainMenu.tsx` | Pass new fields when building config |
| `src/components/Game.tsx` | Apply 125% speed on init, 10s enemy spawns, music-reactive bg always on, filter life power-ups |

