

## Ball Speed Increase Per Brick

**Current values:**
- **Base increase per brick**: `0.01` (1%) — applies when >10 bricks remain
- **When ≤10 bricks remain**: scales from `0.021` (10 left) up to `0.063` (1 left)

### Plan: Reduce speed increase

**File: `src/engine/physics.ts`** (lines 1084-1087)

Reduce all values by ~40%:
- Base: `0.01` → `0.006`
- Low-brick range: `0.021` → `0.013`, scaling factor `0.00462` → `0.0028`
- This means at 1 brick remaining, max increase per hit goes from `0.063` → `0.038`

This keeps the progressive acceleration feel but makes it noticeably gentler — the ball won't ramp up as aggressively mid-level.

### Files
- `src/engine/physics.ts` — adjust 3 numeric constants on lines 1084-1087

