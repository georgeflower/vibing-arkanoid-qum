

## Plan: Update Home, About, Instructions, Changelog, What's New, and README with Player Profile & Daily Challenge Info

### Changes

**1. `src/pages/Home.tsx`** — Add two new sections before the High Scores section:

- **Player Profiles section** (new `amiga-box` section): Describes the account system — create a username, upload an avatar, track stats/achievements, toggle public/private profile, link from leaderboard. Mentions privacy (password hashing, email verification, account deletion).
- **Daily Challenge section** (new `amiga-box` section): Describes the daily challenge mode — new challenge every day, unique modifiers (125% speed, enemy spawns every 10s, music-reactive backgrounds, no extra lives), objectives to complete, streak tracking, and leaderboard.

Also update the Game Modes subsection in the Rules area to mention Daily Challenge as a third mode.

**2. `src/components/MainMenu.tsx` — About overlay (~line 321-436):**
- Add a new card section for "Player Profiles" describing accounts, avatars, public profiles, and leaderboard linking.
- Add a new card section for "Daily Challenge" describing the mode, modifiers, streaks, and objectives.

**3. `src/components/MainMenu.tsx` — Instructions overlay (~line 469-690):**
- Add a new "Player Profile" section explaining how to create an account, set username/initials, upload avatar, toggle public/private.
- Add a new "Daily Challenge" section explaining the mode, how to access it, modifier effects, and streak rewards.

**4. `src/components/MainMenu.tsx` — What's New overlay (~line 228-318):**
- Keep all existing sections (Engine, Boss Hit Streak, Performance).
- Add two new sections after existing ones:
  - **Player Profile System** — username-based accounts, avatar uploads, public profiles linked from leaderboard, account deletion with data safety.
  - **Daily Challenge Mode** — daily generated challenges with modifiers, objectives, streak tracking.

**5. `src/constants/version.ts`** — Add a new changelog entry at the top for the profile system and daily challenge features.

**6. `README.md`** — Add to Features list:
- **Player profiles** with usernames, avatars, public/private toggle, and leaderboard linking
- **Daily Challenges** with unique modifiers, objectives, and streak tracking
- **Account system** with secure auth, email verification, and full account deletion

### File Summary

| File | Change |
|------|--------|
| `src/pages/Home.tsx` | Add Player Profiles + Daily Challenge sections, update Game Modes |
| `src/components/MainMenu.tsx` | Add profile + daily challenge info to About, Instructions, and What's New overlays |
| `src/constants/version.ts` | New changelog entry for profile system + daily challenge |
| `README.md` | Add profile, daily challenge, and account features to Features list |

