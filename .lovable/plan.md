

## Root Cause: Shared Speed Cap with Per-Ball Velocity

The `brickHitSpeedAccumulated` counter is **global** — both balls increment it when they destroy bricks. But the velocity increase (`dx *= 1 + speedIncrease`) only applies to the **destroying ball**. So with 2 balls:

- Ball A destroys 30 bricks → accumulator = 0.18, Ball A gets 18% velocity boost
- Ball B destroys 30 bricks → accumulator = 0.36 (CAP reached!), Ball B gets 18% velocity boost
- **Neither ball reaches max velocity**, but the cap blocks further increases for both

With 1 ball: same 60 bricks → accumulator = 0.36, that single ball gets the full 36% boost. That's why 1 ball reaches max speed but 2 balls stagnate.

### Fix: Per-Ball Speed Accumulator

Track accumulated speed bonus on each ball individually so the cap is checked per-ball, not globally.

**1. `src/types/game.ts`** — Add `speedBoostAccumulated?: number` to the `Ball` interface.

**2. `src/engine/physics.ts`** (lines 1077-1098) — Change the cap check from using the global `world.brickHitSpeedAccumulated` to using `ccdResult.ball.speedBoostAccumulated`. Each ball independently tracks how much speed it has gained from brick hits, and each is independently capped at `maxTotalSpeed - speedMultiplier`. Still update `world.brickHitSpeedAccumulated` as the max across all balls (for HUD/display).

**3. `src/hooks/usePowerUps.ts`** (multiball case) — No changes needed: `...baseBall` spread already copies `speedBoostAccumulated` to new balls, so split balls inherit parent's accumulated bonus.

**4. `src/hooks/usePowerUps.ts`** (slowdown case) — Reset `ball.speedBoostAccumulated = 0` on each ball when slowdown is collected, matching the existing `setBrickHitSpeedAccumulated(0)` behavior.

**5. `src/components/Game.tsx`** — When creating new balls (level transition, death, retry), ensure `speedBoostAccumulated: 0` is set. The `world.brickHitSpeedAccumulated` reset calls remain for backward compatibility/HUD.

### Files
- `src/types/game.ts` — add optional field
- `src/engine/physics.ts` — per-ball cap check (~10 lines changed)
- `src/hooks/usePowerUps.ts` — reset per-ball accumulator on slowdown
- `src/components/Game.tsx` — initialize field on new ball creation

