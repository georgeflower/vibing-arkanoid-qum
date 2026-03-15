

## Fix: Daily Challenge Boss Never Appears

### Root Cause

In `startGame()` (Game.tsx), `initBricksForLevel(startLevel)` is called at **line 2438**, which correctly spawns the boss via `setBoss({...newBoss})`. However, later at **line 2480-2484**, the code clears boss state with `setBoss(null)` because `BOSS_LEVELS.includes(startLevel)` is false (daily challenge level is 21+). This overwrites the boss that was just created.

The fix is simple: the boss-clearing block needs to also check for daily challenge boss mode.

### Changes

**`src/components/Game.tsx`** — line 2479-2486:

Change the condition from:
```typescript
if (!BOSS_LEVELS.includes(startLevel)) {
```
to:
```typescript
const isDailyBoss = isDailyChallenge && settings.dailyChallengeConfig?.isBossChallenge;
if (!BOSS_LEVELS.includes(startLevel) && !isDailyBoss) {
```

This prevents the boss state from being cleared after `initBricksForLevel` already spawned the daily challenge boss.

Additionally, the same issue likely exists in the retry handler (line 8022). Apply the same fix there:
```typescript
if (!BOSS_LEVELS.includes(currentLevel) && !isDailyBoss) {
```
where `isDailyBoss` uses the same check.

