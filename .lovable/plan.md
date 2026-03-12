

# Add Mobile Timer Display Above Game Canvas

## Problem
On mobile, when frames are hidden, the compact HUD only shows SCORE, LV, and LIVES. The timer/countdown is only visible in the right panel (which is hidden on mobile). The user wants the timer displayed in the gap between the compact HUD and the game canvas — the area highlighted with the blue rectangle in the screenshot.

## Plan

**File: `src/components/Game.tsx`**

Inside the `{!framesVisible && (...)}` compact HUD block (around line 9060-9140), add a second row below the existing SCORE/LV/LIVES bar that shows:
- **Daily Challenge mode**: "TIME LEFT: Xs" countdown with urgent styling when ≤30s (red + pulse), matching the right panel's logic
- **Normal mode**: "TIMER: Xs" showing elapsed time

The new element will be:
- `fixed` positioned, centered horizontally, below the compact HUD (~`top-14` or similar)
- Larger font than the compact HUD stats to be clearly visible
- Same `pointer-events-none` and semi-transparent background styling
- Uses the same `totalPlayTime`, `timer`, `isDailyChallenge`, and `settings.dailyChallengeConfig?.timeLimit` variables already in scope

This reuses the exact same countdown logic already present in the right panel (lines 8865-8894) but rendered in the mobile compact HUD area.

