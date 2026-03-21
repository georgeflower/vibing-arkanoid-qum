

## Fix: Stop High Score Music When Leaving Daily Challenge

### Problem
When completing or failing a daily challenge, high score music starts playing. When navigating back to menu via "DAILY CHALLENGES" or "MAIN MENU" buttons, `onReturnToMenu()` is called directly without stopping the high score music first. The main menu then starts its own background music, causing two tracks to overlap.

### Fix

**`src/components/Game.tsx`** — Add `soundManager.stopHighScoreMusic()` (and `stopBossMusic`/`stopBackgroundMusic` for safety) before the `onReturnToMenu()` calls in the daily challenge result overlay callbacks:

1. **`onBackToDaily`** (line ~8850-8853): Add music stop calls before `onReturnToMenu()`
2. **`onReturnToMenu`** (line ~8854): Wrap in a handler that stops all music before calling `onReturnToMenu()`

Both paths need: `soundManager.stopHighScoreMusic()`, `soundManager.stopBossMusic()`, `soundManager.stopBackgroundMusic()` — matching the pattern already used in `handleEndScreenReturnToMenu`.

### Files
- `src/components/Game.tsx`

