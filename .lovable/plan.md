

## Plan: Profile Revamp — Username-Only, Avatar Upload, Account Deletion, High Score Unlinking

### Summary

Remove `display_name` from the profile system. Make `username` the primary identity (required). Add avatar image upload (max 256x256). Add a "Delete Account" button with email re-verification. On deletion, null out `user_id` on high scores (keeping initials) and delete the profile row + auth user.

---

### 1. Database Changes (Migration)

- Add `avatar_url` column (text, nullable) to `player_profiles`
- Create a storage bucket `avatars` (public, max 256KB per file)
- Add RLS policies on `storage.objects` for the avatars bucket:
  - Users can upload/update/delete their own avatar (path = `{user_id}/avatar.*`)
  - Anyone can read (public bucket)
- Add a `delete-account` edge function entry in `config.toml` with `verify_jwt = false`
- Update `handle_new_user()` trigger: remove `display_name` parameter, set `display_name` = username (for backward compat, or drop the column later)

### 2. Edge Function: `delete-account`

New edge function `supabase/functions/delete-account/index.ts`:
- Validates JWT from Authorization header
- Requires a `confirmation_token` — user must re-enter their email to confirm
- Steps:
  1. Verify the provided email matches the authenticated user's email
  2. Set `user_id = NULL` on all `high_scores` rows for this user (keeps initials/scores)
  3. Delete avatar from storage bucket
  4. Delete `player_profiles` row
  5. Delete `daily_challenge_completions` rows
  6. Delete auth user via `supabase.auth.admin.deleteUser()`
- Returns success

### 3. Auth Page (`src/pages/Auth.tsx`)

- Remove `displayName` field from signup form
- Make `username` required (already is) — it becomes the primary identity
- Update signup metadata: `display_name` = username (for backward compat)

### 4. Profile Page (`src/pages/Profile.tsx`)

- Remove all `display_name` references; show `username` as the primary name
- Add avatar upload section:
  - Show current avatar or placeholder
  - File input accepting images (jpg/png/webp), max 256KB
  - Client-side resize to 256x256 using canvas before upload
  - Upload to `avatars/{user_id}/avatar.{ext}` in storage
  - Warning text: "Max 256x256 pixels. Inappropriate images will result in account suspension."
- Add "DELETE ACCOUNT" button (red, at bottom):
  - Opens confirmation dialog requiring user to type their email
  - Warning: "This will permanently delete your profile, stats, and achievements. Your initials will remain on the leaderboard but will no longer link to your profile. This action cannot be undone."
  - Calls `delete-account` edge function
  - Signs out and redirects to home

### 5. Public Profile Page (`src/pages/PublicProfile.tsx`)

- Replace `display_name` with `username`
- Show avatar image if available

### 6. High Score Display (`src/components/HighScoreDisplay.tsx`)

- When rendering scores that have a `user_id`, look up whether a public profile exists
- If yes, wrap the player name in a `<Link to="/player/{username}">`
- If `user_id` is null (deleted account), show initials as plain text (no link)
- This requires fetching public profiles for the displayed user_ids in a single query

### 7. High Score Hooks

- Update `useHighScores` to also fetch `user_id` from high_scores
- Add a secondary query to fetch `username, is_public, avatar_url` from `player_profiles` for the returned user_ids
- Pass profile data alongside scores for rendering

### 8. Username Uniqueness Check

- Already implemented in Profile.tsx edit flow
- Add same check in Auth.tsx signup: query `player_profiles` for existing username before calling `signUp`
- Note: There's a race condition window but the DB unique constraint will catch it

---

### File Summary

| File | Change |
|------|--------|
| Migration SQL | Add `avatar_url` to `player_profiles`, create `avatars` storage bucket + RLS, add DELETE RLS policy on `player_profiles` |
| `supabase/config.toml` | Add `[functions.delete-account]` with `verify_jwt = false` |
| `supabase/functions/delete-account/index.ts` | New — validates user, nulls `user_id` on high_scores, deletes profile + storage + auth user |
| `src/pages/Auth.tsx` | Remove display_name field, set display_name = username in metadata |
| `src/pages/Profile.tsx` | Remove display_name, add avatar upload with 256x256 resize, add delete account flow with email confirmation dialog |
| `src/pages/PublicProfile.tsx` | Show username as primary name, show avatar |
| `src/components/HighScoreDisplay.tsx` | Link player names to public profiles when user_id exists and profile is public |
| `src/hooks/useHighScores.ts` | Fetch user_id from high_scores, batch-lookup public profiles for linking |

