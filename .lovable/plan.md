

# Fix: Canvas Shrinking to Zero (Resize Feedback Loop)

## Root Cause

The `useCanvasResize` hook creates a **feedback loop**:
1. It observes `gameAreaRef` (the `metal-game-area` div) with `ResizeObserver`
2. It reads `container.clientWidth/Height` to calculate the canvas size
3. It sets `gameGlowRef` (the child) to that calculated size
4. The `metal-game-area` uses `flex: 1` — its size depends partly on its children's content
5. A smaller child → smaller container → smaller calculation → repeat until zero

The reverted changes likely had CSS that prevented this collapse. The fix is straightforward.

## Fix

**File: `src/hooks/useCanvasResize.ts`**

Stop the feedback loop by reading the container's **available space from the parent** rather than from the observed element itself, or — simpler — give `metal-game-area` a minimum size so it can't collapse.

Best approach: **Change the hook to not shrink below the initial observation**. Specifically, guard against shrinking by checking if `availableWidth` or `availableHeight` are unreasonably small (< 100px), and if so, skip the update. Also, ensure the container doesn't depend on child size.

**File: `src/index.css`**

Add `min-width: 0` and `min-height: 0` aren't enough — the real fix is to make `.metal-game-area` size independent of its children when `useCanvasResize` is active. Add:
- `overflow: hidden` (already present conceptually but the flex child can still grow the parent)
- The container already has `flex: 1` — ensure it also has `min-width: 200px; min-height: 200px` as a floor

**Simplest complete fix (2 changes):**

1. **`src/index.css`** — Add to `.metal-game-area`:
   ```css
   min-width: 200px;
   min-height: 200px;
   ```

2. **`src/hooks/useCanvasResize.ts`** — In `calculateSize`, skip the update if available dimensions are too small (< 50px), preventing the collapse from starting:
   ```typescript
   if (availableWidth < 50 || availableHeight < 50) return;
   ```

These two changes break the feedback loop: the CSS floor prevents the container from collapsing, and the guard prevents applying nonsensically small sizes.

