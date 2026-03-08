

## Plan: Explosive Bricks Kill Enemies + Star Enemy 1-Hit Kill + Reduced Spawn Rate

### Changes

**1. `src/engine/physics.ts`** — Explosive bricks kill nearby enemies (~line 1156-1180):
After the existing "destroy nearby bricks" loop, add a second loop over `enemies` that checks distance to the explosion center. Any enemy within the 70px radius gets marked for destruction (add to `enemiesToDestroy`), awards points, creates explosion, drops bonus letter, and plays sound — same as a ball-hit kill.

**2. `src/engine/physics.ts`** — Star enemy 1-hit kill (~line 944-987):
Remove the 2-hit logic. Replace with immediate destruction (like cube enemy): `enemiesToDestroy.add(enemyIndex)`, award 150 points, create explosion. Remove the `currentHits === 0` angry branch entirely.

**3. `src/components/Game.tsx`** — Reduce star spawn probability (~line 7046):
Change `Math.random() < 0.3` → `Math.random() < 0.15` (15% chance instead of 30%) for star enemy spawns on star levels.

**4. `src/constants/version.ts`** — Bump version and add changelog entries:
- Explosive bricks now destroy nearby enemies within blast radius
- Star enemies now die in 1 hit (reduced from 2)
- Star enemies spawn less frequently

**5. Documentation updates** — `README.md`, `src/pages/Home.tsx`, `src/components/MainMenu.tsx`:
Update star enemy descriptions to say "1 hit" and mention explosive brick enemy-killing.

| File | Change |
|------|--------|
| `src/engine/physics.ts` | Add enemy kill loop in explosive detonation; star = 1-hit kill |
| `src/components/Game.tsx` | Star spawn chance 0.3 → 0.15 |
| `src/constants/version.ts` | Version bump + changelog |
| `README.md` | Update star/explosive descriptions |
| `src/pages/Home.tsx` | Update star/explosive descriptions |
| `src/components/MainMenu.tsx` | Update star description in instructions |

