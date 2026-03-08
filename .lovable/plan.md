

## Plan: Fix Past Challenges to Only Show Today and Earlier

The archive currently generates 90 days of challenges starting from today going backward — which is correct. The loop starts at `i = 0` (today) and goes to `i = 89` (89 days ago). This means it already shouldn't show future dates.

However, the issue is that **today's challenge appears in the archive** and can be "replayed" from there. The fix is:

### Changes

**`src/components/DailyChallengeArchive.tsx`**
- Change the loop to start at `i = 1` instead of `i = 0`, so only **yesterday and earlier** appear in the past challenges list (today's challenge is already shown in the main `DailyChallengeOverlay`)
- Update the header text from "Last 90 days" to "Yesterday and earlier" or similar
- Update the "Back" button label to "Back to Today's Challenge"

This is a 1-line fix (changing `i = 0` to `i = 1`) plus minor label updates.

