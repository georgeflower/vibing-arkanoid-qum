# Ball speed oscillation: diagnosis and fix

## What the trace found

Speed is managed by two mechanisms that disagree with each other.

1. **Gravity inflates speed silently.** `src/engine/physics.ts:1352-1360` adds a flat `BALL_GRAVITY = 0.015` to `dy` once per physics tick after 10s without a collision. Adding to one component always increases the velocity magnitude, and wall/brick reflections preserve that inflated magnitude, so it compounds.
2. **The paddle snaps speed back down.** `src/engine/physics.ts:807-814` renormalizes `dx/dy` to the stored `ball.speed` field on every flat paddle hit. `ball.speed` is only refreshed when a brick is destroyed (`physics.ts:1109`), so it is stale relative to the gravity drift — the ball drops back to the older, lower speed in one frame.

Result: gradual speed-up during a rally, sudden drop on the paddle bounce, repeating.

Secondary contributors found:
- **Gravity is per-tick, not per-second.** The physics loop runs at 45/60/90/120Hz depending on quality (`Game.tsx:130-138`, `physicsLoop.ts:24-31`), so effective gravity varies by >2.5x across quality levels even though `dtSeconds` is already available and used elsewhere.
- **Corner hits clamp one-way only** (`physics.ts:860-867` scales down but never up), so corner vs flat paddle hits behave differently.
- **The CCD substep travel clamp** (`processBallCCD.ts:328-338`) shaves speed on fast balls without restoring it.
- `src/utils/paddleCollision.ts:70-114` contains a second paddle-bounce implementation that preserves incoming speed instead of renormalizing — needs a call-site check to confirm whether it is live or legacy.

## Fix

1. **Make `ball.speed` the single authoritative target and keep it in sync.** Update `ball.speed` wherever the intended speed genuinely changes (brick-hit boost, power-ups, launch, get-ready ramp) — never let it go stale.
2. **Make gravity frame-rate independent**: scale the increment by `dtSeconds * 60` so 45Hz and 120Hz behave identically.
3. **Stop gravity from changing the speed magnitude.** After applying the gravity nudge, renormalize the ball back to `ball.speed`. Gravity then only bends the trajectory downward (its actual anti-loop purpose) instead of accelerating the ball — which removes the drift *and* the corrective snap at the paddle in one change.
4. **Make the corner path symmetric** with the flat-paddle path (renormalize bidirectionally to `ball.speed`).
5. **Restore speed after the CCD substep travel clamp** so the anti-tunneling safety measure does not permanently reduce speed.
6. **Resolve the duplicate paddle logic**: confirm whether `checkCircleVsRoundedPaddle` is live; if legacy, leave it untouched and note it, if live, align it with the same renormalization rule.

## Verification

Add a temporary, debug-only speed logger (behind `ENABLE_DEBUG_FEATURES`) that samples `Math.hypot(dx,dy)` vs `ball.speed` per ball a few times a second, then run an automated Playwright play session on level 7 and read the log. Acceptance: sampled magnitude stays within ~1% of `ball.speed` except at intentional change points (brick-hit boost, power-up, level start ramp), with no saw-tooth pattern around paddle hits. The temporary logger is removed afterwards unless you want it kept behind the debug flag.

## Not changed

Difficulty speed caps, brick-hit speed boost values, endgame acceleration, power-up slowdown behaviour, the 10s gravity delay, or any rendering code.
