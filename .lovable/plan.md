

## Plan: Limit Daily Challenge Archive to Launch Date

The archive currently generates 90 days of history regardless of when the feature launched. Since today (2026-03-08) is the first challenge, the archive should be empty today, show 1 entry tomorrow, 2 on Tuesday, etc.

### Changes

**`src/components/DailyChallengeArchive.tsx`**
- Add a `LAUNCH_DATE` constant set to `2026-03-08`
- Change the loop from a fixed 90-day lookback to: iterate from yesterday back to `LAUNCH_DATE` (inclusive)
- If no entries exist yet (today is launch day), show an "No past challenges yet — come back tomorrow!" message

This is a small change to the loop logic (~5 lines).

