

## Plan: Change Danger Ball Reflect Sound to Use Reflected Attack Sound with Ascending Pitch

### Problem
Currently `playDangerBallReflectSound()` uses `/reflecting.mp3` (the reflect shield power-up pickup sound). The user wants it to use the same synthesized sound as `playReflectedAttackSound()` (the deflection ping played when a boss shot hits the paddle during reflect shield) — but with the existing ascending pitch sequence (C, D, E, F#, G) applied.

### Change

**File: `src/utils/sounds.ts` (lines 601-609)**

Replace the `playDangerBallReflectSound()` method body to use the synthesized dual-oscillator deflection ping from `playReflectedAttackSound()`, but multiply the base frequencies (900 Hz and 1100 Hz) by the pitch ratio from `dangerBallPitchRatios[dangerBallReflectCount]`. This gives the same ascending C→D→E→F#→G tone progression while using the correct sound effect.

```typescript
playDangerBallReflectSound() {
  if (!this.sfxEnabled) return;
  const ctx = this.getAudioContext();
  const pitchIndex = Math.min(this.dangerBallReflectCount, this.dangerBallPitchRatios.length - 1);
  const rate = this.dangerBallPitchRatios[pitchIndex];

  // Deflection ping 1 (scaled by pitch)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.frequency.value = 900 * rate;
  osc1.type = 'sine';
  gain1.gain.setValueAtTime(0.1, ctx.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.1);

  // Deflection ping 2 (scaled by pitch)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.frequency.value = 1100 * rate;
  osc2.type = 'sine';
  gain2.gain.setValueAtTime(0.15, ctx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  osc2.start(ctx.currentTime);
  osc2.stop(ctx.currentTime + 0.15);

  this.dangerBallReflectCount++;
}
```

No other files need changes.

