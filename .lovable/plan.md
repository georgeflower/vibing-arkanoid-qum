

## Plan: Achievement Unlock Notifications

### Overview
When a game ends (game over or victory), the server already checks for newly unlocked achievements. Currently, the response data is discarded. This plan adds retro-styled in-game notifications for any achievements unlocked during that session.

### Changes

**1. Edge function: Return achievement IDs, not just count**

**`supabase/functions/update-profile-stats/index.ts`** (~line 148-190):
- Track which specific achievements were newly unlocked (collect their IDs)
- Return `{ success: true, newAchievements: ["first_blood", "brick_breaker", ...] }` (array of IDs instead of count)

**`supabase/functions/submit-daily-challenge/index.ts`** — same change: return newly unlocked IDs array.

**2. `src/utils/profileStats.ts`**
- Change `submitGameStats` to return `Promise<string[]>` (newly unlocked achievement IDs)
- Parse the response from the edge function and return the IDs array

**3. New component: `src/components/AchievementNotification.tsx`**
- A retro-styled overlay/toast that shows each unlocked achievement with its icon, name, and description
- Animated entrance: slides in from top with pixel-style border, gold/amber glow, stays for ~4s per achievement
- Stacks if multiple achievements unlock at once (staggered with ~1s delay)
- Uses the `ACHIEVEMENTS` constant to look up icon/name/description by ID

**4. `src/components/Game.tsx`**
- After `submitGameStats` call (both game over ~line 1830 and victory ~line 4069), capture the returned achievement IDs
- Store in state: `const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([])`
- Render `<AchievementNotification>` when the array is non-empty
- Clear after all notifications have been shown

- Also for QUMRAN specifically: the in-game moment when all 6 letters are collected (~line 2197) already shows a toast — keep that as the immediate reward. The achievement notification will appear at game end when stats are submitted.

**5. `src/utils/dailyChallengeSubmit.ts`**
- Update return type to include `newAchievements: string[]` (IDs array)
- Wire into the daily challenge result flow for notifications there too

### Visual Design
- Retro pixel-text styling consistent with existing UI
- Dark background with gold/amber border and glow
- Achievement icon (emoji) prominently displayed
- "ACHIEVEMENT UNLOCKED" header text
- Achievement name and description below
- Auto-dismisses after 4 seconds with fade-out

### Technical Notes
- Achievement lookup uses the existing `ACHIEVEMENTS` array from `src/constants/achievements.ts`
- Notifications are purely client-side presentation; the server is the source of truth for what's unlocked
- No new database changes needed — the edge functions already handle achievement tracking

