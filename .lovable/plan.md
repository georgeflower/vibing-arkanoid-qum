

## Plan: Improve Ball Release After Mega Boss Phase Transitions

### What the user wants
1. **Highlight on miss too**: When a danger ball is missed and the player ball is released (fail path), apply the same `ballReleaseHighlight` effect as the success path
2. **Slow-start speed ramp**: Released ball starts slow and ramps up to normal speed, so the player can locate it
3. **Upward release with random 180°**: Always release the ball upward with a random angle within a 180° arc (not straight down)

### Changes

**1. `src/utils/megaBossUtils.ts` — Fix both release functions**

- **`releaseBallAndNextPhase()`** (success path, line 252-278): Change release to always go upward with random angle in 180° arc (-90° to +90° from vertical up). Start at reduced speed (e.g. 1.5) instead of 4. Add a `releasedFromBossTime` timestamp (already present).

- **`resetMegaBossPhaseProgress()`** (fail path, line 427-435): Same change — release upward with random 180° angle and slow initial speed. Currently releases straight down (`dy: 4`). Change to upward with random spread.

- Add a new ball property `releaseSpeedRampStart?: number` to track when speed ramping began, OR simply use the existing `releasedFromBossTime` for the ramp calculation.

**2. `src/types/game.ts` — Add `releaseSpeedScale` to Ball**

Add optional `releaseSpeedScale?: number` field to Ball interface. This represents the initial speed multiplier (starts at ~0.3, ramps to 1.0 over ~1.5 seconds).

**3. `src/engine/physics.ts` — Apply speed ramp**

In `runPhysicsFrame`, check if ball has `releasedFromBossTime` set and is within the ramp window (~1.5s). Scale ball velocity toward target speed gradually. After ramp completes, clear the flag.

**4. `src/components/Game.tsx` — Add highlight on miss path**

At line 5168, after `setBalls((prev) => [...prev, releasedBall])`, add the same `setBallReleaseHighlight({ active: true, startTime: Date.now() })` + setTimeout cleanup that exists at line 4972.

### Summary of changes
| File | Change |
|------|--------|
| `src/types/game.ts` | Add optional `releaseSpeedScale` to Ball |
| `src/utils/megaBossUtils.ts` | Both release functions: upward + random 180° + slow initial speed |
| `src/engine/physics.ts` | Speed ramp logic for released balls |
| `src/components/Game.tsx` | Add `ballReleaseHighlight` on miss path (line ~5168) |

