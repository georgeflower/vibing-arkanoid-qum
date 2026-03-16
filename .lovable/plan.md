

## Asset Preloader Screen with Fun Progress Bar

### Concept
After the user clicks "Start Game" on the main menu, show a retro/nerdy loading screen that preloads all images and audio before launching the game. The progress bar shows fun techie messages as each asset loads.

### Architecture

**New file: `src/components/AssetPreloader.tsx`**
- Full-screen overlay with CRT-style dark background
- Animated progress bar with retro pixel styling
- Scrolling log of nerdy messages as assets load (e.g. "Initializing photon deflector array...", "Calibrating brick molecular density...", "Loading boss threat intelligence...")
- Each asset maps to a fun description
- On completion: brief "SYSTEMS ONLINE" flash, then launches the game

**Asset manifest** — all assets to preload:
- ~40 images from `src/assets/` (imported via Vite, already have hashed URLs)
- ~14 SFX from `soundManager.soundUrls`  
- ~15 music tracks from `soundManager.trackUrls`
- ~4 boss music tracks

Total: ~73 assets, each ticks the progress bar

**Fun log messages** (examples per category):
- Paddle: `"Magnetizing paddle surface... done"`
- Power-ups: `"Charging multiball quantum splitter... done"`
- Boss backgrounds: `"Scanning boss lair architecture... done"`
- Music: `"Decoding chiptune frequency matrix... done"`
- SFX: `"Buffering explosion shockwave samples... done"`

### Flow Change in `src/pages/Index.tsx`
```
MainMenu → [user clicks start] → AssetPreloader → Game
```

Add a `"preloading"` state between menu and game. When `handleStartGame` fires, transition to preloader. When preloader completes, mount `<Game>`.

### UI Design
- Black background with subtle scanline effect
- Green/amber monospace text scrolling upward (terminal style)
- Progress bar: retro segmented blocks filling left-to-right
- Percentage counter: `[███████░░░] 73% — Decrypting brick color palettes...`
- Final message: `"> ALL SYSTEMS NOMINAL. ENGAGE!"` with a brief glow before auto-transitioning

### Files to Create/Edit
1. **Create `src/components/AssetPreloader.tsx`** — the preloader component with progress bar, log messages, and asset loading logic
2. **Edit `src/pages/Index.tsx`** — add preloading state between menu and game

