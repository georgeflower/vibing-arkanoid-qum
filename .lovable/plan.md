

## Plan: Settings Cleanup & Kartoffel Resolution Lock

### Changes

**1. `src/hooks/useGameSettings.ts`**
- Remove `showQualityIndicator` from `GameSettings` interface, `DEFAULT_SETTINGS`, and `VIDEO_DEFAULTS`
- Remove `canvasResolution` from `GameSettings` interface, `DEFAULT_SETTINGS`, and `VIDEO_DEFAULTS`
- Remove `RESOLUTION_PRESETS` export
- Remove `parseResolution` helper (or keep if used elsewhere — it is used in Game.tsx but we'll handle resolution differently)
- Keep `canvasResolution` in the interface but make it derived: when `qualityLevel === "potato"`, force `"640x480"`, otherwise default `"850x650"`

Actually, cleaner approach: keep `canvasResolution` in the settings type for backward compat but remove it from the UI. Add logic so that when quality is "potato", resolution is forced to "640x480", otherwise "850x650".

**2. `src/components/SettingsDialog.tsx`**
- Remove the canvas resolution selector (lines 196-223)
- Remove the "Show Quality Indicator" toggle (lines 185-194)
- Remove the Nectarine shout-out box (lines 239-253)
- In `updateDraft`, when quality changes to "potato", also set `canvasResolution: "640x480"`; otherwise set `canvasResolution: "850x650"`
- Fix the FPS overlay bug: the draft is initialized from `settings` on open (line 86), which should work. The issue is likely that `settings` state in the hook doesn't reflect the saved value because multiple hook instances exist and the cross-instance sync may not trigger. Will verify the `gameSettingsChanged` event flow — the fix is to ensure `handleOpenChange` reads from `loadSettings()` directly instead of stale `settings` state.

**3. `src/components/Game.tsx`**
- Remove the `QualityIndicator` rendering (line 9081-9083) and its import
- The `canvasResolution` parsing logic stays but will now be driven by quality level

**4. `src/components/QualityIndicator.tsx`**
- Delete this file (no longer used)

### FPS Toggle Bug Fix
The bug where FPS overlay appears off when re-entering settings: when the dialog opens, `setDraft({ ...settings })` snapshots from the hook's state. But if another hook instance saved, `settings` may be stale. Fix: read directly from localStorage in `handleOpenChange` via `loadSettings()`.

### Technical Details
- `canvasResolution` stays in the type to avoid breaking saved settings JSON, but is no longer user-configurable
- Kartoffel quality auto-sets 640x480; all other qualities use 850x650
- `VIDEO_DEFAULTS` updated to remove `showQualityIndicator` and `canvasResolution`

