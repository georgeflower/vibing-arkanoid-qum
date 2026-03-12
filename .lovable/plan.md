

# Fix Mobile Scrollability Issues

## Problem
Several pages and overlays use `min-h-screen flex items-center justify-center` without allowing overflow scrolling, causing content to be cut off on small mobile screens (360x605).

## Affected Components

### Pages (full-screen, not scrollable)
1. **Auth.tsx** (line 123-125) — `min-h-screen flex items-center justify-center p-4` with no overflow. Signup mode has many fields that overflow on mobile.
2. **ResetPassword.tsx** (line 49-51) — Same pattern, `min-h-screen flex items-center justify-center p-4`.

### Overlays/Popups (potentially clipped)
3. **HighScoreDisplay.tsx** (line 39) — `overflow-hidden` on root, inner content may clip.
4. **DailyChallengeArchive.tsx** (line 84) — `overflow-hidden` on outer container.
5. **DailyChallengeResultOverlay.tsx** — Already has `overflow-y-auto` on outer div, looks OK.

### Pages already using fixed+overflow pattern (likely OK)
- Profile.tsx, PublicProfile.tsx, PrivacyPolicy.tsx, TermsOfService.tsx — All use `position: fixed, inset: 0, overflowY: "auto"` which should scroll fine.

## Fix Strategy

For each affected component, wrap content in a scrollable container:

1. **Auth.tsx**: Change outer div to `overflow-y-auto` with `fixed inset-0` pattern, keep inner flex centering via a `min-h-screen` wrapper inside.
2. **ResetPassword.tsx**: Same fix as Auth.
3. **HighScoreDisplay.tsx**: Change `overflow-hidden` to `overflow-y-auto` on root container, and ensure inner card doesn't use fixed max-height that clips.
4. **DailyChallengeArchive.tsx**: Change `overflow-hidden` to `overflow-y-auto` on outer container.

## Implementation Details

- Auth.tsx & ResetPassword.tsx: Change outer div to `fixed inset-0 overflow-y-auto` with background, then use an inner `min-h-screen flex items-center justify-center p-4` div that acts as the centering wrapper (content will scroll when it overflows).
- HighScoreDisplay.tsx: Replace `overflow-hidden` with `overflow-y-auto` on the root fixed div.
- DailyChallengeArchive.tsx: Replace `overflow-hidden` with `overflow-y-auto` on the root fixed div.

