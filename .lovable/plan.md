

# Revert Game Area to Fixed Size (Pre-Expansion)

## Problem
Two previous changes ("Expand game area to frame space" and "Expand game area to fill space") made the game canvas dynamically resize to fill all available space within the metal frame on desktop. The user wants the playable area to return to its original fixed size.

## Current behavior
- `useViewportFrame` makes the metal frame fill the entire viewport on desktop
- `useCanvasResize` uses ResizeObserver to dynamically size the game canvas to fill the `metal-game-area` container
- The canvas display size grows to match available space

## Desired behavior
The game canvas stays at its logical size (850×650 scaled by `scaleFactor`) and is simply centered within the frame — no dynamic expansion.

## Changes

### 1. `src/components/Game.tsx`
- **Remove** `useViewportFrame` import and hook call (lines 22, 1651-1654)
- **Remove** `useCanvasResize` import and hook call (lines 23, 1657-1667), along with destructured `displayWidth`, `displayHeight`, `dynamicScale`
- Remove `gameAreaRef` if only used for `useCanvasResize` (check first)
- On desktop, set the `game-glow` div's width/height explicitly to `SCALED_CANVAS_WIDTH` × `SCALED_CANVAS_HEIGHT` (same as mobile path but without the scale transform), so the canvas is fixed-size and centered

### 2. `src/hooks/useViewportFrame.ts`
- Delete file (no longer used)

### 3. `src/hooks/useCanvasResize.ts`
- Delete file (no longer used)

### 4. `src/index.css`
- Remove the `.metal-frame.desktop-fullscreen` CSS block (lines ~265-290) since the class is no longer applied
- Remove `max-width` constraint on `.metal-game-area` that references side panel widths — let it auto-size around the fixed canvas
- Keep `.metal-frame` as `width: fit-content` so it wraps the fixed-size content naturally

### 5. Verify
- `gameAreaRef` usage — if it's only for `useCanvasResize`, remove the ref. If used elsewhere (e.g. click handlers), keep it.
- `gameGlowRef` — same check; if only used by `useCanvasResize` for imperative sizing, it can be simplified but likely still needed for CRT overlay positioning.

