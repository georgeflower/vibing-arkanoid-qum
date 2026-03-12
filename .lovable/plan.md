

# Fix Pause Menu on Mobile: Settings Button & Scrollability

## Root Cause

The pause overlay (line 8654) is rendered **inside** the `game-glow` container, which on mobile has `transform: scale(${gameScale})`. This causes two problems:

1. **Settings dialog doesn't work**: CSS `transform` on an ancestor makes `fixed` positioning (used by Radix Dialog portal) behave like `absolute`. The dialog overlay/content renders incorrectly or is clipped.
2. **Not scrollable**: The pause overlay uses `absolute inset-0` relative to the 850×650 pre-scale canvas container, then gets scaled down. `max-h-[90vh]` and `overflow-y-auto` don't work correctly inside a transformed context.

## Fix

**File: `src/components/Game.tsx`**

Move the entire pause overlay block (lines 8653-8770) **outside** the `game-glow` div (after line 8771's closing `</div>`), and change it from `absolute inset-0` to `fixed inset-0` so it covers the full viewport independently of the scaled game container.

- Change outer div: `absolute inset-0` → `fixed inset-0`
- Change inner div: remove `max-h-[90vh]`, use `max-h-[calc(100vh-2rem)]` or `max-h-[95dvh]` with `overflow-y-auto`
- Add higher z-index (`z-[200]`) to ensure it sits above mobile controls and other fixed elements
- The SettingsDialog trigger inside will now work correctly since it's no longer inside a CSS-transformed container

