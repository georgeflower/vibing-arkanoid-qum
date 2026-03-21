

## Fix: Star-Built Bricks Should Block Level Completion

### Problem
In `src/engine/physics.ts` line 1202, the level-completion check treats `starBuilt` bricks the same as indestructible bricks — it ignores them. This means if the yellow Star enemy builds bricks, the level can be completed without destroying them.

### Fix

**`src/engine/physics.ts` (line 1202)** — Remove `b.starBuilt` from the win-condition check:

```typescript
// Before:
const allGone = bricks.every((b) => !b.visible || b.isIndestructible || b.starBuilt);

// After:
const allGone = bricks.every((b) => !b.visible || b.isIndestructible);
```

This single-line change ensures star-built bricks must be destroyed to complete the level.

