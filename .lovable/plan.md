

## Plan: Revamped Profile System with Public/Private Profiles, Legal Pages, and Enhanced Auth

### Important Architecture Note

This project uses Lovable Cloud (Supabase) for authentication. Supabase Auth already handles password hashing (bcrypt), JWT sessions, email verification, rate limiting, and CSRF protection. We cannot and should not reimplement these — instead we extend the existing system with the requested features mapped to what's architecturally possible.

**What Supabase Auth already provides:**
- Password hashing (bcrypt with salt) — built-in, not customizable
- JWT-based sessions with short expiration + auto-refresh
- Email verification flow
- Rate limiting on auth endpoints
- HTTPS-only, secure cookies
- No plaintext passwords stored anywhere

**What we will add on top:**
- Username + initials fields on profile
- Public/private profile toggle
- Editable profile page
- Password strength validation (client-side: 10 chars min, common password rejection)
- Password reset flow
- Resend verification email
- Privacy Policy and Terms of Service pages
- Linkable profiles from high score leaderboard

---

### 1. Database Changes

**Add columns to `player_profiles`:**
- `username` (text, unique) — distinct from display_name, used for public URL
- `initials` (text, 3 chars) — used on high score submissions
- `is_public` (boolean, default false) — controls profile visibility
- `bio` (text, nullable, max 200 chars) — optional short bio

**Add RLS policy:**
- Public profiles viewable by anyone: `SELECT` where `is_public = true` (anonymous + authenticated)
- Keep existing policies for own-profile access

**Add unique constraint on username.**

---

### 2. Auth Page Enhancements (`src/pages/Auth.tsx`)

- Add `username` field (unique, 3-20 chars, alphanumeric + underscores) to signup form
- Add `initials` field (exactly 3 uppercase letters) to signup form
- Enforce minimum 10-character password with client-side strength meter
- Reject common passwords (top 100 list checked client-side)
- Add "Forgot Password?" link that calls `supabase.auth.resetPasswordForEmail()`
- Add "Resend Verification Email" button for unverified users
- Store username + initials in `raw_user_meta_data` on signup, then propagate to profile via the existing `handle_new_user` trigger

**Update `handle_new_user()` trigger** to also set `username` and `initials` from `raw_user_meta_data`.

---

### 3. Password Reset Flow

- New page: `src/pages/ResetPassword.tsx` at route `/reset-password`
- Checks for `type=recovery` in URL hash
- Shows form to set new password (with same 10-char + common password validation)
- Calls `supabase.auth.updateUser({ password })`

---

### 4. Profile Page Revamp (`src/pages/Profile.tsx`)

- **Editable fields:** display_name, username, initials, bio, is_public toggle
- **Edit mode:** Toggle between view and edit with save/cancel
- **Validation:** Username uniqueness check (query before save), initials exactly 3 uppercase chars
- **Public/Private toggle** with explanation text
- **Email verified status** indicator
- Keep existing stats, achievements, daily challenge sections
- Add link to own public profile URL when public

---

### 5. Public Profile Page

- New page: `src/pages/PublicProfile.tsx` at route `/player/:username`
- Fetches profile by username where `is_public = true`
- Shows: display_name, username, stats, achievements (read-only)
- Shows 404-style message if profile is private or doesn't exist
- Retro-styled to match existing UI

---

### 6. High Score Leaderboard Links

- In `HighScoreDisplay.tsx` and `Home.tsx` leaderboard sections:
  - When rendering player initials/names, check if a public profile exists for that player
  - If yes, wrap the name in a link to `/player/:username`
  - This requires a lookup: add `user_id` column to `high_scores` (nullable, for logged-in submissions) and join to `player_profiles` where `is_public = true`

**Migration:** Add nullable `user_id` column to `high_scores` table. Update `submit-score` edge function to accept and store `user_id` when provided.

---

### 7. Legal Pages

- New page: `src/pages/PrivacyPolicy.tsx` at route `/privacy`
- New page: `src/pages/TermsOfService.tsx` at route `/terms`
- Both styled in the retro game aesthetic
- Content covers all requested points (data collected, storage, deletion, age requirements, liability, etc.)
- Links added to Auth page footer and Home page footer

---

### 8. Route Updates (`src/App.tsx`)

Add routes:
- `/reset-password` → ResetPassword
- `/player/:username` → PublicProfile
- `/privacy` → PrivacyPolicy
- `/terms` → TermsOfService

---

### 9. File Summary

| File | Action |
|------|--------|
| Migration SQL | Add `username`, `initials`, `is_public`, `bio` to `player_profiles`; add `user_id` to `high_scores`; update trigger; add RLS for public profiles |
| `src/pages/Auth.tsx` | Add username/initials fields, password strength, forgot password, resend verification, legal links |
| `src/pages/Profile.tsx` | Full revamp: editable fields, public/private toggle, email status |
| `src/pages/ResetPassword.tsx` | New — password reset form |
| `src/pages/PublicProfile.tsx` | New — public player profile view |
| `src/pages/PrivacyPolicy.tsx` | New — privacy policy page |
| `src/pages/TermsOfService.tsx` | New — terms of service page |
| `src/App.tsx` | Add 4 new routes |
| `src/components/HighScoreDisplay.tsx` | Link player names to public profiles |
| `src/pages/Home.tsx` | Link player names to public profiles, add legal footer links |
| `supabase/functions/submit-score/index.ts` | Accept optional `user_id` parameter |
| DB function `handle_new_user()` | Update to set username + initials from metadata |

### 10. Cost Optimization

All changes use existing Supabase Auth (no extra services), minimal edge function calls, and small DB columns. No additional third-party services. Well within $25/month on Lovable Cloud free/starter tier.

