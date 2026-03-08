

## Plan: Star Enemy Spawn Levels + Documentation Update

### 1. Star Enemy Spawn Logic

**`src/components/Game.tsx`** (~line 7064): Replace the current `level >= 8 && Math.random() < 0.2` star gate with an explicit level list:

```typescript
const STAR_ENEMY_LEVELS = [3, 6, 9, 12, 16, 19];
// ...
} else if (STAR_ENEMY_LEVELS.includes(level) && Math.random() < 0.3) {
  enemyType = "star";
} else if (level >= 6 && Math.random() < 0.3) {
  // pyramid ...
```

Move the star check **before** the pyramid check so it takes priority on shared levels (6, 9, 12).

### 2. Version Bump

**`src/constants/version.ts`**: Bump `GAME_VERSION` to `"0.9.976"` and add a new changelog entry:

```
"NEW: Star Enemy — a yellow star that builds and upgrades bricks on the playfield",
"Star enemies appear on levels 3, 6, 9, 12, 16, and 19",
"Stars take ~5 seconds to construct a new brick or upgrade existing ones (up to 3-hit)",
"Stars intelligently move toward gaps in the brick field after building",
"All 4 enemy types (Cube, Sphere, Pyramid, Star) spawn in Daily Challenges",
```

### 3. README.md

Add a bullet under Features describing the star enemy and update the enemy/level description.

### 4. Homepage (`src/pages/Home.tsx`)

Add a tip or description mentioning the star enemy and its brick-building behavior in the tips section or game description area.

### 5. Tutorial (`src/hooks/useTutorial.ts`)

No change needed — there's only one tutorial step (level 1 welcome). The star enemy is self-explanatory via the existing toast when it spawns.

| File | Change |
|------|--------|
| `src/components/Game.tsx` | Star spawns on levels 3,6,9,12,16,19 with 30% chance |
| `src/constants/version.ts` | v0.9.976 + star enemy changelog |
| `README.md` | Add star enemy to features |
| `src/pages/Home.tsx` | Add star enemy tip/description |

