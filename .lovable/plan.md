

## Move Asset Preloader Into MainMenu as Background Loading Indicator

### Overview
Remove the separate preloader screen. Instead, start loading assets immediately when the MainMenu mounts (only if version changed). Show a small retro progress meter in the lower-right corner of the menu card. The user can start the game at any time -- loading continues in the background.

### Changes

#### 1. Create `src/hooks/useAssetPreloader.ts` (new file)
A custom hook that manages background asset loading:
- Exports `{ progress, isLoading, isComplete }` state
- Contains the same `ASSET_MANIFEST` from `AssetPreloader.tsx` but reordered: level-1 assets first (paddle, ball, background-tile, cracked bricks, core SFX) then power-ups, then later-level backgrounds, then boss assets
- Adds a `priority` field: `1` = level-1 essentials, `2` = common power-ups/SFX, `3` = later backgrounds/bosses
- On mount, checks `localStorage("preloader_version")` vs `GAME_VERSION` -- if match, sets `isComplete = true` immediately
- Otherwise loads assets sequentially (priority 1 first, then 2, then 3), updating `progress` as each completes
- On full completion, writes version to localStorage
- Uses a ref to keep loading even if the component re-renders
- Exposes a `cancelLoading` cleanup

#### 2. Edit `src/components/MainMenu.tsx`
- Import and call `useAssetPreloader()`
- In the main menu return (line ~792), add a small loading indicator in the lower-right of the Card:
  - Only visible when `isLoading && !isComplete`
  - Small retro text: `"LOADING ASSETS..."` with a mini progress bar (e.g. `[████░░] 67%`)
  - When complete, briefly flash `"READY"` then fade out
  - Style: `font-family: 'Press Start 2P', monospace`, `font-size: 8px`, muted color like `hsl(142, 50%, 45%)`, positioned `absolute bottom-2 right-3`

#### 3. Edit `src/pages/Index.tsx`
- Remove the `"preloading"` phase entirely
- Remove the `AssetPreloader` import and rendering
- Go directly from `"menu"` to `"game"` when user clicks start
- Simplify back to two phases: `"menu" | "game"`

#### 4. Delete or keep `src/components/AssetPreloader.tsx`
- Keep the file but it will no longer be imported anywhere. Can be cleaned up later.

### Asset Priority Order
- **Priority 1 (level 1)**: paddle, paddleTurrets, metalBallTexture, crackedBrick 1-3, backgroundTile (level 1 bg), ball_missed SFX
- **Priority 2 (common)**: all power-up images, bonus letters, remaining SFX
- **Priority 3 (later levels)**: backgroundTile2-4, backgroundTile69, backgroundTile1114, backgroundTile1620, boss backgrounds, megaBoss, missile, endScreen

### Files
1. **Create** `src/hooks/useAssetPreloader.ts`
2. **Edit** `src/components/MainMenu.tsx` -- add loading indicator
3. **Edit** `src/pages/Index.tsx` -- remove preloading phase

