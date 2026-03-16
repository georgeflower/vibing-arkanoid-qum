

## Fix: Settings Not Applied from Main Menu + FPS Overlay Issues

### Issues Identified

1. **Settings not applied from Main Menu**: The `SettingsDialog` in MainMenu has no `onSettingsSaved` callback, so quality/CRT changes are saved to localStorage but the MainMenu's own `quality` state (from `useAdaptiveQuality`) is never updated. The MainMenu initializes `useAdaptiveQuality` with a hardcoded `initialQuality: "high"` and never syncs it with saved settings.

2. **CRT/FPS toggles show wrong state on re-open**: The draft loads from `loadSettings()` which reads localStorage correctly, but `VIDEO_DEFAULTS` has `crtEnabled: true` and `showFpsOverlay: false`. The real issue is that `useGameSettings` defaults have `crtEnabled: true`, and when the settings dialog opens, it reads from localStorage which may have stale or default values merged incorrectly.

3. **FPS overlay shows FrameProfiler (complex debug panel) instead of simple FPS**: The `showFpsOverlay` setting triggers `FrameProfilerOverlay` which is a full debug panel, not a simple FPS counter. User wants a lightweight "FPS: XX | Δt: XXms" display in the lower-left of the game canvas.

### Changes

**1. `src/components/MainMenu.tsx`** — Wire up `onSettingsSaved` + sync quality from saved settings:

- Add `onSettingsSaved` to the `SettingsDialog` to update the local `quality` state via `useAdaptiveQuality`'s `setQuality`.
- Initialize `useAdaptiveQuality` with the saved quality from `gameSettings.qualityLevel` instead of hardcoded "high".

```tsx
const { quality, qualitySettings, setQuality } = useAdaptiveQuality({
  initialQuality: gameSettings.qualityLevel || "high",
  autoAdjust: false,
});

<SettingsDialog
  open={showSettings}
  onOpenChange={setShowSettings}
  hideTrigger
  onSettingsSaved={(s) => {
    setQuality(s.qualityLevel);
  }}
/>
```

**2. `src/components/Game.tsx`** — Replace `FrameProfilerOverlay` for FPS setting with a new simple FPS HUD:

- Create a new lightweight component `src/components/FpsOverlay.tsx` that reads from `renderState` or the game loop's FPS and shows "FPS: XX | Δt: XX.Xms" in the lower-left corner, rendered on top of the game canvas.
- Remove the `gameSettingsData.showFpsOverlay` condition from `FrameProfilerOverlay` (keep only `debugSettings.showFrameProfiler`).
- Add the new `FpsOverlay` component controlled by `gameSettingsData.showFpsOverlay`.

**3. New file: `src/components/FpsOverlay.tsx`**

A minimal component that polls FPS from the game loop at ~500ms intervals and displays:
- FPS value (color-coded: green ≥55, yellow ≥30, red <30)  
- Delta time in ms
- Positioned fixed bottom-left on mobile, bottom-left on desktop
- Small monospace font, semi-transparent background, pointer-events-none

**4. Fix CRT/FPS toggle state persistence**: The defaults have `crtEnabled: true` — when `loadSettings()` merges, it correctly uses stored values. The issue is the MainMenu's `useAdaptiveQuality` doesn't reflect saved quality, so `qualitySettings.backgroundEffects` may be wrong. Fix #1 above resolves this.

