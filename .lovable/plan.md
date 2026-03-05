

# Reverting Selected Changes

You want to remove specific earlier changes while keeping later ones. Unfortunately, the built-in revert feature works as a full rollback to a point in time — it can't selectively skip individual changes while keeping later ones.

Since these changes are interleaved with other work you want to keep, the only way to achieve this is to manually undo the code those changes introduced. Let me explore what those changes affect to build a plan.

Based on the memory context and file names, those 5 changes all relate to the **desktop auto-fullscreen and viewport-filling layout system**. Specifically:

1. **Desktop layout optimize** — introduced `useViewportFrame` hook and `.desktop-fullscreen` CSS class
2. **Gate desktop resize by viewport** — added viewport width gating in `useCanvasResize`
3. **Expand game area to fill space** — CSS and hook changes to make game area fill available space
4. **Expand game area to frame space** — further adjustments to frame/game area sizing
5. **Auto fullscreen on start desktop** — auto-fullscreen logic in `Game.tsx` with `hasAutoFullscreenedRef`

These are tightly coupled. Removing them means:

- **Delete `src/hooks/useViewportFrame.ts`** entirely
- **Revert `src/hooks/useCanvasResize.ts`** — remove the viewport-width gating logic (the `< 769px` bail-out that clears inline styles)
- **Revert `src/components/Game.tsx`** — remove auto-fullscreen-on-start logic (`hasAutoFullscreenedRef`, the effect that triggers fullscreen on game start)
- **Revert `src/index.css`** — remove the `.desktop-fullscreen` CSS rules and the `metal-frame.desktop-fullscreen` media query block
- **Remove `useViewportFrame` usage** from wherever it's called (likely `Game.tsx` or `GameUI.tsx`)

I need to read the affected files to identify the exact code to remove.
