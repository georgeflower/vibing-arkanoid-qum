

## Fix: Star-built bricks not detected by ball collision

### Root Cause

When a star enemy builds a brick, it pushes the new brick directly into `world.bricks` (the mutable game world array). However, the **spatial hash** used by the CCD collision system is only rebuilt when the React `bricks` state changes (via `useEffect` on line 848). Since the star build logic never updates React state or rebuilds the spatial hash, the new bricks exist visually but are invisible to ball collision detection.

### Fix

**`src/components/Game.tsx`** (~line 4362, after `world.bricks.push(newBrick)`):

Add a call to rebuild the spatial hash immediately after a star enemy creates or upgrades a brick:

```typescript
brickSpatialHash.rebuild(world.bricks.filter(b => b.visible));
```

This ensures the newly added brick is indexed in the spatial hash and will be detected by the CCD collision system on the next frame. The `brickRenderer.invalidate()` call already exists on line 4366, so visual rendering is already handled.

| File | Change |
|------|--------|
| `src/components/Game.tsx` | Rebuild spatial hash after star builds/upgrades a brick |

