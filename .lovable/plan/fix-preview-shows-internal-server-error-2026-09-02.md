# Fix: preview shows "internal server error"

## Diagnosis so far (verified)
- Build is clean (`build-errors.log`: latest entry "build OK", no TS/Vite errors).
- Vite dev server is running and healthy: `localhost:8080` and `/play` both return 200, Playwright loads the home page and game with zero console/network errors.
- Backend functions show zero invocations and zero 5xx in the last 24h; database logs show only a benign idle-connection reset.
- Published site `vibing-arkanoid.lovable.app` returns 200.

Conclusion: the app itself is not erroring. The "internal server error" is coming from the preview delivery layer (a stale/broken dev-server session between the browser and the sandbox), which a dev-server restart clears.

## Plan
1. Restart the Vite dev server (kill process; the supervisor auto-respawns it) and wait until `localhost:8080` answers 200 again.
2. Re-verify the preview loads cleanly via Playwright (home page and `/play`), capturing console and network errors.
3. If the preview still errors after the restart, escalate: check for a HMR-websocket/transform failure in the Vite logs and report that it is a platform-side preview issue rather than app code.

## Note (separate observation, no action unless you want it)
- Your browser is currently on route `/index`, which is not a real route in this app (the game lives at `/play`). It renders the 404 page — harmless, but use `/play` for the game.

## Technical details
- Restart via `kill -9` on the vite process; poll `curl -sf http://localhost:8080/` until ready.
- No source code changes are part of this plan.
