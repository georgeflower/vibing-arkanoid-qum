

## Fix: Fullscreen ESC Behavior + Pointer Lock Management

### Root Cause

**Browsers intentionally ignore `preventDefault()` for ESC in fullscreen mode** — this is a security restriction that cannot be overridden. The `capture: true` interceptor we added doesn't actually prevent the browser from exiting fullscreen.

The current behavior depends on pointer lock state:
- **Pointer locked**: ESC first releases pointer lock (browser behavior), which triggers `handlePointerLockChange` → pauses game. But fullscreen also exits.
- **Pointer not locked**: ESC exits fullscreen directly. The `fullscreenchange` handler fires, but on desktop it only handles mobile, so no pause happens.

### Solution

Since we **cannot prevent the browser from exiting fullscreen on ESC**, the approach is:

1. **Always request pointer lock when entering fullscreen** (not just on canvas click/game start)
2. **Re-request pointer lock when resuming from pause in fullscreen**
3. **Handle `fullscreenchange` on desktop too** — when fullscreen exits unexpectedly (via ESC), pause the game and release pointer lock
4. **Remove the capture-phase ESC interceptor** (it doesn't work and gives false confidence)

### Changes

#### `src/components/Game.tsx`

**1. Remove the capture-phase ESC interceptor** (lines 3211-3250)
- Delete the entire `useEffect` that adds `handleEscCapture` — it cannot prevent fullscreen exit.

**2. Update `handleFullscreenChange`** (lines 8202-8213)
- Remove the `isMobileDevice` guard so desktop also pauses when fullscreen exits:
```
if (!isNowFullscreen && gameState === "playing") {
  setGameState("paused");
  document.exitPointerLock();
  if (gameLoopRef.current) {
    gameLoopRef.current.pause();
  }
  // Show fullscreen prompt on mobile only
  if (isMobileDevice) {
    setShowFullscreenPrompt(true);
  }
  toast.info("Game paused. Press ESC to resume.");
}
```

**3. Request pointer lock after entering fullscreen** (inside `toggleFullscreen`, after `setIsFullscreen(true)` ~line 8178)
- Add a small delay then request pointer lock:
```
setTimeout(() => {
  const canvas = canvasRef.current;
  if (canvas && canvas.requestPointerLock && gameState === "playing") {
    canvas.requestPointerLock();
  }
}, 300);
```

**4. Request pointer lock when resuming from pause** (in the existing ESC-resume handler ~line 3234 and other resume spots)
- Already done in most places, but verify the canvas-level ESC handler and pause overlay resume buttons all request pointer lock.

### Flow After Fix

1. User starts game → auto-fullscreen → pointer lock requested
2. User presses ESC → browser exits fullscreen + releases pointer lock → `fullscreenchange` fires → game pauses
3. User presses ESC again → existing handler resumes game (in windowed mode)
4. User presses F → enters fullscreen → pointer lock re-requested
5. "EXIT FULLSCREEN" button in pause menu still works as before

### Files
- **Edit**: `src/components/Game.tsx`

