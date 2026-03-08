

## Plan: Danger Ball Reflect Sound — 1 Note Per Ball (C-D-E-F#-G)

### Sound Changes (`src/utils/sounds.ts`)

Add a counter and two methods:
- `private dangerBallReflectCount = 0`
- `resetDangerBallReflectCount()` — sets counter to 0
- `playDangerBallReflectSound()` — plays `/reflecting.mp3` with pitch shifted per ball using `playbackRate`:
  - Ball 1: C (1.0)
  - Ball 2: D (9/8 = 1.125)
  - Ball 3: E (5/4 = 1.25)
  - Ball 4: F# (45/32 ≈ 1.406)
  - Ball 5: G (3/2 = 1.5)
  - Increments counter after playing

Modify `playAudioBuffer` to accept an optional `playbackRate` parameter (default 1.0), applied to `source.playbackRate.value`.

### Game.tsx Changes

- Line ~5094: Replace `soundManager.playDangerBallCatch()` with `soundManager.playDangerBallReflectSound()`
- Line ~4869: After `releaseBallAndNextPhase`, call `soundManager.resetDangerBallReflectCount()`

### Danger Ball Spawn Direction (`src/utils/megaBossAttacks.ts`)

- `spawnDangerBall`: Change angle from downward-only (60°-120°) to full random (0°-360°). Spawn from boss center instead of below cannon.
- `updateDangerBall`: Add ceiling bounce (`newY - ball.radius < 0` → reflect `dy`). Enable wall bouncing for all danger balls (remove `!ball.isReflected` guard).

