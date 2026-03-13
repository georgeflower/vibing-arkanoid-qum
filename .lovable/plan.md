

# Fix: Mobile Layout Issues on PublicProfile, HighScores, About, and Instructions

## Problems
1. **PublicProfile** — No X close button; bottom HOME button cut off on mobile
2. **HighScoreDisplay** — Inner container uses `absolute inset-0` which prevents proper scrolling; bottom CONTINUE button can be cut off
3. **About & Instructions overlays** (MainMenu.tsx) — Outer div uses `overflow-hidden` and Card uses `h-full max-h-screen`, causing bottom buttons to be clipped on mobile

## Root Cause
The daily challenge overlay works because it uses `overflow-y-auto` on the outer container and `max-h-[90vh]` on the Card (not `h-full`). The broken overlays use `overflow-hidden` and `h-full max-h-screen` which clips content.

## Changes

### 1. `src/pages/PublicProfile.tsx`
- Add an X close button in top-right corner (inside the content area, not fixed to viewport edge — safe from browser chrome). Use `useNavigate(-1)` to go back to previous page.
- Add `pb-12` bottom padding so the HOME button has clearance on mobile.

### 2. `src/components/HighScoreDisplay.tsx`
- Change inner div from `absolute inset-0 w-full h-full flex items-center justify-center` to `min-h-full flex items-center justify-center` so it scrolls with the outer container.

### 3. `src/components/MainMenu.tsx` — About overlay (~line 359)
- Change outer div from `overflow-hidden` to `overflow-y-auto`
- Change Card from `h-full max-h-screen` to `max-h-[90vh]`

### 4. `src/components/MainMenu.tsx` — Instructions overlay (~line 532)
- Same fix: outer `overflow-hidden` → `overflow-y-auto`, Card `h-full max-h-screen` → `max-h-[90vh]`

### 5. `src/components/MainMenu.tsx` — What's New overlay (~line 237)
- Same fix: outer `overflow-hidden` → `overflow-y-auto`, Card `h-full max-h-screen` → `max-h-[90vh]`

All changes follow the proven daily challenge layout pattern.

