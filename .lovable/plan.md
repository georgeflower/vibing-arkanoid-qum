

# Fix Settings Menu Issues & Potato Quality Ball Bug

## Critical Bug: Ball Frozen on Potato Quality

**Root cause**: `src/utils/gameCCD.ts` line 59-64 has `qualitySubstepCaps` without a `potato` entry. When quality is `"potato"`, `qualitySubstepCaps["potato"]` returns `undefined`, causing `MAX_SUBSTEPS = undefined` and `PHYSICS_SUBSTEPS = NaN`, which breaks the CCD loop entirely -- the ball never moves.

**Fix**: Add `potato: 4` to `qualitySubstepCaps` in `gameCCD.ts`.

---

## All Changes

### 1. `src/utils/gameCCD.ts` -- Fix potato CCD
Add `potato: 4` to the `qualitySubstepCaps` object (line 59).

### 2. `src/components/SettingsDialog.tsx` -- Major rework
- Remove General tab entirely. Only Video and Sound tabs remain.
- Remove tutorial checkbox.
- Move Rapture/Nectarine shout-out to bottom of Video tab.
- Rename potato to "Kartoffel" with description: "For Rapture; RAPTURION the CENTURION of PENTURIONS -- it's powered by a po-ta-to!"
- When quality is changed to potato or low, auto-uncheck CRT (since CRTOverlay returns null for those).
- **Apply-on-Save pattern**: Use local draft state. Changes are previewed but only committed to `useGameSettings` (and thus localStorage/cloud) when the user clicks **Save**. Closing without saving reverts.
- Add **Save** button at the bottom of the dialog.
- Accept `onPauseMenuHide`/`onPauseMenuShow` callbacks: when settings opens from pause menu, hide the pause menu; when settings closes, show it again.

### 3. `src/hooks/useGameSettings.ts` -- Cloud sync + remove General defaults
- Remove `tutorialEnabled` from `GameSettings` interface and all defaults.
- Remove `GENERAL_DEFAULTS` and `resetGeneralDefaults`.
- Add `saveToCloud(settings)` function: if user is logged in, upsert `settings_json` JSONB column on `player_profiles`.
- Add `loadFromCloud()`: on mount, if logged in, fetch `settings_json` from profile; if found, merge over local and use as source of truth (prefer cloud).
- The `saveSettings` function saves to localStorage always, and to cloud if logged in.

### 4. Database migration -- Add settings column
```sql
ALTER TABLE public.player_profiles 
  ADD COLUMN IF NOT EXISTS settings_json jsonb DEFAULT NULL;
```
No new RLS needed -- existing "Users can update own profile" policy already allows authenticated users to update their own row.

### 5. `src/components/Game.tsx` -- Multiple fixes
- **Quality indicator**: Move `QualityIndicator` rendering **outside** the `ENABLE_DEBUG_FEATURES` guard so it always shows when `gameSettingsData.showQualityIndicator` is true.
- **Pause menu + settings**: Add state `settingsOpenFromPause` to track when settings is opened from pause. When true, hide the pause overlay. When settings closes, show pause again.
- **Resolution wiring**: Read `gameSettingsData.canvasResolution`, parse it, and pass the width/height to `GameCanvas` and `renderState` instead of using `SCALED_CANVAS_WIDTH`/`SCALED_CANVAS_HEIGHT` from `useScaledConstants`. Apply the same Mac scale factor.

### 6. `src/hooks/useScaledConstants.ts` -- Accept resolution override
Add an optional `resolutionOverride?: { width: number; height: number }` parameter. When provided, use those dimensions instead of `CANVAS_WIDTH`/`CANVAS_HEIGHT` from constants. This keeps all entity scaling proportional.

### 7. `src/components/QualityIndicator.tsx` -- Position outside canvas
Change from `fixed bottom-4 left-4` to `fixed top-4 right-4` (or another position that doesn't overlay the canvas). Display "Kartoffel" instead of "potato" for the potato level.

### 8. `src/components/MainMenu.tsx` -- Remove tutorial references
Remove `useTutorial` import and destructuring since tutorial setting is gone from settings. The tutorial system itself still works internally (via `useTutorial` in Game.tsx) -- we're just removing the user-facing toggle.

---

## Apply-on-Save Flow

```text
User opens Settings
  ├─ Draft state = copy of current settings
  ├─ User changes sliders/toggles → updates draft only
  ├─ [Save] → commit draft to useGameSettings → localStorage + cloud
  └─ [Close/X] → discard draft, revert to last saved
```

## Pause Menu + Settings Interaction

```text
Pause Menu visible
  ├─ User clicks Settings cog
  ├─ setPauseMenuHidden(true) → pause overlay hidden
  ├─ Settings dialog opens (fixed z-[200])
  ├─ User closes settings → setPauseMenuHidden(false)
  └─ Pause overlay reappears
```

