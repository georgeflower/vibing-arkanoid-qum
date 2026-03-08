

## Plan: Star Enemy + Daily Challenge Level 0

### 1. Daily Challenge Level = 0

**`src/components/MainMenu.tsx`** (line 132): Change `startingLevel: 1` → `startingLevel: 0`.

**`src/components/Game.tsx`** (line 7417): Clamp `levelSpeedMultiplier` so level 0 doesn't go below `baseMultiplier`:
```
const levelSpeedMultiplier = Math.min(maxSpeedMultiplier, Math.max(baseMultiplier, baseMultiplier + (currentLevel - 1) * 0.05));
```

### 2. Star Enemy Type

**`src/types/game.ts`**: `"star"` is already in `EnemyType`. Add build fields to `Enemy`:
- `buildTarget?: { row: number; col: number }`
- `buildProgress?: number` (ms accumulated, 0→5000)
- `isBuilding?: boolean`

### 3. Star Spawn (Game.tsx ~line 6959)

Add `else if (enemyType === "star")` block after pyramid, before cube fallback:
- Speed 1.5, size 35×35, random movement like sphere, `buildProgress: 0`, `isBuilding: false`.
- Also add star to level-gated logic: from level 8+, 20% chance.

### 4. Star Movement & Build AI (Game.tsx ~line 4294)

Inside the enemy update loop, add star-specific logic:
- **If not building**: Move like other enemies (random direction changes). Every ~60 frames, scan bricks for a target:
  - Find empty grid slots (row/col where no visible brick exists) or upgradeable bricks (hitsRemaining < 3 and not indestructible).
  - Pick the nearest one and set `buildTarget`.
  - Steer toward `buildTarget` position.
- **When within 5px of target**: Set `isBuilding = true`, stop movement (`dx=dy=0`).
- **While building**: Accumulate `buildProgress += dtMs`. When `buildProgress >= 5000`:
  - If slot empty: create a new brick (1-hit, normal type, level-appropriate color, `visible: true`). Add to `bricks` via `setBricks`.
  - If brick exists and `hitsRemaining < 3`: increment `maxHits` and `hitsRemaining`.
  - Reset `isBuilding = false`, `buildProgress = 0`, `buildTarget = undefined`.
  - Invalidate brick cache via `brickRenderer.invalidate()`.
  - After build: scan for direction with most missing bricks (top/bottom/left/right quadrant) and steer that way.

Grid coordinate conversion:
```
col = Math.floor((x - SCALED_BRICK_OFFSET_LEFT) / (SCALED_BRICK_WIDTH + SCALED_BRICK_PADDING))
row = Math.floor((y - SCALED_BRICK_OFFSET_TOP) / (SCALED_BRICK_HEIGHT + SCALED_BRICK_PADDING))
targetX = SCALED_BRICK_OFFSET_LEFT + col * (SCALED_BRICK_WIDTH + SCALED_BRICK_PADDING) + SCALED_BRICK_WIDTH / 2
targetY = SCALED_BRICK_OFFSET_TOP + row * (SCALED_BRICK_HEIGHT + SCALED_BRICK_PADDING) + SCALED_BRICK_HEIGHT / 2
```

### 5. Star Collision (physics.ts ~line 904)

After `crossBall` block, add `else if (enemy.type === "star")`:
- 2 hits to destroy (like sphere), 150 points.
- First hit: angry + speed ×1.3, cancel any building.
- Second hit: destroy, explosion, bonus letter drop.

### 6. Star Rendering (canvasRenderer.ts, in drawEnemies)

Add `else if (singleEnemy.type === "star")` before the cube fallback:
- Draw a 5-pointed star polygon using flat HSL faces (hue 50, yellow).
- Per-point lightness variation for 3D feel.
- When `isAngry`: blink between yellow tones (hue 50 ↔ hue 40).
- When `isBuilding`: draw small sparks/particles around the star (2-3 tiny yellow dots oscillating).
- Shadow behind if `shadowsEnabled`.

### 7. Entity Pool Reset (entityPool.ts ~line 270)

Add star fields to enemy pool reset: `buildTarget = undefined`, `buildProgress = 0`, `isBuilding = false`.

### 8. Tutorial Renderer (tutorialEntityRenderer.ts)

Add `'star'` to `EntityType` union and a `renderStar` function drawing a simplified 5-pointed yellow star.

### 9. Toast Name (Game.tsx ~line 6984)

Update enemy name mapping to include `"star"` → `"Star"`.

### Files Changed

| File | Change |
|------|--------|
| `src/components/MainMenu.tsx` | `startingLevel: 0` for daily challenge |
| `src/components/Game.tsx` | Level 0 speed clamp, star spawn, star AI (movement + build), toast name |
| `src/types/game.ts` | Add build fields to `Enemy` interface |
| `src/engine/physics.ts` | Star hit logic (2 hits, 150 pts) |
| `src/engine/canvasRenderer.ts` | Star rendering (yellow 5-pointed star with build sparks) |
| `src/utils/entityPool.ts` | Reset star-specific fields |
| `src/utils/tutorialEntityRenderer.ts` | Star tutorial rendering |

