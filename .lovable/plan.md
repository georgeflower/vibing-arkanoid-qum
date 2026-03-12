

# Fix: Entities Don't Reposition When Canvas Resolution Changes Mid-Game

## Problem

When resolution changes mid-game, `useScaledConstants` recalculates all `SCALED_*` values, but the existing bricks, paddle, and balls in `world` retain their old pixel positions. The canvas grows/shrinks but entities stay at their original coordinates.

## Approach

Add a `useEffect` that watches `SCALED_CANVAS_WIDTH` and `SCALED_CANVAS_HEIGHT` for changes during gameplay. When they change, compute a scale ratio (`newWidth / oldWidth`, `newHeight / oldHeight`) and reposition all live entities proportionally.

## Changes

### `src/components/Game.tsx`

1. **Add a ref to track previous canvas dimensions**:
   ```tsx
   const prevCanvasDimsRef = useRef({ w: SCALED_CANVAS_WIDTH, h: SCALED_CANVAS_HEIGHT });
   ```

2. **Add a `useEffect` that fires when `SCALED_CANVAS_WIDTH` or `SCALED_CANVAS_HEIGHT` change**:
   - Compute `scaleX = SCALED_CANVAS_WIDTH / prevW` and `scaleY = SCALED_CANVAS_HEIGHT / prevH`
   - If scales are ~1.0, skip
   - Rescale all `world.bricks` positions and dimensions (`x`, `y`, `width`, `height`)
   - Rescale `world.paddle` (`x`, `y`, `width`, `height`)
   - Rescale all `world.balls` (`x`, `y`, `radius`)
   - Rescale `world.powerUps`, `world.bullets`, `world.bonusLetters`, `world.enemies`, `world.bombs` positions
   - Rescale `world.boss` and `world.resurrectedBosses` positions
   - Rescale `world.bossAttacks`, `world.laserWarnings`, `world.superWarnings` positions
   - Update `paddleXRef.current` proportionally
   - Invalidate the brick render cache (`brickRenderer.invalidate()`)
   - Rebuild spatial hash (`brickSpatialHash.rebuild(...)`)
   - Update `prevCanvasDimsRef`

3. **Update `initBricksForLevel` dependency array** from `[]` to include the scaled constants it uses (`SCALED_BRICK_WIDTH`, `SCALED_BRICK_HEIGHT`, `SCALED_BRICK_PADDING`, `SCALED_BRICK_OFFSET_LEFT`, `SCALED_BRICK_OFFSET_TOP`), so that if a new level starts after a resolution change, it uses correct values.

This proportional rescaling approach avoids reinitializing the level (which would reset game progress) and handles all entity types uniformly.

