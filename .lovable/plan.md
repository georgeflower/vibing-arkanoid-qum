

## Fix: Distinguish "Died" vs "Timed Out" in Daily Challenge Result

### Problem
When a player dies (loses all lives) during a timed daily challenge, the result overlay shows "⏰ TIME'S UP ⏰" because `dailyChallengeTimedOut` is reused for both timeout and death scenarios.

### Solution
Add a separate `dailyChallengeFailed` state to track death, keep `dailyChallengeTimedOut` only for actual timeouts. Pass both to the overlay.

### Changes

**`src/components/Game.tsx`:**
- Add new state: `const [dailyChallengeFailed, setDailyChallengeFailed] = useState(false)`
- Line 1873: Change `setDailyChallengeTimedOut(true)` → `setDailyChallengeFailed(true)` (death case)
- Line 7872: Update submission guard to `if (dailyChallengeTimedOut || dailyChallengeFailed) return;`
- Line 7894: Update auto-submit check to include `!dailyChallengeFailed`
- Pass `failed={dailyChallengeFailed}` to `DailyChallengeResultOverlay`
- Reset `dailyChallengeFailed` in retry handler alongside other resets

**`src/components/DailyChallengeResultOverlay.tsx`:**
- Add `failed?: boolean` prop
- Line 91: Change header logic: `timedOut ? "⏰ TIME'S UP ⏰" : failed ? "💀 CHALLENGE FAILED 💀" : ...`
- Line 94-99: Show failure message when `failed`: "Challenge failed — you lost all lives!"
- Update red styling conditions: `(timedOut || failed)` for border/shadow/color
- Show retry button when `failed` (already covered by `!result.allObjectivesMet`)
- Hide objectives when `failed` (same as `timedOut`)

