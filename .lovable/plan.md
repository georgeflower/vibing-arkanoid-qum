

## Auto-fill initials for logged-in players

**Goal**: When a logged-in user qualifies for the high score list, skip the manual initials entry and auto-submit using their profile's stored initials.

### Changes

**1. `src/components/Game.tsx`** — Fetch user initials on mount
- Import `supabase` client at top level.
- Add a `useEffect` that listens to auth state and fetches `initials` from `player_profiles` for the logged-in user. Store in a ref (`userInitialsRef`).
- At both high-score submission points:
  - **Campaign** (`showHighScoreEntry`): If `userInitialsRef.current` exists, skip showing `HighScoreEntry` and call `handleHighScoreSubmit(userInitialsRef.current)` directly.
  - **Boss Rush** (`showBossRushScoreEntry`): Same — auto-invoke the `onSubmit` handler with the stored initials.

**2. `src/components/HighScoreEntry.tsx`** — Add optional `defaultName` prop
- Accept `defaultName?: string` prop.
- Initialize `name` state with `defaultName ?? ""`.
- This serves as a fallback if we still show the entry form (e.g., user has no initials set).

**3. `src/components/BossRushScoreEntry.tsx`** — Same `defaultName` treatment
- Accept `defaultName?: string` prop and pre-fill the input.

### Flow
- Logged in with initials set → entry form is bypassed, score auto-submitted with profile initials.
- Logged in without initials → show entry form (empty, as today).
- Not logged in → show entry form (as today).

