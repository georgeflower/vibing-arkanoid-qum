

## Plan: Fix Turret Bullet Damage to Mega Boss

### Problem
In `src/components/Game.tsx` lines 6413-6462, the `pendingBulletBossHits` processing simply reduces `boss.currentHealth` directly. For the Mega Boss, actual HP lives in `outerShieldHP` / `innerShieldHP`, so reducing `currentHealth` alone has no gameplay effect — no shield is damaged, no core exposure is triggered.

### Fix
Add a Mega Boss branch inside the `if (!hit.isResurrected)` block (line 6416), mirroring the ball-hit handler at lines 3380-3417:

**File: `src/components/Game.tsx` (~line 6416)**

Before the existing `boss.currentHealth = Math.max(0, ...)` line, add:

```
if (isMegaBoss(boss)) {
  const megaBoss = boss as MegaBoss;
  if (megaBoss.coreExposed || megaBoss.trappedBall) continue;

  const { newOuterHP, newInnerHP, shouldExposeCore } = handleMegaBossOuterDamage(megaBoss, hit.damage);
  megaBoss.outerShieldHP = newOuterHP;
  megaBoss.innerShieldHP = newInnerHP;

  const activeShieldHP = megaBoss.outerShieldRemoved ? newInnerHP : newOuterHP;
  megaBoss.currentHealth = activeShieldHP;
  megaBoss.lastHitAt = world.simTimeMs;

  if (shouldExposeCore) {
    Object.assign(megaBoss, exposeMegaBossCore(megaBoss));
    megaBoss.currentHealth = 0;
    world.screenShake = 12;
    soundManager.playExplosion();
  }

  soundManager.playBossHitSound();
  continue; // skip generic health reduction
}
```

This ensures turret bullets properly reduce shield HP and trigger core exposure, identical to ball hits. The `continue` skips the generic `currentHealth` reduction below.

No other files need changes — the bullet collision detection in `useBullets.ts` already correctly generates hit events for the mega boss.

