
## Plan: Enable Debug Features

### Change
**File: `src/constants/game.ts` (Line 4)**

Set `ENABLE_DEBUG_FEATURES` from `false` to `true`.

### Effect
Enabling debug mode will activate:
- **Debug Mode Indicator** (top-left corner showing "DEBUG MODE")
- **Debug Dashboard** (accessible via mobile button or keyboard, toggles with Tab key)
  - Visual overlays for game loop timing, physics substeps, CCD performance, collision history, frame profiling, power-up weights, and entity pool stats
  - Logging toggles for collisions, power-ups, performance, FPS, paddle, boss, screen shake, pointer lock, GC, and lag detection
  - Effect toggles (screen shake, particles, explosions, CRT effects)
  - Log download/clear functionality
- **Mobile Debug Button** (yellow 🐛 emoji on right side of screen when not already showing dashboard)
- **Console Logging** for ball tracking, debug toasts, and other debug events
- **Keyboard Shortcuts**:
  - `Tab` - Toggle debug dashboard
  - `L` - Toggle game loop debug overlay
  - `W` - Toggle substep debug overlay
  - `C` - Toggle CCD performance overlay
  - `H` - Toggle collision history
  - `X` - Toggle frame profiler
  - `Z` - Toggle power-up weights
  - `V` - Toggle pool stats
  - `Q` - Toggle debug mode indicator
  - `§` - Toggle all overlays at once

### Implementation
Single-line change: `export const ENABLE_DEBUG_FEATURES = true;`
