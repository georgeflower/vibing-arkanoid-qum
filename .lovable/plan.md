

## Bug Analysis and Fix Plan

### Bug 1: Boss/enemies/shots disappear for ~1 second when hit by cannon bullets

**Root Cause:** The `useBullets` hook has a **duplicate boss damage system** that conflicts with the main physics-based boss hit handling in `checkCollision()`. Both run in the same game tick (line 6568-6569 of Game.tsx):

1. `updateBullets()` — handles bullet-boss collisions and calls `setBoss(prev => ...)` to apply damage, potentially setting boss to `null` if health reaches 0
2. `checkCollision()` → `runPhysicsFrame()` — handles ball-boss collisions and also modifies boss state

The `useBullets.updateBullets` callback (lines 182-240 of useBullets.ts) does its own `setBoss` calls that create new boss objects via spread `{...megaBoss, ...}`. When a regular boss's health drops to 0 from bullet damage, `setBoss` returns `null` (line 231-237), causing the boss to vanish. Even when health doesn't reach 0, the spread-copy replaces `world.boss` with a new object mid-frame, and then `checkCollision()` also reads/modifies `world.boss`, causing state corruption.

Additionally, `useBullets` captures `boss`, `enemies`, and `resurrectedBosses` from its closure parameters — these are read from `world.*` at React render time and can be stale since the component doesn't re-render every frame. The stale `boss` reference is used for collision detection (positions may be outdated).

**Fix:** Refactor `useBullets.updateBullets` to:
- Read `boss`, `enemies`, and `resurrectedBosses` directly from `world.*` instead of using stale closure values (consistent with the engine decoupling pattern)
- For boss bullet hits, instead of calling `setBoss()` directly, push boss hit events to an array (similar to how physics.ts uses `result.bossHits`), and let the existing boss hit handling in `checkCollision`'s result processing (Game.tsx lines 3537-3580) handle all boss damage uniformly
- Alternatively, if keeping separate bullet-boss damage in `useBullets`, ensure it only modifies health in-place on the existing `world.boss` object rather than replacing it with a spread copy

### Bug 2: Render freezes but game loop continues when ball hits Second Chance barrier

**Root Cause:** When the second chance save triggers, the physics engine (physics.ts line 1234-1240) modifies `paddle.hasSecondChance = false` directly on `world.paddle`. Then Game.tsx (line 3974-3979) processes the result:

```typescript
setPaddle((prev) => (prev ? { ...prev, hasSecondChance: false } : null));
setSecondChanceImpact({ x: save.x, y: save.y, startTime: Date.now() });
```

The `setPaddle` call creates a **new paddle object** via spread, replacing `world.paddle`. This new object may lose mutable state that was updated in the same frame by other systems. More critically, `setSecondChanceImpact` is a React `useState` setter, which triggers a React re-render. This re-render causes the `useEffect` at line 1641-1672 to run and sync `renderState.secondChanceImpact`. However, the re-render also causes `checkCollision` to be recreated (because `score` is in its deps and score may have changed), which recreates `gameLoop`, which triggers the game loop `useEffect` (line 6623-6636) to cancel the current RAF and start a new one. This RAF restart can cause a visible frame gap.

The render freeze (render stops but game loop continues) is more specifically caused by: the game loop (`requestAnimationFrame` in Game.tsx) continues running, but the **render loop** (in `renderLoop.ts`) reads from `world` and `renderState`. If `world.paddle` is replaced mid-frame with a spread copy and the paddle's position/state becomes inconsistent, or if `renderState.secondChanceImpact` is not set in time for the render loop to pick it up, the render can appear frozen while the game state continues advancing.

**Fix:**
- Remove the redundant `setPaddle` spread-copy in the second chance handler — the physics engine already set `paddle.hasSecondChance = false` directly on `world.paddle`
- Move `secondChanceImpact` from React state to `renderState` directly (write it in `checkCollision` instead of going through React state), eliminating the React re-render trigger
- Use a timeout via `setTimeout` that writes `renderState.secondChanceImpact = null` after 500ms instead of React state

### Implementation Changes

**File: `src/hooks/useBullets.ts`**
- Replace closure-captured `boss`, `enemies`, `resurrectedBosses` with live reads from `world.boss`, `world.enemies`, `world.resurrectedBosses` at the start of `updateBullets`
- For boss damage: mutate `world.boss.currentHealth` in-place instead of calling `setBoss(prev => ({...prev, ...}))` which replaces the object. Or better, collect bullet-boss hit events and process them through the same boss hit handler in Game.tsx
- Remove `boss`, `resurrectedBosses`, `enemies` from the `useCallback` dependency array (they're now live-read from `world`)

**File: `src/components/Game.tsx`**
- In the Second Chance handler (lines 3973-3979): remove the `setPaddle` call (physics already handled it), and write `secondChanceImpact` directly to `renderState` instead of React state
- Remove `secondChanceImpact` React state entirely, or keep it only as a non-rendering ref for the timeout cleanup
- Remove `secondChanceImpact` from the `useEffect` sync deps (line 1670) since it will be written directly

