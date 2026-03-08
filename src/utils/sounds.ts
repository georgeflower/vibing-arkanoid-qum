// Simple sound effects using Web Audio API
class SoundManager {
  private audioContext: AudioContext | null = null;
  private musicTracks: HTMLAudioElement[] = [];
  private currentTrackIndex = 0;
  private highScoreMusic: HTMLAudioElement | null = null;
  private bossMusic: HTMLAudioElement | null = null;
  private savedBackgroundMusicPosition: number = 0;
  private savedBackgroundMusicIndex: number = 0;
  private musicEnabled = true;
  private sfxEnabled = true;
  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private bossMusicSource: MediaElementAudioSourceNode | null = null;
  private frequencyDataArray: Float64Array | null = null;

  // Stereo VU meter analysers
  private leftAnalyser: AnalyserNode | null = null;
  private rightAnalyser: AnalyserNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private connectedElements: WeakSet<HTMLAudioElement> = new WeakSet();
  private stereoSource: MediaElementAudioSourceNode | null = null;
  private trackUrls = [
    '/Pixel_Frenzy-2.mp3',
    '/sound_2.mp3',
    '/level_3.mp3',
    '/level_4.mp3',
    '/level_5.mp3',
    '/level_7.mp3',
    '/Turrican.mp3',
    '/Flubber_Happy_Moderate_Amiga.mp3',
    '/leve_boss_chip_atari.mp3',
    '/level_cave_c64.mp3',
    '/level_cave_2_c64.mp3',
    '/level_cave_chip_atari.mp3',
    '/level_cave_chip_atari_2.mp3',
    '/level_dessert_chip_atari_2.mp3',
    '/level_dessert_chip_atari_2_2.mp3'
  ];

  private getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  playBackgroundMusic(level: number = 1) {
    if (!this.musicEnabled) return;

    // Stop all currently playing tracks first
    this.musicTracks.forEach((track, index) => {
      if (track && !track.paused) {
        track.pause();
        track.currentTime = 0;
      }
    });

    // Initialize track if not already loaded
    if (!this.musicTracks[this.currentTrackIndex]) {
      const audio = new Audio(this.trackUrls[this.currentTrackIndex]);
      audio.volume = 0.3;
      audio.addEventListener('ended', () => this.handleTrackEnd());
      this.musicTracks[this.currentTrackIndex] = audio;
    }

    // Connect stereo analyser for VU meters
    const currentAudio = this.musicTracks[this.currentTrackIndex];
    if (currentAudio) {
      this.connectStereoAnalyser(currentAudio);
      currentAudio.play().catch(() => {});
    }
  }

  private handleTrackEnd() {
    // Move to next track in sequence
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.trackUrls.length;
    
    // Play next song immediately if music is enabled
    if (this.musicEnabled) {
      this.playBackgroundMusic();
    }
  }

  initializeRandomTrack() {
    // Only used at game start to pick random first track
    this.currentTrackIndex = Math.floor(Math.random() * this.trackUrls.length);
  }

  pauseBackgroundMusic() {
    this.musicTracks.forEach(track => track?.pause());
  }

