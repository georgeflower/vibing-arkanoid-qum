

# Fix Mobile Settings Dialog & Ball Speed Slowdown

## Issue 1: Settings dialog doesn't work on mobile pause menu

**Root cause**: The `SettingsDialog` at line 8768 is rendered *inside* the pause overlay. When the user taps it, `onPauseMenuHide` fires → `settingsOpenFromPause = true` → the pause overlay condition (line 8673: `!settingsOpenFromPause`) becomes false → the pause overlay unmounts → the `SettingsDialog` inside it unmounts too, killing its internal dialog state. The standalone `SettingsDialog` at line 8794 should take over, but on mobile touch events, the unmount/remount race prevents the dialog from opening.

**Fix**: Replace the `<SettingsDialog>` inside the pause overlay with a plain `<Button>` that sets `settingsOpenFromPause = true`. The standalone `SettingsDialog` (line 8794, already wired with `open={true}`) handles the actual dialog. This eliminates the unmount race entirely.

### Change: `src/components/Game.tsx` (line 8768-8774)
Replace:
```tsx
<SettingsDialog
  gameState={gameState}
  setGameState={setGameState}
  onPauseMenuHide={() => setSettingsOpenFromPause(true)}
  onPauseMenuShow={() => setSettingsOpenFromPause(false)}
  onSettingsSaved={(s) => setQuality(s.qualityLevel)}
/>
```
With:
```tsx
<Button
  onClick={() => {
    soundManager.playMenuClick();
    setSettingsOpenFromPause(true);
  }}
  onMouseEnter={() => soundManager.playMenuHover()}
  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm py-2 md:py-3 retro-pixel-text"
>
  <Settings className="w-4 h-4 mr-1 inline" /> SETTINGS
</Button>
```

---

## Issue 2: Ball speed slowing down without slowdown power-up

**Root cause**: `const speedMultiplier = world.speedMultiplier` (line 412) is read once per render cycle. The tutorial dismiss handlers at lines 8482/8512 capture this stale value:

```
baseSpeedMultiplierRef.current = speedMultiplier;  // stale!
setSpeedMultiplier(speedMultiplier * 0.1);
```

If `speedMultiplier` is stale (e.g., still holds the initial value while `world.speedMultiplier` has been updated by brick-hit accumulation), the "Get Ready" ramp targets the wrong speed. Worse, if a previous ramp set `world.speedMultiplier` to 0.1x and the component re-renders, `speedMultiplier` captures that 0.1x value, causing compounding slowdowns.

**Fix**: Read `world.speedMultiplier` directly in the tutorial dismiss handlers instead of using the stale `speedMultiplier` closure variable.

### Change: `src/components/Game.tsx` (lines 8481-8483 and 8511-8513)
Replace `speedMultiplier` with `world.speedMultiplier`:
```tsx
baseSpeedMultiplierRef.current = world.speedMultiplier;
setSpeedMultiplier(world.speedMultiplier * 0.1);
```

---

## Issue 3: Settings changes from menu don't affect game quality

This already works for *new* games (settings saved to localStorage, loaded on Game mount). The `onSettingsSaved` callback on the standalone dialog at line 8804 calls `setQuality`. No additional fix needed beyond Issue 1 (making the dialog actually open on mobile).

