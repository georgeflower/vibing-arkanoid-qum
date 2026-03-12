

# Fix Settings Dialog Visibility, Quality Sync, and Mobile Indicator

## Issues Found

1. **Settings dialog hidden behind game canvas**: The Dialog portal renders with `z-50` (from `dialog.tsx` overlay and content), but the `DialogContent` in `SettingsDialog.tsx` uses `z-[300]`. The problem is that `DialogContent` passes `z-[300]` as a className, but the `DialogOverlay` (rendered inside `DialogPortal` at line 35 of dialog.tsx) only has `z-50`. The overlay blocks interaction at z-50 while the game elements may be higher. The `fixed inset-0` pause overlay is at `z-[200]`, so the dialog overlay at `z-50` is behind it. Need to bump both overlay and content z-index.

2. **Saving doesn't affect quality**: The sync effect (Game.tsx line 1593-1597) only fires when `gameSettingsData.qualityLevel !== quality`. But `saveSettings` in `useGameSettings` calls `setSettingsRaw` inside a state updater — it returns the same object that was already set by `updateSettings(draft)` in `handleSave`. Since `updateSettings(draft)` already set the state, `saveSettings(draft)` produces the same reference. The `useEffect` comparing `gameSettingsData.qualityLevel` may not re-trigger because the value didn't change between the two calls (both set the same draft). The real issue: `updateSettings` takes a `Partial<GameSettings>` but is called with a full settings object — this works. But the `useEffect` dependency is `[gameSettingsData.qualityLevel, setQuality]` — if `qualityLevel` was already set to the same string by `updateSettings`, it won't re-fire. The fix: also call `setQuality` directly in `handleSave` or make the effect always sync.

3. **Default quality "high"**: Already set in `DEFAULT_SETTINGS`. But old localStorage data may have stale values. The `loadSettings` merges `DEFAULT_SETTINGS` with stored — if stored has no `qualityLevel`, it defaults to "high". This should work. But if user previously saved with a different quality, that persists. This is correct behavior.

4. **QualityIndicator on mobile**: Currently `fixed top-4 right-4`. Should be `fixed bottom-4 left-4` on mobile.

## Changes

### 1. `src/components/ui/dialog.tsx` — Fix z-index
- Change `DialogOverlay` from `z-50` to `z-[300]`
- Change `DialogContent` from `z-50` to `z-[300]`
This ensures the dialog renders above the pause overlay (`z-[200]`).

### 2. `src/components/SettingsDialog.tsx` — Fix quality save
- In `handleSave`, after calling `updateSettings(draft)` and `saveSettings(draft)`, dispatch a custom event `"game-settings-saved"` with the quality level. This ensures Game.tsx can react even if React state didn't "change".
- Alternative (simpler): Accept a callback prop `onQualityChange?: (quality: QualityLevel) => void` and call it in `handleSave`. 
- **Chosen approach**: Add an `onSettingsSaved` callback prop. Game.tsx passes `setQuality` through it.

### 3. `src/components/Game.tsx` — Wire quality callback
- Pass `onSettingsSaved` to both `SettingsDialog` instances in the pause menu, calling `setQuality(settings.qualityLevel)`.

### 4. `src/components/QualityIndicator.tsx` — Mobile positioning
- Change positioning to `fixed bottom-4 left-4` on mobile (detect via media query or accept a prop). Use responsive Tailwind: `fixed bottom-4 left-4 md:top-4 md:right-4 md:bottom-auto md:left-auto`.

