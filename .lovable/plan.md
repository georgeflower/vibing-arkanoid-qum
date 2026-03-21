

## Fix: iPhone Game Canvas Not Centered (Shifted Right)

### Problem
On iPhone, the game canvas is shifted slightly to the right, cutting off the rightmost edge. This happens because the CSS uses `100vw` for widths in fullscreen mode, which on iOS Safari can exceed the actual visible area (it includes the scrollbar gutter width and doesn't account for safe area insets consistently).

### Root Cause
The `mobile-fullscreen-mode` CSS and `ios-fullscreen-container` CSS use `width: 100vw` extensively. On iOS Safari, `100vw` = full viewport width including any invisible scrollbar gutter, which can be slightly wider than the visible area. This creates a subtle horizontal overflow that shifts content rightward.

### Fix

**`src/index.css`** — Replace `100vw` with `100%` in mobile/iOS fullscreen rules:

1. `.ios-fullscreen-container` (line ~616): Change `width: 100vw` to `width: 100%`
2. `.metal-frame.mobile-fullscreen-mode` (line ~556-558): Change `width: 100vw; max-width: 100vw` to `width: 100%; max-width: 100%`
3. `.metal-frame.mobile-fullscreen-mode .metal-main-content` (line ~578): Change `width: 100vw` to `width: 100%`
4. `.metal-frame.mobile-fullscreen-mode .metal-game-area` (line ~590-591): Change `max-width: 100vw; width: 100vw` to `max-width: 100%; width: 100%`
5. `.metal-frame.mobile-fullscreen-mode .game-glow` (line ~597): Change `width: 100vw` to `width: 100%`
6. `.metal-frame.mobile-fullscreen-mode .game-glow canvas` (lines ~603-606): Change `max-width: 100vw; width: 100vw` to `max-width: 100%; width: 100%`
7. Keep `100dvh` for height values since vertical viewport height is reliable

Also add `overflow: hidden` to `.metal-frame.mobile-fullscreen-mode` as a safety net against any residual horizontal overflow.

### Why `100%` instead of `100vw`
- `100%` = width of the parent container (which is already correctly sized to the visible area)
- `100vw` = full viewport width including invisible scrollbar gutter — problematic on iOS Safari
- Since the parent chain (`ios-fullscreen-container` → `metal-frame`) is already `position: fixed` with `left: 0; right: 0`, `100%` gives the correct visible width

