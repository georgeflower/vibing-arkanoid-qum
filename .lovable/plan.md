

## Fix: Replace direct screenShake assignment with triggerScreenShake

**File: `src/components/Game.tsx`, line 6434**

Replace:
```typescript
world.screenShake = 12;
```
With:
```typescript
triggerScreenShake(12, 600);
```

Single-line change. This ensures the screen shake decays properly after 600ms instead of persisting indefinitely.

