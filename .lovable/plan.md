

## Plan: Spawn All 4 Enemy Types in Daily Challenge

Currently, enemy type selection is gated by level: cubes at all levels, spheres at level 3+, pyramids at level 6+. Since daily challenge uses level 0 (per the approved plan), only cubes would spawn.

### Change

**`src/components/Game.tsx`** (~line 6903–6911): Update the enemy type selection logic to check if the game mode is `dailyChallenge`. When it is, all 4 types (cube, sphere, pyramid, star) should be available regardless of level:

```
// Before level-gating, check if daily challenge
const isDailyMode = settings.gameMode === "dailyChallenge";

let enemyType: EnemyType;
if (isDailyMode) {
  // All 4 types equally available in daily challenge
  const allTypes: EnemyType[] = ["cube", "sphere", "pyramid", "star"];
  enemyType = allTypes[Math.floor(Math.random() * allTypes.length)];
} else {
  // Existing level-gated logic (cube/sphere/pyramid/star)
  ...
}
```

This is a ~10-line change in one location. The star enemy type, spawning stats, rendering, and AI are handled by the already-approved star enemy plan — this change only ensures the daily challenge mode bypasses level gating.

| File | Change |
|------|--------|
| `src/components/Game.tsx` | Bypass level-gating for enemy types in daily challenge mode |

