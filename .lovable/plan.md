

## Fix: Star Enemy Building on Indestructible Bricks

### Problem
The screenshot shows a star-built brick stacked on an indestructible brick. Two issues:

1. **Build completion** (line 4384): When the 5-second build timer finishes, the code finds an existing brick and tries to upgrade it — but never checks `isIndestructible`. If the brick became indestructible during the build window, or if the target selection had a near-miss coordinate match, the star enemy can upgrade or stack on indestructible bricks.

2. **Target selection** (line 4461): Already filters out indestructible bricks, but only checks exact position matches. A slight coordinate mismatch could let it pick a slot that visually overlaps an indestructible brick.

### Fix (single file: `src/components/Game.tsx`)

**At build completion (~line 4384):** Add an indestructible guard before upgrading or building:

```typescript
if (existingBrick) {
  // NEVER upgrade indestructible bricks
  if (existingBrick.isIndestructible) {
    enemy.isBuilding = false;
    enemy.buildProgress = -(3000 + Math.random() * 2000);
    enemy.buildTarget = undefined;
    continue;
  }
  // Upgrade: increase hits (max 3)
  ...
}
```

**Also check for nearby indestructible bricks before building new ones (~line 4390):** Before creating a new brick, verify no indestructible brick overlaps that grid position:

```typescript
} else {
  // Don't build if an indestructible brick is nearby
  const nearbyIndestructible = world.bricks.find(
    (b) => b.visible && b.isIndestructible &&
    Math.abs(b.x - targetX) < SCALED_BRICK_WIDTH &&
    Math.abs(b.y - targetY) < SCALED_BRICK_HEIGHT
  );
  if (nearbyIndestructible) {
    enemy.isBuilding = false;
    enemy.buildProgress = -(3000 + Math.random() * 2000);
    enemy.buildTarget = undefined;
    continue;
  }
  // Build new brick ...
}
```

This ensures star enemies can never build on or upgrade indestructible bricks, even if game state changed during the build timer.

