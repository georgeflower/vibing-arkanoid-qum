

# Settings Menu with Tabs (General, Video, Sound)

## Overview
Create a comprehensive Settings dialog accessible from both Main Menu and Pause Menu, replacing the current `MusicSettings` component. The dialog uses a tabbed layout (General, Video, Sound) with localStorage persistence, a new "Potato" quality preset, resolution selection, and a shout-out to Rapture from Nectarine.

## New Files

### `src/hooks/useGameSettings.ts`
Central settings hook with localStorage persistence. Manages:
- **Sound**: `musicEnabled`, `sfxEnabled`, `musicVolume` (0-100), `sfxVolume` (0-100), `currentTrack`
- **Video**: `qualityLevel` (potato/low/medium/high), `crtEnabled`, `showFpsOverlay`, `showQualityIndicator`, `canvasResolution` (preset list from 320x200 to 1600x1200, default = current CANVAS_WIDTH x CANVAS_HEIGHT i.e. 850x650)
- **General**: `tutorialEnabled`
- Defaults stored as constants for per-tab "Reset to Default" buttons
- All values read/written to `localStorage` under key `"gameSettings"`

### `src/components/SettingsDialog.tsx`
Tabbed dialog component with three tabs:
- **General tab**: Tutorial toggle, Rapture/Nectarine shout-out easter egg section
- **Video tab**: Quality preset (Potato/Low/Medium/High radio), CRT toggle, FPS overlay toggle, Quality indicator toggle, Canvas resolution dropdown (320x200, 640x400, 640x480, 800x600, 850x650*, 1024x768, 1280x960, 1600x1200), "Press Q to cycle quality" hint, Reset to Default button
- **Sound tab**: Music on/off + volume slider, SFX on/off + volume slider, Track selector (existing radio group), Reset to Default button
- Each tab has its own "Reset to Default" button
- Props: `open`, `onOpenChange`, `gameState?`, `setGameState?` (for pause menu integration)

## Modified Files

### `src/hooks/useAdaptiveQuality.ts`
- Add `"potato"` to `QualityLevel` type: `"potato" | "low" | "medium" | "high"`
- Add `potato` preset to `QUALITY_PRESETS`:
  ```
  potato: {
    particleMultiplier: 0,
    shadowsEnabled: false,
    glowEnabled: false,
    screenShakeMultiplier: 0,
    explosionParticles: 0,
    backgroundEffects: false,
    resolutionScale: 0.5,
    chaosGlowEnabled: false,
    animatedDashesEnabled: false,
    shieldArcsEnabled: false,
    superWarningEffects: false,
    ambientFlickerEnabled: false,
  }
  ```
- Update Q key cycling to include potato: `["potato", "low", "medium", "high"]`
- Update auto-adjust downgrade path to include potato (below low threshold → potato)

### `src/utils/particleLimits.ts`
- Add `potato` tier: `{ maxTotal: 0, maxPerExplosion: 0, maxPerHighScore: 0, maxPerGameOver: 0 }`

### `src/utils/sounds.ts`
- Add `musicVolume` and `sfxVolume` private fields (default 0.3 and 0.7)
- Add `setMusicVolume(v: number)`, `getMusicVolume()`, `setSfxVolume(v: number)`, `getSfxVolume()` methods
- Apply `musicVolume` when creating/playing music tracks and boss music
- Apply `sfxVolume` as a multiplier in `playAudioBuffer()` and oscillator gain nodes

### `src/components/CRTOverlay.tsx`
- Remove hardcoded `quality === 'low'` return null check; CRT is now controlled by the settings `crtEnabled` flag passed via props or context

### `src/components/MainMenu.tsx`
- Add "Settings" button (gear icon) to the action buttons list, opening `SettingsDialog`
- Remove old music-only settings if present
- Wire quality/sound settings from `useGameSettings` hook

### `src/components/Game.tsx`
- Replace `MusicSettings` usage with `SettingsDialog` in pause menu
- Read settings from `useGameSettings` and pass to adaptive quality system
- Wire `crtEnabled` setting to CRT overlay condition (replace `debugSettings.enableCRTEffects`)
- Wire `showFpsOverlay` and `showQualityIndicator` settings to their respective overlays
- Wire `canvasResolution` to `SCALED_CANVAS_WIDTH`/`SCALED_CANVAS_HEIGHT` if custom resolution selected
- Q key cycling already exists (line 3130-3143) — update to include potato level

### `src/components/QualityIndicator.tsx`
- Add potato color (e.g., brown `hsl(30, 50%, 40%)`)

### `src/engine/renderLoop.ts`
- Update `setRenderTargetFps` to handle `"potato"` level (cap at 30 FPS for potato)

## Rapture/Nectarine Shout-out
In the General tab, a small styled section:
> *"Greetings to 🇩🇪Rapture from Nectarine Demoscene Radio — keeping the scene alive since 2002! If you know, you know. 🎵"*

Styled with retro pixel text and a subtle border.

## Resolution System
The canvas resolution selector changes `CANVAS_WIDTH`/`CANVAS_HEIGHT` used for the game. Since these are currently constants imported from `game.ts`, the settings hook will expose `canvasWidth`/`canvasHeight` overrides that `useScaledConstants` reads. The game canvas and all rendering scales proportionally via the existing scale factor system. Available presets:
- 320×200, 640×400, 640×480, 800×600, **850×650** (default), 1024×768, 1280×960, 1600×1200

## Persistence
All settings saved to `localStorage` on change, loaded on mount. The `useGameSettings` hook is the single source of truth, consumed by both MainMenu and Game components.

