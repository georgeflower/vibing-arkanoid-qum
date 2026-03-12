

# Fix: Canvas Resolution Not Updating From Pause Menu Settings

## Root Cause

The `SettingsDialog` and `Game.tsx` each create **separate instances** of `useGameSettings()`. When the dialog saves settings, it updates its own hook instance and writes to localStorage, but Game.tsx's instance (`gameSettingsData`) is never notified. The `onSettingsSaved` callback only calls `setQuality()` — it doesn't propagate canvas resolution, CRT, or other settings back to the game.

## Fix

Expand the `onSettingsSaved` callback in Game.tsx to also update the Game's own `useGameSettings` instance with the full saved settings object.

### Changes

**`src/components/Game.tsx`**
1. Destructure `updateSettings` from `useGameSettings()` (line 173) — currently only `settings` is destructured.
2. Update the `onSettingsSaved` handler (line 8807) to call both `setQuality(s.qualityLevel)` **and** `updateSettings(s)` to sync all settings (resolution, CRT, FPS overlay, etc.) into the game's live state.

```tsx
// Line 173: add updateSettings
const { settings: gameSettingsData, updateSettings: updateGameSettings } = useGameSettings();

// Line 8807: sync all settings, not just quality
onSettingsSaved={(s) => {
  setQuality(s.qualityLevel);
  updateGameSettings(s);
}}
```

This ensures `gameSettingsData.canvasResolution` updates → `parsedResolution` recalculates → `useScaledConstants` produces new dimensions → `GameCanvas` re-renders at the new resolution. All other settings (CRT, FPS overlay, quality indicator) also update immediately.

