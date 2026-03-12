

# Fix: CRT/FPS/Quality Indicator Not Working + Settings Revert Bug

## Two Issues

### Issue 1: CRT, FPS overlay, Quality indicator not working

**CRT**: Line 8325 in Game.tsx requires `qualitySettings.backgroundEffects` to be `true`, but potato and low quality both set `backgroundEffects: false`. CRT should be independent of background effects — the user toggle in settings should be sufficient.

**FPS overlay**: `gameSettingsData.showFpsOverlay` is never actually used. The FPS overlay is wired to `debugSettings.showFrameProfiler` instead. Need to also check `gameSettingsData.showFpsOverlay`.

**Quality indicator**: Uses `gameSettingsData.showQualityIndicator` which should work, but may be blocked by the same stale-state issue below.

### Issue 2: Settings revert when reopening dialog mid-game

`useGameSettings()` is a standard React hook — each component calling it gets its own independent `useState`. When the SettingsDialog saves and Game.tsx calls `updateGameSettings(s)`, that only updates Game's copy. The dialog's own hook instance retains the old values. When the dialog reopens, it snapshots its own stale `settings` as the draft.

**Root cause**: No shared state between hook instances. `saveSettings` writes to localStorage/cloud but doesn't notify other instances.

## Fix Plan

### 1. `src/hooks/useGameSettings.ts` — Add cross-instance sync via `storage` event + custom event

Add a `BroadcastChannel` or `CustomEvent` pattern so when one instance saves, all other instances update. Simplest approach: after `saveSettingsToLocal`, dispatch a custom window event. All instances listen for it and re-read from localStorage.

```ts
// After saveSettingsToLocal:
window.dispatchEvent(new CustomEvent('gameSettingsChanged'));

// In the hook, add useEffect listener:
useEffect(() => {
  const handler = () => setSettingsRaw(loadSettings());
  window.addEventListener('gameSettingsChanged', handler);
  return () => window.removeEventListener('gameSettingsChanged', handler);
}, []);
```

### 2. `src/components/Game.tsx` — Fix CRT condition (line 8325)

Remove `qualitySettings.backgroundEffects &&` from the CRT condition. CRT is controlled by the user's `crtEnabled` toggle and `debugSettings.enableCRTEffects`. The `CRTOverlay` component already handles disabling itself for potato/low quality internally.

```tsx
// Before:
{qualitySettings.backgroundEffects && gameSettingsData.crtEnabled && debugSettings.enableCRTEffects && <CRTOverlay ... />}

// After:
{gameSettingsData.crtEnabled && debugSettings.enableCRTEffects && <CRTOverlay ... />}
```

### 3. `src/components/Game.tsx` — Wire FPS overlay to settings

Add `gameSettingsData.showFpsOverlay` as an additional condition for the FrameProfilerOverlay:

```tsx
<FrameProfilerOverlay visible={debugSettings.showFrameProfiler || gameSettingsData.showFpsOverlay} />
```

### Summary of file changes
- **`src/hooks/useGameSettings.ts`**: Add `gameSettingsChanged` event dispatch in `saveSettings` and listener in the hook for cross-instance sync
- **`src/components/Game.tsx`**: Remove `qualitySettings.backgroundEffects` from CRT condition; wire `showFpsOverlay` to FrameProfilerOverlay

