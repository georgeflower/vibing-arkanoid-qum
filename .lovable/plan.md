

## Intercept ESC in Fullscreen + Add Exit Fullscreen Button to Pause Menu

### Problem
When in fullscreen mode, pressing ESC exits fullscreen (browser default behavior) instead of opening the pause menu. The user wants ESC to open the pause menu, and a dedicated button in the pause menu to exit fullscreen.

### Changes

#### 1. `src/components/Game.tsx` — Intercept ESC before browser exits fullscreen (~line 3214)

In the existing `handleKeyPress` for Escape (line 3215), add `e.preventDefault()` when `isFullscreen` is true. This prevents the browser's default fullscreen-exit behavior. The existing pause logic already handles opening the pause menu.

**Problem**: The browser's `keydown` Escape event exits fullscreen *before* our handler runs in some browsers. The fix: listen on `keydown` with `capture: true` at the document level, and call `e.preventDefault()` + `e.stopPropagation()` when fullscreen is active, then handle pause ourselves.

Actually, the current handler is on the canvas element. We need to intercept at the document level with capture phase to beat the browser's fullscreen exit. Add a new `useEffect` that:
- Listens on `document` for `keydown` in capture phase
- When `e.key === "Escape"` and `isFullscreen`: calls `e.preventDefault()` and `e.stopPropagation()` to block browser fullscreen exit
- Then delegates to the existing pause/resume logic

The existing canvas-level ESC handler (line 3215) should remain but will be reached less often in fullscreen since the capture handler stops propagation. We need to move the pause logic into the capture handler when fullscreen is active.

#### 2. `src/components/Game.tsx` — Add "Exit Fullscreen" button to pause menu (~line 8948)

After the existing controls list in the pause overlay, add an "Exit Fullscreen" button (only shown when `isFullscreen` is true):
- Icon: `Minimize2` from lucide-react (or use `↔` text)
- Text: "EXIT FULLSCREEN"  
- Retro styled, matching existing pause menu buttons
- Calls `toggleFullscreen()` on click

Add it as a new row in the controls section or as an additional button in the button bar at the bottom.

### Summary
1. **New capture-phase ESC interceptor** — prevents browser from exiting fullscreen, opens pause menu instead
2. **"Exit Fullscreen" button** in pause menu — lets user explicitly exit fullscreen from the pause menu

