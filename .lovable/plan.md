

# Why a Full Rebuild Isn't the Right Move

This game has **~15,000+ lines** of battle-tested logic across 80+ files covering CCD physics, boss AI (4 types + mega boss), 20 level layouts, 13+ power-ups, object pooling, adaptive quality, high scores, Boss Rush mode, particles, sound, mobile controls, PWA, and tutorials.

A from-scratch rewrite would:
- Take weeks of iterative sessions to reach feature parity
- Reintroduce bugs already solved (paddle tunneling, cube boss CCD, high-refresh-rate glitches)
- Lose all the edge-case handling built up over time

The architecture is already solid — the engine decoupling (world singleton, render loop, physics separation) follows exactly the patterns you'd want from the start. The main areas that could benefit from cleanup are **Game.tsx** (still too large) and some legacy shim patterns.

## Recommended Alternative: Targeted Refactoring

Instead of rebuilding, I'd suggest a focused cleanup plan:

1. **Split Game.tsx** — Extract handler groups (death/boss/level transitions, input, power-up timers) into dedicated modules under `src/engine/` or `src/game/`
2. **Remove legacy shims** — Clean up any remaining `useState`-to-`world` compatibility wrappers that are no longer needed
3. **Consolidate constants** — Merge scattered config files into a cleaner structure
4. **Clean up unused code** — Remove dead imports, unused components, and orphaned utilities

This preserves all working gameplay while achieving the "clean from the start" feel. Each step is safe and testable.

Want me to plan one of these refactoring steps instead?

