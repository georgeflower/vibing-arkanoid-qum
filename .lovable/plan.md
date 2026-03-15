

## Fix: Star Enemy Building on Indestructible Bricks

### Root Cause

When bricks are created, indestructible (metal) bricks get a **position offset** of `-SCALED_BRICK_PADDING / 2` (lines 2344-2349) to create the "melted together" visual. But the star's target selection (line 4663-4664) looks for bricks at the **unshifted** grid position with a tight `< 2` tolerance — so it never finds the indestructible brick and considers the cell empty/valid.

### Fix

**`src/components/Game.tsx`** — Two changes in the star build AI section:

1. **Target selection scan (line ~4663-4667)**: Widen the brick lookup to also check for any indestructible brick overlapping the grid cell. Replace the tight `Math.abs < 2` check with a broader overlap check that accounts for expanded metal brick dimensions:

```typescript
// Check if ANY indestructible brick overlaps this grid cell
const hasIndestructible = world.bricks.some(
  (b) => b.visible && b.isIndestructible &&
  b.x < bx + SCALED_BRICK_WIDTH &&
  b.x + b.width > bx &&
  b.y < by + SCALED_BRICK_HEIGHT &&
  b.y + b.height > by
);
if (hasIndestructible) continue; // Skip this cell entirely
```

2. **Build-time check (line ~4586-4596)**: Use the same AABB overlap check instead of the current center-distance check, to be consistent and robust.

This ensures the star never targets or builds on cells occupied by indestructible bricks, regardless of their position offset.

