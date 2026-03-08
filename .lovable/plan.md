

## Plan: Add Stereo VU/DB Meters to Left Side Panel

### Summary

Replace the decorative panel elements in the left side panel with vertical VU meters showing left and right audio channel levels. The meters use green-yellow-red color gradients. They only render when music is playing and the panel is visible (hidden on mobile/fullscreen).

### Audio Analysis

**Problem**: Background music currently plays via plain `HTMLAudioElement` without routing through Web Audio API (only boss music uses an AnalyserNode). We need stereo analysis for L/R channels.

**Solution**: Add a `ChannelSplitter` + two `AnalyserNode`s to `SoundManager`:
- When background music starts playing, connect the audio element through `createMediaElementSource` → `createChannelSplitter(2)` → two separate `AnalyserNode`s (left/right)
- Expose `getLeftLevel(): number` and `getRightLevel(): number` methods (0-1 normalized RMS from frequency data)
- Apply same pattern for boss music (reuse existing analyser, add stereo split)
- Handle the `MediaElementSource` can-only-be-created-once constraint by tracking connected elements

### Changes

**1. `src/utils/sounds.ts`**
- Add private fields: `leftAnalyser`, `rightAnalyser`, `splitter`, `bgMusicSource`, `connectedElements: WeakSet`
- New private method `connectStereoAnalyser(audioElement)`: creates `MediaElementAudioSource` → `ChannelSplitter(2)` → two `AnalyserNode`s → destination
- Call it from `playBackgroundMusic()` and `playBossMusic()`
- New public methods: `getLeftLevel(): number`, `getRightLevel(): number` — read frequency data from respective analysers, compute average amplitude, return 0-1
- Clean up analysers in `stopBackgroundMusic()` and `stopBossMusic()`

**2. `src/components/VUMeter.tsx`** (new)
- Standalone React component rendering a vertical bar meter
- Props: `level: number` (0-1), `side: "left" | "right"`
- Renders ~12 segments as stacked divs, bottom-to-top: green (0-60%), yellow (60-80%), red (80-100%)
- Lit segments determined by `level` prop
- Uses `useRef` + `requestAnimationFrame` to poll `soundManager.getLeftLevel()`/`getRightLevel()` at ~30fps
- Retro pixel styling matching the metal frame aesthetic

**3. `src/components/Game.tsx`**
- Import `VUMeter`
- Replace the 3 `panel-decoration` divs in `metal-side-panel-left` with two `VUMeter` components (left channel, right channel) displayed side-by-side vertically within the 60px panel

**4. `src/index.css`**
- Minor styling for VU meter segments to fit within the 60px left panel
- Segments use hard-edged retro look (no gradients per the visual aesthetic rules)

### Visibility Rules
- Left panel is already hidden on mobile (`@media max-width: 768px`) and in fullscreen mode — no extra logic needed
- Meters auto-stop polling when panel is hidden via CSS `display: none`

### File Summary

| File | Change |
|------|--------|
| `src/utils/sounds.ts` | Add stereo channel splitter + L/R analysers, expose `getLeftLevel()`/`getRightLevel()` |
| `src/components/VUMeter.tsx` | New component — vertical segmented VU meter with green/yellow/red zones |
| `src/components/Game.tsx` | Replace left panel decorations with two VU meters |
| `src/index.css` | VU meter segment styles |

