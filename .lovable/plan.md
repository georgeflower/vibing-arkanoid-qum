

## Fix: Daily Challenge Retry + Mobile Scrolling

### Issue 1: Retry Button Doesn't Restart the Level

The `onRetry` handler in `DailyChallengeResultOverlay` (Game.tsx line 8535-8546) only clears overlay state and sets `gameState("ready")` — it doesn't reinitialize bricks, paddle, ball, timer, or any world state. The level appears empty/broken.

**Fix**: Replace the inline retry handler with a call to the existing `handleRetryLevel()` function, which already handles full game state reset including daily challenge mode. Add the daily-challenge-specific resets (clearing result/timedOut flags) before calling it.

**File: `src/components/Game.tsx` (~line 8535)**
```typescript
onRetry={() => {
  setShowDailyChallengeResult(false);
  setDailyChallengeResult(null);
  setDailyChallengeTimedOut(false);
  dailyChallengeLivesLostRef.current = 0;
  dailyChallengePowerUpsRef.current = 0;
  handleRetryLevel();
}}
```

### Issue 2: Daily Challenge Menu Not Scrollable on Mobile

The `DailyChallengeOverlay` (line 62) uses `overflow-hidden` on the outer container and the `Card` has no scroll mechanism. On small screens, content overflows and buttons are cut off.

**Fix in `src/components/DailyChallengeOverlay.tsx`:**
- Change outer div from `overflow-hidden` to `overflow-y-auto`
- Add `max-h-[90vh] overflow-y-auto` to the Card so content scrolls within it on small viewports