  stopBackgroundMusic() {
    this.musicTracks.forEach(track => {
      if (track) {
        track.pause();
        track.currentTime = 0;
      }
    });
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopBackgroundMusic();
    }
  }

  getMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
  }

  getSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  setCurrentTrack(trackIndex: number) {
    const wasPlaying = this.musicTracks[this.currentTrackIndex] && 
                       !this.musicTracks[this.currentTrackIndex].paused;
    
    this.stopBackgroundMusic();
    this.currentTrackIndex = trackIndex;
    
    if (wasPlaying && this.musicEnabled) {
      this.playBackgroundMusic();
    }
  }

  getCurrentTrackIndex(): number {
    return this.currentTrackIndex;
  }

  getTrackNames(): string[] {
    return [
      'Pixel Frenzy',
      'Sound 2',
      'Level 3',
      'Level 4',
      'Level 5',
      'Level 7',
      'Turrican',
      'Turrican 2',
      'Flubber Happy',
      'Boss Chip Atari',
      'Cave C64',
      'Cave 2 C64',
      'Cave Chip Atari',
      'Cave Chip Atari 2',
      'Desert Chip Atari 2',
      'Desert Chip Atari 2-2'
    ];
  }

  playHighScoreMusic() {
    this.stopBackgroundMusic(); // Stop game music
    if (!this.highScoreMusic) {
      this.highScoreMusic = new Audio('/High_score.mp3');
      this.highScoreMusic.loop = true;
      this.highScoreMusic.volume = 0.4;
    }
    this.highScoreMusic.play().catch(() => {});
  }

  stopHighScoreMusic() {
    if (this.highScoreMusic) {
      this.highScoreMusic.pause();
      this.highScoreMusic.currentTime = 0;
    }
  }

  playBounce() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 200;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }

  playDangerBallCatch() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Heavy low thud -- square wave at 100Hz
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.type = 'square';
    thud.frequency.setValueAtTime(100, ctx.currentTime);
    thud.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.2);
    thudGain.gain.setValueAtTime(0.35, ctx.currentTime);
    thudGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    thud.start(ctx.currentTime);
    thud.stop(ctx.currentTime + 0.25);
    
    // Distorted sawtooth sweep 300Hz -> 80Hz
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(300, ctx.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
    sweepGain.gain.setValueAtTime(0.2, ctx.currentTime);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    sweep.start(ctx.currentTime);
    sweep.stop(ctx.currentTime + 0.2);
  }

  playDangerBallSpawn() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Short sine ping at ~800Hz -- subtle, higher-pitched blip
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.connect(pingGain);
    pingGain.connect(ctx.destination);
    ping.type = 'sine';
    ping.frequency.setValueAtTime(800, ctx.currentTime);
    ping.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
    pingGain.gain.setValueAtTime(0.08, ctx.currentTime);
    pingGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    ping.start(ctx.currentTime);
    ping.stop(ctx.currentTime + 0.1);
    
    // Tiny triangle chirp at ~1200Hz -- quick accent
    const chirp = ctx.createOscillator();
    const chirpGain = ctx.createGain();
    chirp.connect(chirpGain);
    chirpGain.connect(ctx.destination);
    chirp.type = 'triangle';
    chirp.frequency.setValueAtTime(1200, ctx.currentTime + 0.02);
    chirp.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.07);
    chirpGain.gain.setValueAtTime(0.1, ctx.currentTime + 0.02);
    chirpGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.07);
    chirp.start(ctx.currentTime + 0.02);
    chirp.stop(ctx.currentTime + 0.08);
  }

  playBrickHit(brickType?: string, hitsRemaining?: number) {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Progressive sound effects for cracked bricks
    if (brickType === "cracked" && hitsRemaining !== undefined) {
      if (hitsRemaining === 3) {
        // First hit - lower pitch, deep crack
        oscillator.frequency.value = 500;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.04);
      } else if (hitsRemaining === 2) {
        // Medium crack - mid pitch, slightly longer
        oscillator.frequency.value = 700;
        oscillator.type = 'triangle';
        gainNode.gain.setValueAtTime(0.10, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.06);
      } else if (hitsRemaining === 1) {
        // Final hit - play glass breaking sound
        this.playCrackedBrickBreakSound();
        return;
      }
    } else {
      // Default brick hit sound
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.092, ctx.currentTime); // +15%
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.05);
    }
  }

  playPowerUp() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  }

  playShoot() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }

  playLoseLife() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(400, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  }

  playWin() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    [0, 0.1, 0.2, 0.3].forEach((time, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const freq = [262, 330, 392, 523][i]; // C, E, G, C
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime + time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3);

      oscillator.start(ctx.currentTime + time);
      oscillator.stop(ctx.currentTime + time + 0.3);
    });
  }

  playPhaseCompleteJingle() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Triumphant ascending fanfare
    const notes = [
      { freq: 392, time: 0, duration: 0.15 },      // G4
      { freq: 494, time: 0.12, duration: 0.15 },   // B4
      { freq: 587, time: 0.24, duration: 0.15 },   // D5
      { freq: 784, time: 0.36, duration: 0.35 },   // G5 (held)
      { freq: 659, time: 0.5, duration: 0.2 },     // E5
      { freq: 784, time: 0.65, duration: 0.4 },    // G5 (final, longer)
    ];
    
    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, ctx.currentTime + time);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + time + 0.03);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + time + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
      
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    });
    
    // Add a harmonic layer for richness
    [0, 0.36].forEach((time, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.value = i === 0 ? 196 : 392; // G3, G4 bass notes
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.4);
      
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 0.4);
    });
  }

  playExplosion() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    // Low rumble explosion sound
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(150, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
    oscillator.type = 'sawtooth';
    
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    
    gainNode.gain.setValueAtTime(0.1056, ctx.currentTime); // +20%
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  }

  playExplosiveBrickSound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Dramatic multi-layered explosion sound
    // Layer 1: Deep bass rumble
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(80, ctx.currentTime);
    bass.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.6);
    bassGain.gain.setValueAtTime(0.25, ctx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 0.6);
    
    // Layer 2: Mid-range crack
    const mid = ctx.createOscillator();
    const midGain = ctx.createGain();
    mid.connect(midGain);
    midGain.connect(ctx.destination);
    mid.type = 'square';
    mid.frequency.setValueAtTime(300, ctx.currentTime);
    mid.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
    midGain.gain.setValueAtTime(0.15, ctx.currentTime);
    midGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    mid.start(ctx.currentTime);
    mid.stop(ctx.currentTime + 0.3);
    
    // Layer 3: High sizzle/shrapnel
    const high = ctx.createOscillator();
    const highGain = ctx.createGain();
    const highFilter = ctx.createBiquadFilter();
    high.connect(highFilter);
    highFilter.connect(highGain);
    highGain.connect(ctx.destination);
    high.type = 'sawtooth';
    high.frequency.setValueAtTime(2000, ctx.currentTime);
    high.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
    highFilter.type = 'bandpass';
    highFilter.frequency.value = 1500;
    highGain.gain.setValueAtTime(0.12, ctx.currentTime);
    highGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    high.start(ctx.currentTime);
    high.stop(ctx.currentTime + 0.2);
  }

  // Merge sound effect - magical fusion sound
  playMergeSound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Layer 1: Rising sweep
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(200, ctx.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.25);
    sweepGain.gain.setValueAtTime(0.2, ctx.currentTime);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    sweep.start(ctx.currentTime);
    sweep.stop(ctx.currentTime + 0.3);
    
    // Layer 2: Sparkle/shimmer effect
    const sparkle = ctx.createOscillator();
    const sparkleGain = ctx.createGain();
    sparkle.connect(sparkleGain);
    sparkleGain.connect(ctx.destination);
    sparkle.type = 'triangle';
    sparkle.frequency.setValueAtTime(1200, ctx.currentTime);
    sparkle.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
    sparkleGain.gain.setValueAtTime(0.15, ctx.currentTime);
    sparkleGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    sparkle.start(ctx.currentTime + 0.05);
    sparkle.stop(ctx.currentTime + 0.25);
    
    // Layer 3: Bass impact
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(100, ctx.currentTime);
    bass.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
    bassGain.gain.setValueAtTime(0.18, ctx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 0.15);
  }

  // Power-up specific sounds
  // AudioBuffer cache for preloaded sounds
  private audioBuffers: { [key: string]: AudioBuffer } = {};
  private soundsLoaded = false;

  private soundUrls = [
    '/multiball.mp3',
    '/turrets.mp3',
    '/fireball.mp3',
    '/extra_life.mp3',
    '/slower.mp3',
    '/wider.mp3',
    '/smaller.mp3',
    '/shield.mp3',
    '/barrier.mp3',
    '/cannon_mode.mp3',
    '/stun.mp3',
    '/reflecting.mp3',
    '/magnet.mp3',
    '/ball_missed.mp3'
  ];

  async preloadSounds(): Promise<void> {
    if (this.soundsLoaded) return;

    const ctx = this.getAudioContext();
    
    try {
      const loadPromises = this.soundUrls.map(async (url) => {
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          this.audioBuffers[url] = audioBuffer;
        } catch (err) {
          console.warn(`Failed to load sound ${url}:`, err);
        }
      });

      await Promise.all(loadPromises);
      this.soundsLoaded = true;
    } catch (err) {
      // Silent fail for sound preloading - not critical
    }
  }

  // Danger ball reflect pitch tracking
  private dangerBallReflectCount = 0;

  // C-D-E-F#-G pitch ratios (one note per ball)
  private dangerBallPitchRatios = [1.0, 1.125, 1.25, 1.406, 1.5];

  resetDangerBallReflectCount() {
    this.dangerBallReflectCount = 0;
  }

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

  private playAudioBuffer(buffer: AudioBuffer, volume: number, playbackRate: number = 1.0): void {
    if (!buffer) return;

    const ctx = this.getAudioContext();
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Apply 20% volume boost for power-up sounds
    gainNode.gain.value = volume * 1.2;

    source.start(0);
  }

  playMultiballSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/multiball.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playTurretsSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/turrets.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playFireballSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/fireball.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playCrackedBrickBreakSound() {
    // Empty - handled by main brick hit sound
  }

  playCannonModeSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/cannon_mode.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.7);
    }
  }

  playFailureSound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Dramatic failure sound - descending tones with distortion
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    
    // Descending chromatic notes
    osc1.frequency.setValueAtTime(400, ctx.currentTime);
    osc1.frequency.setValueAtTime(350, ctx.currentTime + 0.15);
    osc1.frequency.setValueAtTime(300, ctx.currentTime + 0.3);
    osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.6);
    
    osc2.frequency.setValueAtTime(200, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.6);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.6);
    
    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.6);
    osc2.stop(ctx.currentTime + 0.6);
  }

  playBombDropSound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Pew sound - quick descending pitch
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }

  playLaserChargingSound() {
    if (!this.sfxEnabled) return;
    
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(100, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.8);
    
    gainNode.gain.setValueAtTime(0.075, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.125, ctx.currentTime + 0.4);
    gainNode.gain.linearRampToValueAtTime(0.005, ctx.currentTime + 0.8);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
  }

  playSuperAttackChargingSound() {
    if (!this.sfxEnabled) return;
    
    const ctx = this.getAudioContext();
    
    // Ominous pulsing buildup with multiple harmonics - distinct from laser
    // Layer 1: Deep pulsing bass (reduced volume)
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.type = 'sine';
    bass.frequency.setValueAtTime(60, ctx.currentTime);
    bass.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.8);
    bassGain.gain.setValueAtTime(0.06, ctx.currentTime);
    bassGain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.6);
    bassGain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.9);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 0.9);
    
    // Layer 2: Rising siren sweep (reduced volume)
    const siren = ctx.createOscillator();
    const sirenGain = ctx.createGain();
    siren.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    siren.type = 'square';
    siren.frequency.setValueAtTime(200, ctx.currentTime);
    siren.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.7);
    sirenGain.gain.setValueAtTime(0.02, ctx.currentTime);
    sirenGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.5);
    sirenGain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    siren.start(ctx.currentTime);
    siren.stop(ctx.currentTime + 0.8);
    
    // Layer 3: High frequency danger tone (reduced volume)
    const high = ctx.createOscillator();
    const highGain = ctx.createGain();
    const highFilter = ctx.createBiquadFilter();
    high.connect(highFilter);
    highFilter.connect(highGain);
    highGain.connect(ctx.destination);
    high.type = 'triangle';
    high.frequency.setValueAtTime(800, ctx.currentTime);
    high.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.6);
    highFilter.type = 'bandpass';
    highFilter.frequency.value = 1200;
    highGain.gain.setValueAtTime(0.03, ctx.currentTime + 0.2);
    highGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.5);
    highGain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.75);
    high.start(ctx.currentTime + 0.2);
    high.stop(ctx.currentTime + 0.75);
  }

  // EMP pulse activation - electrical/disabling sound
  playEMPPulseSound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Electric discharge burst
    const discharge = ctx.createOscillator();
    const dischargeGain = ctx.createGain();
    const dischargeFilter = ctx.createBiquadFilter();
    discharge.connect(dischargeFilter);
    dischargeFilter.connect(dischargeGain);
    dischargeGain.connect(ctx.destination);
    discharge.type = 'sawtooth';
    discharge.frequency.setValueAtTime(2000, ctx.currentTime);
    discharge.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    dischargeFilter.type = 'bandpass';
    dischargeFilter.frequency.setValueAtTime(1500, ctx.currentTime);
    dischargeFilter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
    dischargeGain.gain.setValueAtTime(0.2, ctx.currentTime);
    dischargeGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    discharge.start(ctx.currentTime);
    discharge.stop(ctx.currentTime + 0.3);
    
    // Low humming shutdown
    const hum = ctx.createOscillator();
    const humGain = ctx.createGain();
    hum.connect(humGain);
    humGain.connect(ctx.destination);
    hum.type = 'sine';
    hum.frequency.setValueAtTime(120, ctx.currentTime);
    hum.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
    humGain.gain.setValueAtTime(0.15, ctx.currentTime);
    humGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    hum.start(ctx.currentTime);
    hum.stop(ctx.currentTime + 0.5);
    
    // Crackling electrical bursts
    [0, 0.08, 0.15, 0.22].forEach((delay) => {
      setTimeout(() => {
        const crackle = ctx.createOscillator();
        const crackleGain = ctx.createGain();
        crackle.connect(crackleGain);
        crackleGain.connect(ctx.destination);
        crackle.type = 'square';
        crackle.frequency.setValueAtTime(800 + Math.random() * 600, ctx.currentTime);
        crackle.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.05);
        crackleGain.gain.setValueAtTime(0.08, ctx.currentTime);
        crackleGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        crackle.start(ctx.currentTime);
        crackle.stop(ctx.currentTime + 0.05);
      }, delay * 1000);
    });
  }

  playBossHitSound() {
    if (!this.sfxEnabled) return;
    
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.224, ctx.currentTime); // 0.32 * 0.7 (30% reduction)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  }

  playBossDefeatSound() {
    if (!this.sfxEnabled) return;
    
    const ctx = this.getAudioContext();
    
    // Multiple oscillators for dramatic effect
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400 - i * 100, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      }, i * 100);
    }
  }

  playBossPhaseTransitionSound() {
    if (!this.sfxEnabled) return;
    
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  }

  playBossIntroSound() {
    if (!this.sfxEnabled) return;
    
    // Duck music volume by 80% during boss intro
    const originalVolumes: number[] = [];
    this.musicTracks.forEach((track, index) => {
      if (track) {
        originalVolumes[index] = track.volume;
        track.volume = track.volume * 0.2; // Reduce to 20%
      }
    });
    
    const audio = new Audio('/siren-alarm-boss.ogg');
    audio.volume = 0.7;
    
    // Restore music volume after boss intro sound ends
    audio.addEventListener('ended', () => {
      this.musicTracks.forEach((track, index) => {
        if (track && originalVolumes[index] !== undefined) {
          track.volume = originalVolumes[index];
        }
      });
    });
    
    audio.play().catch(err => console.log('Boss intro sound failed:', err));
  }

  playPyramidBulletSound() {
    if (!this.sfxEnabled) return;
    const audioContext = this.getAudioContext();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Swooshing pew sound - sweep from high to mid with wave modulation
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  }

  playExtraLifeSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/extra_life.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playSlowerSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/slower.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playWiderSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/wider.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playShrinkSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/smaller.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playShieldSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/shield.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playBonusLetterPickup() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Brilliant sparkle sound with multiple harmonics
    [0, 0.05, 0.1].forEach((time, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const freq = [800, 1200, 1600][i];
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time);
      oscillator.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + time + 0.2);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime + time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.2);

      oscillator.start(ctx.currentTime + time);
      oscillator.stop(ctx.currentTime + time + 0.2);
    });
  }

  playBonusComplete() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    // Grand triumphant fanfare with rich harmonics
    const melody = [
      { time: 0, freq: 523 },     // C5
      { time: 0.12, freq: 659 },  // E5
      { time: 0.24, freq: 784 },  // G5
      { time: 0.36, freq: 1047 }, // C6
      { time: 0.48, freq: 1319 }, // E6
      { time: 0.6, freq: 1568 },  // G6
      { time: 0.72, freq: 2093 }, // C7
    ];

    melody.forEach(({ time, freq }) => {
      // Main note
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.35, ctx.currentTime + time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.5);
      oscillator.start(ctx.currentTime + time);
      oscillator.stop(ctx.currentTime + time + 0.5);

      // Harmonic (octave)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = freq * 2;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + time);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.5);
      osc2.start(ctx.currentTime + time);
      osc2.stop(ctx.currentTime + time + 0.5);
    });
  }

  isMusicPlaying(): boolean {
    return this.musicTracks.some(track => track && !track.paused && track.currentTime > 0);
  }

  nextTrack() {
    this.stopBackgroundMusic();
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.trackUrls.length;
    
    if (this.musicEnabled) {
      this.playBackgroundMusic();
    }
  }

  previousTrack() {
    this.stopBackgroundMusic();
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.trackUrls.length) % this.trackUrls.length;
    
    if (this.musicEnabled) {
      this.playBackgroundMusic();
    }
  }

  toggleMute() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled) {
      this.pauseBackgroundMusic();
      // Also pause boss music if playing
      if (this.bossMusic) {
        this.bossMusic.pause();
      }
    } else {
      this.playBackgroundMusic();
      // Resume boss music if it exists (was paused mid-boss fight)
      if (this.bossMusic) {
        this.bossMusic.play().catch(() => {});
      }
    }
    return this.musicEnabled;
  }

  // Menu UI sounds
  playMenuClick() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  }

  playMenuHover() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 400;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.04);
  }

  playSliderChange() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 600;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.03);
  }

  playBossMusic(bossLevel: number) {
    if (!this.musicEnabled) return;
    
    // Save current background music state
    const currentTrack = this.musicTracks[this.currentTrackIndex];
    if (currentTrack && !currentTrack.paused) {
      this.savedBackgroundMusicPosition = currentTrack.currentTime;
      this.savedBackgroundMusicIndex = this.currentTrackIndex;
    }
    
    // Pause background music
    this.pauseBackgroundMusic();
    
    // Determine which boss music to play
    let bossTrackUrl = '';
    if (bossLevel === 5) {
      bossTrackUrl = '/Boss_level_cube.mp3';
    } else if (bossLevel === 10) {
      bossTrackUrl = '/Boss_level_sphere.mp3';
    } else if (bossLevel === 15) {
      bossTrackUrl = '/Boss_level_pyramid.mp3';
    } else if (bossLevel === 20) {
      bossTrackUrl = '/Boss_level_Hexagon.mp3';
    }
    
    // Stop any existing boss music
    if (this.bossMusic) {
      this.bossMusic.pause();
      this.bossMusic.currentTime = 0;
    }
    
    // Create and play new boss music with looping
    this.bossMusic = new Audio(bossTrackUrl);
    this.bossMusic.loop = true;
    this.bossMusic.volume = 0.3;
    
    // Set up AnalyserNode for frequency analysis + stereo VU
    try {
      const ctx = this.getAudioContext();
      this.bossMusicSource = ctx.createMediaElementSource(this.bossMusic);
      this.connectedElements.add(this.bossMusic);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      
      // Set up stereo split for VU meters
      this.splitter = ctx.createChannelSplitter(2);
      this.leftAnalyser = ctx.createAnalyser();
      this.rightAnalyser = ctx.createAnalyser();
      this.leftAnalyser.fftSize = 256;
      this.rightAnalyser.fftSize = 256;
      
      this.bossMusicSource.connect(this.analyser);
      this.bossMusicSource.connect(this.splitter);
      this.splitter.connect(this.leftAnalyser, 0);
      this.splitter.connect(this.rightAnalyser, 1);
      this.analyser.connect(ctx.destination);
    } catch (e) {
      // Fallback: play without analyser
      this.analyser = null;
      this.frequencyData = null;
      this.bossMusicSource = null;
    }
    
    this.bossMusic.play().catch(() => {});
  }

  stopBossMusic() {
    if (this.bossMusic) {
      this.bossMusic.pause();
      this.bossMusic.currentTime = 0;
      this.bossMusic = null;
    }
    this.analyser = null;
    this.frequencyData = null;
    this.bossMusicSource = null;
    this.leftAnalyser = null;
    this.rightAnalyser = null;
    this.splitter = null;
  }

  getBassEnergy(): number {
    if (!this.analyser || !this.frequencyData) return 0;
    (this.analyser as any).getByteFrequencyData(this.frequencyData);
    // Average of first 8 bins (bass frequencies)
    let sum = 0;
    const bins = Math.min(8, this.frequencyData.length);
    for (let i = 0; i < bins; i++) {
      sum += this.frequencyData[i];
    }
    return sum / (bins * 255); // Normalize to 0-1
  }

  resumeBackgroundMusic() {
    if (!this.musicEnabled) return;
    
    // Restore the saved track and position
    this.currentTrackIndex = this.savedBackgroundMusicIndex;
    
    // Initialize track if not already loaded
    if (!this.musicTracks[this.currentTrackIndex]) {
      const audio = new Audio(this.trackUrls[this.currentTrackIndex]);
      audio.volume = 0.3;
      audio.addEventListener('ended', () => this.handleTrackEnd());
      this.musicTracks[this.currentTrackIndex] = audio;
    }
    
    const track = this.musicTracks[this.currentTrackIndex];
    if (track) {
      track.currentTime = this.savedBackgroundMusicPosition;
      track.play().catch(() => {});
    }
    
    // Reset saved position
    this.savedBackgroundMusicPosition = 0;
  }

  isBossMusicPlaying(): boolean {
    return this.bossMusic !== null && !this.bossMusic.paused;
  }

  // Boss power-up sound effects
  playBossStunnerSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/stun.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playReflectShieldSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/reflecting.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playHomingBallSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/magnet.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.6);
    }
  }

  playReflectedAttackSound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Deflection ping
    const oscillator1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    oscillator1.connect(gain1);
    gain1.connect(ctx.destination);
    oscillator1.frequency.value = 900;
    oscillator1.type = 'sine';
    gain1.gain.setValueAtTime(0.1, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    oscillator1.start(ctx.currentTime);
    oscillator1.stop(ctx.currentTime + 0.1);
    
    const oscillator2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    oscillator2.connect(gain2);
    gain2.connect(ctx.destination);
    oscillator2.frequency.value = 1100;
    oscillator2.type = 'sine';
    gain2.gain.setValueAtTime(0.15, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    oscillator2.start(ctx.currentTime);
    oscillator2.stop(ctx.currentTime + 0.15);
  }

  playSecondChanceSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/barrier.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.5);
    }
  }

  playSecondChanceSaveSound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Dramatic electric zap + relief sound when ball is saved
    // Electric zap
    const zap = ctx.createOscillator();
    const zapGain = ctx.createGain();
    zap.connect(zapGain);
    zapGain.connect(ctx.destination);
    
    zap.type = 'sawtooth';
    zap.frequency.setValueAtTime(1500, ctx.currentTime);
    zap.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
    
    zapGain.gain.setValueAtTime(0.3, ctx.currentTime);
    zapGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    zap.start(ctx.currentTime);
    zap.stop(ctx.currentTime + 0.15);
    
    // Relief ascending tone
    const relief = ctx.createOscillator();
    const reliefGain = ctx.createGain();
    relief.connect(reliefGain);
    reliefGain.connect(ctx.destination);
    
    relief.type = 'sine';
    relief.frequency.setValueAtTime(400, ctx.currentTime + 0.1);
    relief.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    
    reliefGain.gain.setValueAtTime(0.2, ctx.currentTime + 0.1);
    reliefGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    relief.start(ctx.currentTime + 0.1);
    relief.stop(ctx.currentTime + 0.3);
  }

  // Danger ball hitting boss core - heavy retro impact
  playDangerBallCoreHitSound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Heavy bass square-wave 50Hz -> 25Hz (long decay)
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.type = 'square';
    bass.frequency.setValueAtTime(50, ctx.currentTime);
    bass.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.4);
    bassGain.gain.setValueAtTime(0.45, ctx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 0.4);
    
    // Distorted sawtooth crunch at 180Hz
    const crunch = ctx.createOscillator();
    const crunchGain = ctx.createGain();
    crunch.connect(crunchGain);
    crunchGain.connect(ctx.destination);
    crunch.type = 'sawtooth';
    crunch.frequency.setValueAtTime(180, ctx.currentTime);
    crunch.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.2);
    crunchGain.gain.setValueAtTime(0.3, ctx.currentTime);
    crunchGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    crunch.start(ctx.currentTime);
    crunch.stop(ctx.currentTime + 0.2);
    
    // Second bass hit at 40Hz -- double-punch feel
    const punch = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punch.connect(punchGain);
    punchGain.connect(ctx.destination);
    punch.type = 'square';
    punch.frequency.setValueAtTime(40, ctx.currentTime + 0.08);
    punch.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.35);
    punchGain.gain.setValueAtTime(0.01, ctx.currentTime);
    punchGain.gain.setValueAtTime(0.35, ctx.currentTime + 0.08);
    punchGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    punch.start(ctx.currentTime);
    punch.stop(ctx.currentTime + 0.35);
  }

  // Danger ball missed - plays preloaded MP3
  playDangerBallMissedSound() {
    if (!this.sfxEnabled) return;
    const buffer = this.audioBuffers['/ball_missed.mp3'];
    if (buffer) {
      this.playAudioBuffer(buffer, 0.7);
    }
  }

  // Mega Boss victory - dramatic explosion + triumphant fanfare
  playMegaBossVictorySound() {
    if (!this.sfxEnabled) return;
    const ctx = this.getAudioContext();
    
    // Multiple layered explosions
    [0, 100, 200, 350].forEach((delay) => {
      setTimeout(() => {
        // Bass rumble
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.connect(bassGain);
        bassGain.connect(ctx.destination);
        bass.type = 'sine';
        bass.frequency.setValueAtTime(60 + Math.random() * 20, ctx.currentTime);
        bass.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
        bassGain.gain.setValueAtTime(0.5, ctx.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        bass.start(ctx.currentTime);
        bass.stop(ctx.currentTime + 0.5);
        
        // Mid boom
        const mid = ctx.createOscillator();
        const midGain = ctx.createGain();
        mid.connect(midGain);
        midGain.connect(ctx.destination);
        mid.type = 'triangle';
        mid.frequency.setValueAtTime(200 + Math.random() * 100, ctx.currentTime);
        mid.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
        midGain.gain.setValueAtTime(0.3, ctx.currentTime);
        midGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        mid.start(ctx.currentTime);
        mid.stop(ctx.currentTime + 0.3);
      }, delay);
    });
    
    // Triumphant ascending chord after explosions
    setTimeout(() => {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => { // C5 E5 G5 C6
        setTimeout(() => {
          const note = ctx.createOscillator();
          const noteGain = ctx.createGain();
          note.connect(noteGain);
          noteGain.connect(ctx.destination);
          note.type = 'sine';
          note.frequency.value = freq;
          noteGain.gain.setValueAtTime(0.2, ctx.currentTime);
          noteGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
          note.start(ctx.currentTime);
          note.stop(ctx.currentTime + 0.8);
        }, i * 100);
      });
    }, 500);
  }

}

export const soundManager = new SoundManager();
