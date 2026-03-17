

## Integrate PostHog Analytics

The PostHog API key (`phc_U2c67Ff4NhXw0u9w5zcFQHWj3ijas9TJB776hzqCDaj`) is a publishable client-side key, safe to embed in code.

### Changes

#### 1. Install `posthog-js` package

#### 2. Create `src/lib/posthog.ts`
Initialize PostHog with:
- `api_host`: `https://eu.i.posthog.com`
- `capture_pageview`: `false` (manual SPA tracking)
- `capture_pageleave`: `true` (auto time-on-page)
- `autocapture`: `true`

#### 3. Edit `src/App.tsx`
- Wrap app in `PostHogProvider`
- Add `PostHogPageviewTracker` component inside `BrowserRouter` that calls `posthog.capture('$pageview')` on route changes via `useLocation`

#### 4. Edit `src/components/Game.tsx`
Track custom events:
- `game_started` — with difficulty, mode, start level
- `game_ended` — with score, level reached, duration

### Result
PostHog dashboard will show time on `/play`, bounce rate, user flows, and game session metrics.

