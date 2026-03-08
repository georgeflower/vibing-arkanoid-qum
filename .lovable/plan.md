

## Plan: Improved Daily Challenge — Named Shapes, Boss Saturdays, Countdown Timer, Challenge Archive

### 1. Named Shape Layouts (`src/utils/dailyChallenge.ts`)

Replace the current 5 generic patterns with **30+ named shape templates** defined as 14x13 boolean masks. Each day deterministically picks one shape using the seeded RNG.

**Shape library** (pixel art on 14x13 grid):
Heart, Diamond, Space Invader, Horse, UFO, Flower, Skull, Star, Arrow, Crown, Anchor, Lightning, Rocket, Cat, Butterfly, Mushroom, Sword, Shield, Ghost, Pacman, Crab, Octopus, Tree, Castle, Moon, Sun, Cross, Spiral, Bat, Robot

Each shape is a `{ name: string; mask: boolean[][] }` object. The `generateLayout` function will:
- Pick a shape from the pool using `rng`
- Use the mask to determine brick placement (bricks only where mask is `true`)
- Apply metal/explosive/cracked chances on top of the mask
- The challenge name becomes the shape name (e.g., "Heart", "Space Invader")

Add `shapeName: string` to `DailyChallenge` interface and `DailyChallengeConfig`.

**Saturday boss challenges**: Check `date.getDay() === 6`. On Saturdays, skip the brick layout entirely — set `isBossChallenge: true` on the challenge, pick a boss type (cube/sphere/pyramid cycling), set `bossLevel` to 5/10/15, and name it accordingly (e.g., "Saturday Boss: Cube").

Add `isBossChallenge: boolean` and `bossLevel: number` to `DailyChallenge` and `DailyChallengeConfig`.

### 2. Enemy Spawn Interval

Change `enemySpawnInterval` from `10` to `7` in `getDailyChallenge()`.

### 3. Countdown Timer in HUD (`src/components/Game.tsx`)

In the Timer HUD section (~line 8499-8505), when `isDailyChallenge && settings.dailyChallengeConfig?.timeLimit > 0`:
- Show countdown (`timeLimit - totalPlayTime`) instead of elapsed `timer`
- Label it "TIME LEFT" instead of "TIMER"
- Turn red and pulse when under 30 seconds
- Trigger game over when countdown reaches 0

### 4. Boss Challenge Support in Game.tsx

When `isDailyChallenge && settings.dailyChallengeConfig?.isBossChallenge`:
- In `createBricksForLevel`, spawn a boss instead of bricks (use `createBoss` with `bossLevel`)
- Victory condition: boss defeated (already handled by existing boss defeat flow)
- Connect boss defeat to daily challenge completion evaluation

### 5. Challenge Archive — Past Challenges Log

**New component**: `src/components/DailyChallengeArchive.tsx`
- Shows a scrollable list of past 90 days of challenges (generated client-side using `getDailyChallenge(date)` for each date)
- Each entry shows: date, shape name, modifier, objectives
- Green checkmark if the user has completed it (fetched from `daily_challenge_completions`)
- Click to play any past challenge (no rewards/streak, same as "Play Again" behavior)
- Accessible from the `DailyChallengeOverlay` via a "Past Challenges" button

**Overlay integration**: Add a "📜 Past Challenges" button to `DailyChallengeOverlay.tsx` that toggles the archive view.

**MainMenu integration**: The archive is accessed through the Daily Challenge overlay, keeping navigation simple.

### 6. DailyChallengeOverlay Updates

- Show the shape name prominently (e.g., "Today's Shape: Heart ❤️")
- For Saturday boss challenges, show "BOSS CHALLENGE" with boss type info
- Show time limit as countdown format if present

### 7. Game.tsx — Pass dateString for replaying past challenges

When replaying a past challenge from the archive, pass the specific date's challenge data. The `handleDailyChallengeStart` in MainMenu already accepts a `DailyChallenge` object, so the archive component calls `onPlay(challenge)` with the historical challenge.

### File Summary

| File | Change |
|------|--------|
| `src/utils/dailyChallenge.ts` | Add 30+ named shape masks, Saturday boss logic, `shapeName`/`isBossChallenge`/`bossLevel` fields, change enemy interval to 7 |
| `src/types/game.ts` | Add `shapeName`, `isBossChallenge`, `bossLevel` to `DailyChallengeConfig` |
| `src/components/Game.tsx` | Countdown timer in HUD, boss challenge support in `createBricksForLevel`, auto game-over on countdown expiry |
| `src/components/DailyChallengeOverlay.tsx` | Show shape name, boss challenge info, add "Past Challenges" button |
| `src/components/DailyChallengeArchive.tsx` | New — scrollable archive of past 90 days with completion checkmarks and replay |
| `src/components/DailyChallengeResultOverlay.tsx` | Show countdown time remaining if time-limit challenge |
| `src/components/MainMenu.tsx` | Wire archive replay through existing `handleDailyChallengeStart` |

