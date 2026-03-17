

## Move Asset Loading Indicator to a Persistent Global Overlay

### Problem
The asset loading bar currently lives inside `MainMenu` and disappears when the game starts. It should persist as a fixed overlay in the lower-right corner across both menu and gameplay, and show "All assets loaded" for 5 seconds after completion.

### Changes

#### 1. Create `src/components/AssetLoadingOverlay.tsx`
A small fixed-position overlay component in the lower-right corner that:
- Uses `useAssetPreloader()` to get progress/completion state
- Shows the retro progress bar (`█░` style) while loading
- On completion, switches text to "ALL ASSETS LOADED" and auto-hides after 5 seconds via `setTimeout`
- If already cached (instant complete), still shows the "ALL ASSETS LOADED" message for 5 seconds
- Uses `position: fixed; bottom; right` with high z-index so it floats over both menu and game
- Styled consistently with existing retro pixel font

#### 2. Edit `src/pages/Index.tsx`
- Render `<AssetLoadingOverlay />` alongside both `MainMenu` and `Game` so it persists across phase transitions

#### 3. Edit `src/components/MainMenu.tsx`
- Remove the existing asset loading indicator block (lines 1036-1054)
- Remove the `useAssetPreloader` import and related variables (`assetProgress`, `assetLoading`, `assetComplete`, `assetBar`)

### Files
- **Create**: `src/components/AssetLoadingOverlay.tsx`
- **Edit**: `src/pages/Index.tsx`
- **Edit**: `src/components/MainMenu.tsx`

