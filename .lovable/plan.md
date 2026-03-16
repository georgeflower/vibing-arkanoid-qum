

## Fix Preloader: Screen Size, Skip Music, Cache-Aware Loading

### Issue 1: Screen Size After Preloader

The preloader uses `fixed inset-0` which takes over the full viewport. When it unmounts and Game mounts, the Game's layout effect (`checkFrameVisibility`) runs immediately but `fullscreenContainerRef.current` may not have its final dimensions yet. The fix is to add a small delay or force a re-check after mount to ensure the container has settled.

**Fix in `src/components/Game.tsx`**: Add a second `checkFrameVisibility()` call after a short RAF delay in the layout effect (around line 8322), ensuring the container dimensions are accurate after preloader unmount.

### Issue 2: Remove Background Music from Preloader

Remove all music tracks (lines 124-146) from `ASSET_MANIFEST` — these are the large `.mp3` files (level music, boss music). Keep only the small SFX files (lines 106-122) which are short sound effects. Music streams on demand anyway via `SoundManager`.

**Files affected**: Remove ~24 entries from `ASSET_MANIFEST` (music tracks + boss music). Keep the 16 SFX entries. Update `totalAssets` count accordingly.

### Issue 3: Skip Preloader If Assets Already Cached

Use `localStorage` with the app version (`GAME_VERSION`) as a cache key. On first load (or version change), run the full preloader. On subsequent loads with same version, skip directly to game.

**Changes in `src/components/AssetPreloader.tsx`**:
- Import `GAME_VERSION` from `@/constants/version`
- On mount, check `localStorage.getItem("preloader_version")` against `GAME_VERSION`
- If match → call `onComplete()` immediately (assets already cached by browser/SW)
- If no match → run full preload, then `localStorage.setItem("preloader_version", GAME_VERSION)` on completion

### Summary of Changes

1. **`src/components/AssetPreloader.tsx`**:
   - Remove all music/boss music entries from manifest (~24 entries)
   - Add version-based skip logic using localStorage + `GAME_VERSION`
   
2. **`src/components/Game.tsx`**:
   - Add RAF-delayed re-check in layout effect to fix post-preloader sizing

