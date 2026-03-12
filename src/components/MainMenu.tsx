import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GameSettings, Difficulty, GameMode, DailyChallengeConfig } from "@/types/game";
import { DailyChallengeOverlay } from "./DailyChallengeOverlay";
import type { DailyChallenge } from "@/utils/dailyChallenge";
import startScreenImg from "@/assets/start-screen-new.png";
import startScreenWebp from "@/assets/start-screen-new.webp";
import { HighScoreDisplay } from "./HighScoreDisplay";
import { Changelog } from "./Changelog";
import CRTOverlay from "./CRTOverlay";
import { soundManager } from "@/utils/sounds";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { GAME_VERSION } from "@/constants/version";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import { useAdaptiveQuality } from "@/hooks/useAdaptiveQuality";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { TopScoresDisplay } from "./TopScoresDisplay";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { useLevelProgress } from "@/hooks/useLevelProgress";
import { FINAL_LEVEL, ENABLE_DEBUG_FEATURES, ENABLE_HIGH_QUALITY } from "@/constants/game";
import { BOSS_RUSH_CONFIG } from "@/constants/bossRushConfig";
import { SettingsDialog } from "./SettingsDialog";
import { useGameSettings } from "@/hooks/useGameSettings";

interface MainMenuProps {
  onStartGame: (settings: GameSettings) => void;
}

export const MainMenu = ({ onStartGame }: MainMenuProps) => {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [gameMode, setGameMode] = useState<GameMode>("normal");
  const { settings: gameSettings } = useGameSettings();
  const { settings: gameSettings } = useGameSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showHighScores, setShowHighScores] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPressToStart, setShowPressToStart] = useState(true);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setIsLoggedIn(!!session));
    return () => subscription.unsubscribe();
  }, []);

  // Starting level state
  const [startingLevel, setStartingLevel] = useState(1);
  const [showLockedMessage, setShowLockedMessage] = useState(false);
  const lockedMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { maxLevelReached, isLevelUnlocked } = useLevelProgress();

  // Refs for swipe gesture detection
  const highScoresRef = useRef<HTMLDivElement>(null);
  const changelogRef = useRef<HTMLDivElement>(null);
  const whatsNewRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const instructionsRef = useRef<HTMLDivElement>(null);

  // Use adaptive quality hook for CRT effects
  const { quality, qualitySettings } = useAdaptiveQuality({
    initialQuality: ENABLE_HIGH_QUALITY ? "high" : "medium",
    autoAdjust: false,
  });

  const isIOSDevice =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Force service worker update check and apply when at main menu
  useServiceWorkerUpdate({ shouldApplyUpdate: true, isMainMenu: true });

  // Hidden developer feature: Press TAB to open level editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Tab" &&
        !showInstructions &&
        !showHighScores &&
        !showAbout &&
        !showChangelog &&
        !showWhatsNew &&
        !showPressToStart &&
        !showDailyChallenge
      ) {
        e.preventDefault();
        soundManager.playMenuClick();
        navigate("/level-editor");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, showInstructions, showHighScores, showAbout, showChangelog, showWhatsNew, showPressToStart, showDailyChallenge]);

  const handleStart = () => {
    const settings: GameSettings = {
      startingLives: gameMode === "bossRush" ? BOSS_RUSH_CONFIG.startingLives : difficulty === "godlike" ? 1 : 3,
      difficulty,
      startingLevel: gameMode === "bossRush" ? BOSS_RUSH_CONFIG.bossOrder[0] : startingLevel,
      gameMode,
    };
    onStartGame(settings);
  };

  const handleDailyChallengeStart = (challenge: DailyChallenge) => {
    const config: DailyChallengeConfig = {
      layout: challenge.layout,
      dateString: challenge.dateString,
      startingLives: challenge.startingLives,
      targetScore: challenge.targetScore,
      timeLimit: challenge.timeLimit,
      objectiveIds: challenge.objectives.map((o) => o.id),
      speedMultiplier: challenge.speedMultiplier,
      enemySpawnInterval: challenge.enemySpawnInterval,
      musicReactiveBackground: challenge.musicReactiveBackground,
      noExtraLives: challenge.noExtraLives,
      shapeName: challenge.shapeName,
      isBossChallenge: challenge.isBossChallenge,
      bossLevel: challenge.bossLevel,
    };
    const settings: GameSettings = {
      startingLives: challenge.startingLives,
      difficulty,
      startingLevel: 21,
      gameMode: "dailyChallenge",
      dailyChallengeConfig: config,
    };
    onStartGame(settings);
  };

  const handleLevelChange = (delta: number) => {
    const newLevel = startingLevel + delta;
    if (newLevel < 1 || newLevel > FINAL_LEVEL) return;

    soundManager.playMenuClick();
    setStartingLevel(newLevel);

    // In debug mode, all levels are unlocked
    if (ENABLE_DEBUG_FEATURES) {
      setShowLockedMessage(false);
      return;
    }

    if (!isLevelUnlocked(newLevel)) {
      // Show locked message
      if (lockedMessageTimeoutRef.current) {
        clearTimeout(lockedMessageTimeoutRef.current);
      }
      setShowLockedMessage(true);
      lockedMessageTimeoutRef.current = setTimeout(() => {
        setShowLockedMessage(false);
      }, 2000);
    } else {
      setShowLockedMessage(false);
    }
  };

  // Swipe gesture handlers for all sub-screens
  const isMobileDevice =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ("ontouchstart" in window && window.matchMedia("(max-width: 768px)").matches);

  useSwipeGesture(highScoresRef, () => setShowHighScores(false), { enabled: showHighScores && isMobileDevice });
  useSwipeGesture(changelogRef, () => setShowChangelog(false), { enabled: showChangelog && isMobileDevice });
  useSwipeGesture(whatsNewRef, () => setShowWhatsNew(false), { enabled: showWhatsNew && isMobileDevice });
  useSwipeGesture(aboutRef, () => setShowAbout(false), { enabled: showAbout && isMobileDevice });
  useSwipeGesture(instructionsRef, () => setShowInstructions(false), { enabled: showInstructions && isMobileDevice });

  // ESC key to close overlay screens
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showHighScores) {
          soundManager.playMenuClick();
          setShowHighScores(false);
        } else if (showChangelog) {
          soundManager.playMenuClick();
          setShowChangelog(false);
        } else if (showWhatsNew) {
          soundManager.playMenuClick();
          setShowWhatsNew(false);
        } else if (showAbout) {
          soundManager.playMenuClick();
          setShowAbout(false);
        } else if (showInstructions) {
          soundManager.playMenuClick();
          setShowInstructions(false);
        } else if (showDailyChallenge) {
          soundManager.playMenuClick();
          setShowDailyChallenge(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showHighScores, showChangelog, showWhatsNew, showAbout, showInstructions, showDailyChallenge]);

  if (showDailyChallenge) {
    return (
      <DailyChallengeOverlay
        onPlay={handleDailyChallengeStart}
        onClose={() => setShowDailyChallenge(false)}
      />
    );
  }

  if (showHighScores) {
    return (
      <div
        ref={highScoresRef}
        className="fixed inset-0 w-full h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[hsl(220,25%,12%)] to-[hsl(220,30%,8%)] swipe-container animate-fade-in"
      >
        {qualitySettings.backgroundEffects && <CRTOverlay quality={quality} />}
        <HighScoreDisplay onClose={() => setShowHighScores(false)} />
      </div>
    );
  }

  if (showChangelog) {
    return <Changelog onClose={() => setShowChangelog(false)} quality={quality} qualitySettings={qualitySettings} />;
  }

  if (showWhatsNew) {
    return (
      <div
        ref={whatsNewRef}
        className="fixed inset-0 w-full h-screen bg-gradient-to-b from-[hsl(220,25%,12%)] to-[hsl(220,30%,8%)] flex items-center justify-center p-2 sm:p-4 overflow-hidden swipe-container animate-fade-in"
      >
        {qualitySettings.backgroundEffects && <CRTOverlay quality={quality} />}
        <Card className="relative w-full h-full max-w-2xl max-h-screen overflow-y-auto p-4 sm:p-6 md:p-8 bg-[hsl(220,20%,15%)] border-[hsl(200,70%,50%)] animate-scale-in">
          <button
            onClick={() => {
              soundManager.playMenuClick();
              setShowWhatsNew(false);
            }}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
            title="Close"
          >
            <X size={24} />
          </button>

          <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 sm:mb-3 text-center text-[hsl(200,70%,50%)]">
            What's New in v{GAME_VERSION}
          </h2>

          <div className="space-y-2 sm:space-y-3 text-white">
            {/* Faster, Smoother Engine */}
            <div className="bg-gradient-to-r from-[hsl(45,100%,50%)]/20 to-[hsl(30,100%,60%)]/20 p-2 sm:p-3 rounded-lg border-2 border-[hsl(45,100%,50%)]/50">
              <h3 className="font-bold text-xs sm:text-sm mb-1 text-[hsl(45,100%,50%)]">⚡ Faster, Smoother Engine</h3>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] sm:text-xs">
                <li>
                  The game now runs on a{" "}
                  <span className="text-[hsl(45,100%,50%)] font-bold">fixed‑timestep simulation</span>, keeping gameplay
                  speed identical on all devices — no more “fast PC = fast game”.
                </li>
                <li>Unified timing system removes jitter and cooldown drift for rock‑solid consistency.</li>
                <li>
                  Pause/resume is now perfectly stable —{" "}
                  <span className="text-[hsl(120,60%,50%)] font-bold">no more cooldown jumps</span>.
                </li>
                <li>timeScale finally behaves correctly across all movement and logic.</li>
              </ul>
            </div>

            {/* Boss Hit Streak System */}
            <div className="bg-gradient-to-r from-[hsl(270,80%,60%)]/20 to-[hsl(290,80%,60%)]/20 p-2 sm:p-3 rounded-lg border-2 border-[hsl(280,80%,60%)]/50">
              <h3 className="font-bold text-xs sm:text-sm mb-1 text-[hsl(280,80%,60%)]">
                🔥 New Boss Hit Streak System
              </h3>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] sm:text-xs">
                <li>A brand‑new streak mechanic lets you push for even higher scores.</li>
                <li>Consecutive hits on bosses and minions award 100 pts + streak bonus (e.g., x5 = +5% bonus).</li>
                <li>Reach x10+ to activate music‑reactive background hue blinking on all boss levels.</li>
              </ul>
            </div>

            {/* Performance Boost */}
            <div className="bg-gradient-to-r from-[hsl(200,70%,50%)]/20 to-[hsl(120,60%,50%)]/20 p-2 sm:p-3 rounded-lg border-2 border-[hsl(120,60%,50%)]/50">
              <h3 className="font-bold text-xs sm:text-sm mb-1 text-[hsl(120,60%,50%)]">🚀 Performance Boost</h3>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] sm:text-xs">
                <li>Batched particle rendering and fewer heavy arc draws = smoother FPS.</li>
                <li>Gradients and shaders now pre‑warm to eliminate first‑use GPU stalls.</li>
                <li>Improved GPU detection for mobile + integrated GPUs.</li>
                <li>Rendering math is now crash‑proofed with new safety guards.</li>
              </ul>
            </div>

            {/* Player Profile System */}
            <div className="bg-gradient-to-r from-[hsl(330,100%,65%)]/20 to-[hsl(200,70%,50%)]/20 p-2 sm:p-3 rounded-lg border-2 border-[hsl(330,100%,65%)]/50">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-xs sm:text-sm text-[hsl(330,100%,65%)]">👤 Player Profile System</h3>
                <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "hsl(45,100%,50%)", color: "hsl(220,30%,10%)" }}>
                  BETA
                </span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] sm:text-xs">
                <li>Create an account with a unique <span className="text-[hsl(200,70%,50%)] font-bold">username</span> and leaderboard initials.</li>
                <li>Upload a custom <span className="text-[hsl(30,100%,60%)] font-bold">avatar</span> (256×256) to personalize your profile.</li>
                <li>Track lifetime stats, achievements, and power-up usage across all sessions.</li>
                <li>Public profiles are <span className="text-[hsl(120,60%,50%)] font-bold">linked from the leaderboard</span> — click any player to view their stats.</li>
                <li>Full account deletion available — your scores remain on the board (unlinked).</li>
              </ul>
            </div>

            {/* Daily Challenge Mode */}
            <div className="bg-gradient-to-r from-[hsl(45,100%,50%)]/20 to-[hsl(0,85%,55%)]/20 p-2 sm:p-3 rounded-lg border-2 border-[hsl(45,100%,50%)]/50">
              <h3 className="font-bold text-xs sm:text-sm mb-1 text-[hsl(45,100%,50%)]">📅 Daily Challenge Mode</h3>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] sm:text-xs">
                <li>A <span className="text-[hsl(45,100%,50%)] font-bold">new challenge every day</span> with a unique procedural brick layout.</li>
                <li>Special modifiers: 125% speed, enemy spawns every 10s, music-reactive backgrounds, no extra lives.</li>
                <li>Complete objectives like No Deaths, Speed Run, Score Hunter, or Combo Master.</li>
                <li>Build a <span className="text-[hsl(330,100%,65%)] font-bold">daily streak</span> by completing challenges on consecutive days.</li>
                <li>Unlock exclusive daily challenge achievements!</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowChangelog(true);
              setShowWhatsNew(false);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className="w-full mt-2 sm:mt-3 bg-[hsl(330,100%,65%)] hover:bg-[hsl(330,100%,65%)]/80 text-white text-xs sm:text-sm py-2 sm:py-3"
          >
            View Full Changelog
          </Button>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowWhatsNew(false);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className="w-full mt-2 bg-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,60%)] text-white text-xs sm:text-sm py-2 sm:py-3"
          >
            Back to Menu
          </Button>
        </Card>
      </div>
    );
  }

  if (showAbout) {
    return (
      <div
        ref={aboutRef}
        className="fixed inset-0 w-full h-screen bg-gradient-to-b from-[hsl(220,25%,12%)] to-[hsl(220,30%,8%)] flex items-center justify-center p-2 sm:p-4 overflow-hidden swipe-container animate-fade-in"
      >
        {qualitySettings.backgroundEffects && <CRTOverlay quality={quality} />}
        <Card className="relative w-full h-full max-w-5xl max-h-screen overflow-y-auto p-4 sm:p-6 md:p-8 bg-[hsl(220,20%,15%)] border-[hsl(200,70%,50%)] animate-scale-in">
          <button
            onClick={() => {
              soundManager.playMenuClick();
              setShowAbout(false);
            }}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
            title="Close"
          >
            <X size={24} />
          </button>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 text-center text-[hsl(200,70%,50%)]">
            About Vibing Arkanoid
          </h2>

          <div className="space-y-2 sm:space-y-3 md:space-y-4 text-white">
            <p className="text-xs sm:text-sm md:text-base leading-relaxed">
              Welcome to <span className="text-[hsl(200,70%,50%)] font-bold">Vibing Arkanoid</span> - the most
              electrifying brick-breaking experience ever created! This isn't just another Breakout clone - it's a
              pulsating, retro-drenched journey through{" "}
              <span className="text-[hsl(200,70%,50%)] font-bold">20 action-packed levels</span> of pure arcade bliss.
            </p>

            <div className="bg-gradient-to-r from-[hsl(30,100%,60%)]/20 to-[hsl(0,85%,55%)]/20 p-3 sm:p-4 rounded-lg border-2 border-[hsl(30,100%,60%)]/50">
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(30,100%,60%)]">
                ⚔️ Epic Boss Battles
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed">
                Face off against massive bosses on{" "}
                <span className="text-[hsl(200,70%,50%)] font-bold">
                  levels 5, 10, 15, and the ultimate Mega Boss on level 20
                </span>
                ! Each boss features unique attack patterns including shots, lasers, spiral attacks, and cross patterns.
                The Pyramid Boss{" "}
                <span className="text-[hsl(330,100%,65%)] font-bold">resurrects into 3 smaller bosses</span>, while the
                Mega Boss has <span className="text-[hsl(0,85%,55%)] font-bold">4 devastating phases</span> with orb
                swarms and ball capture mechanics!
              </p>
            </div>

            <div className="bg-gradient-to-r from-[hsl(200,70%,50%)]/20 to-[hsl(330,100%,65%)]/20 p-3 sm:p-4 rounded-lg border-2 border-[hsl(200,70%,50%)]/50">
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">
                🌐 Global High Scores
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed">
                Compete with players worldwide! Cloud-based leaderboards track{" "}
                <span className="text-[hsl(330,100%,65%)] font-bold">all-time, weekly, and daily rankings</span>. Can
                you reach the top 20 and prove you're the ultimate brick-breaking champion?
              </p>
            </div>

            <p className="text-xs sm:text-sm md:text-base leading-relaxed">
              Featuring an authentic retro aesthetic with{" "}
              <span className="text-[hsl(200,70%,50%)] font-bold">CRT scanline effects</span>, advanced{" "}
              <span className="text-[hsl(330,100%,65%)] font-bold">CCD physics engine</span> for precise collisions,
              special brick types (metal, cracked, explosive), 12 unique power-ups, enemies that fight back, and a
              soundtrack that'll make your speakers weep with joy. Collect the legendary{" "}
              <span className="text-[hsl(330,100%,65%)] font-bold">Q-U-M-R-A-N</span> bonus letters for 5 extra lives!
            </p>

            <div className="bg-black/30 p-3 sm:p-4 md:p-5 rounded-lg border border-[hsl(330,100%,65%)]/30">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-sm sm:text-base md:text-lg text-[hsl(330,100%,65%)]">👤 Player Profiles</h3>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "hsl(45,100%,50%)", color: "hsl(220,30%,10%)" }}>
                  BETA
                </span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">
                Create an account with a unique <span className="text-[hsl(200,70%,50%)] font-bold">username</span> and
                upload a custom avatar. Track your lifetime stats, achievements, and power-up usage. Toggle your profile
                between public and private — public profiles are linked directly from the leaderboard. Full account
                deletion with data safety: your scores remain on the board but are unlinked from your profile.
              </p>
            </div>

            <div className="bg-black/30 p-3 sm:p-4 md:p-5 rounded-lg border border-[hsl(45,100%,50%)]/30">
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(45,100%,50%)]">📅 Daily Challenge</h3>
              <p className="text-xs sm:text-sm leading-relaxed">
                A new challenge is generated every day with a unique procedural layout, special modifiers (125% speed,
                enemy spawns every 10s, music-reactive backgrounds, no extra lives), and objectives to complete.
                Build a <span className="text-[hsl(330,100%,65%)] font-bold">daily streak</span> by completing
                challenges on consecutive days and unlock exclusive achievements!
              </p>
            </div>

            <div className="bg-black/30 p-3 sm:p-4 md:p-5 rounded-lg border border-[hsl(200,70%,50%)]/30">
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">
                Vibe Coded to Perfection
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed">
                This game is the result of pure <span className="text-[hsl(330,100%,65%)] font-bold">vibe coding</span>{" "}
                - that magical state where code flows like music and creativity knows no bounds. Every pixel, every
                sound effect, every level was crafted with passion and energy.
              </p>
            </div>

            <div className="bg-black/30 p-3 sm:p-4 md:p-5 rounded-lg border border-[hsl(330,100%,65%)]/30">
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(330,100%,65%)]">Created By</h3>
              <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                <span className="text-[hsl(200,70%,50%)] font-bold text-lg sm:text-xl md:text-2xl">Qumran</span>
              </p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Game Design • Programming • Music Viber • Vibe Engineering
              </p>
            </div>

            <p className="text-center text-xs sm:text-sm text-gray-500 italic mt-3 sm:mt-4">
              "In the zone, riding the wave of pure creativity." - The Vibe Coding Manifesto
            </p>
          </div>
          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowChangelog(true);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className="w-full mt-3 sm:mt-4 bg-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,60%)] text-white text-sm sm:text-base py-3 sm:py-4"
          >
            v{GAME_VERSION} - Changelog
          </Button>
          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowAbout(false);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className="w-full mt-3 sm:mt-4 bg-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,60%)] text-white text-sm sm:text-base py-3 sm:py-4"
          >
            Back to Menu
          </Button>
        </Card>
      </div>
    );
  }

  if (showPressToStart) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center relative bg-[hsl(220,25%,12%)] cursor-pointer"
        onClick={() => {
          soundManager.playMenuClick();
          soundManager.initializeRandomTrack();
          soundManager.playBackgroundMusic();
          setShowPressToStart(false);
        }}
        onKeyDown={() => {
          soundManager.playMenuClick();
          soundManager.initializeRandomTrack();
          soundManager.playBackgroundMusic();
          setShowPressToStart(false);
        }}
        tabIndex={0}
      >
        {qualitySettings.backgroundEffects && <CRTOverlay quality={quality} />}
        <picture className="absolute inset-0 w-full h-full pointer-events-none">
          <source srcSet={startScreenWebp} type="image/webp" />
          <img src={startScreenImg} alt="Game start screen" className="w-full h-full object-contain" />
        </picture>
        <div className="text-center animate-pulse relative z-10">
          <p className="text-white text-2xl font-bold">Press key/mouse to continue</p>
        </div>
      </div>
    );
  }

  if (showInstructions) {
    return (
      <div
        ref={instructionsRef}
        className="fixed inset-0 w-full h-screen bg-gradient-to-b from-[hsl(220,25%,12%)] to-[hsl(220,30%,8%)] flex items-center justify-center p-2 sm:p-4 overflow-hidden swipe-container animate-fade-in"
      >
        {qualitySettings.backgroundEffects && <CRTOverlay quality={quality} />}
        <Card className="relative w-full h-full max-w-5xl max-h-screen overflow-y-auto p-4 sm:p-6 md:p-8 bg-[hsl(220,20%,15%)] border-[hsl(200,70%,50%)] animate-scale-in">
          <button
            onClick={() => {
              soundManager.playMenuClick();
              setShowInstructions(false);
            }}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
            title="Close"
          >
            <X size={24} />
          </button>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 text-center text-[hsl(200,70%,50%)]">
            Instructions
          </h2>

          <div className="space-y-2 sm:space-y-3 md:space-y-4 text-white">
            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">Controls</h3>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>
                  <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-xs">Mouse</span> - Move paddle (click
                  to capture mouse)
                </li>
                <li>
                  <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-xs">←→ / A/D / Scroll</span> - Adjust
                  launch angle
                </li>
                <li>
                  <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-xs">Click / Space</span> - Launch ball
                  / Fire bullets
                </li>
                <li>
                  <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-xs">ESC</span> - Release mouse capture
                </li>
                <li>
                  <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-xs">F</span> - Toggle fullscreen
                </li>
                <li>
                  <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-xs">P</span> - Pause game
                </li>
                <li>
                  <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-xs">N / B</span> - Next/Previous music
                  track
                </li>
                <li>
                  <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-xs">M</span> - Toggle music
                </li>
              </ul>
            </div>

            {isIOSDevice && (
              <div className="bg-gradient-to-r from-[hsl(200,70%,50%)]/20 to-[hsl(330,100%,65%)]/20 p-3 sm:p-4 rounded-lg border-2 border-[hsl(200,70%,50%)]/50">
                <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">
                  📱 iOS Tip: True Fullscreen Experience
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed">
                  For the best fullscreen gaming experience on iPhone/iPad, add this game to your Home Screen: Tap the{" "}
                  <span className="font-bold">Share</span> button in Safari →
                  <span className="font-bold"> Add to Home Screen</span>. Then launch from your home screen to play
                  without any browser UI!
                </p>
              </div>
            )}

            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">Gameplay</h3>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>Break all bricks to advance to the next level</li>
                <li>Collect power-ups for special abilities</li>
                <li>Collect bonus letters Q-U-M-R-A-N for massive rewards (5 extra lives)</li>
                <li>Watch out for enemies and their projectiles</li>
                <li>
                  <span className="text-[hsl(30,100%,60%)] font-bold">
                    Boss battles on levels 5, 10, 15, and the ultimate Mega Boss on level 20!
                  </span>
                </li>
                <li>Ball bounces only from top half of paddle</li>
                <li>If ball doesn't touch paddle for 15s, it auto-diverts</li>
                <li>Powerup drops every 3 enemies destroyed</li>
                <li>Game automatically adjusts visual quality based on performance</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">
                Special Brick Types
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>
                  <span className="text-gray-400">Metal Bricks</span> - Indestructible! Can only be destroyed by
                  explosive blasts. Block turret shots.
                </li>
                <li>
                  <span className="text-cyan-400">Cracked Bricks</span> - Require 3 hits to destroy. Visual damage
                  progression with distinct sounds.
                </li>
                <li>
                  <span className="text-[hsl(30,100%,60%)]">Explosive Bricks</span> - Detonate on impact! Destroy all
                  surrounding bricks in blast radius.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">
                Enemies & Bosses
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>
                  <span className="text-cyan-400">Cube Enemies</span> - Basic enemies, 1 hit to destroy
                </li>
                <li>
                  <span className="text-pink-400">Sphere Enemies</span> - 2 hits to destroy, become faster when angry
                </li>
                <li>
                  <span className="text-purple-400">Pyramid Enemies</span> - 3 hits to destroy, toughest regular enemy
                </li>
                <li>
                  <span className="text-[hsl(50,100%,55%)]">Star Enemies</span> - Appear on levels 3, 6, 9, 12, 16 & 19 (rare spawn). Build new bricks and upgrade existing ones, then roam for 3–5 seconds before building again. Only 1 hit to destroy! Explosive bricks can also catch them in the blast.
                </li>
                <li>
                  <span className="text-[hsl(30,100%,60%)] font-bold">CUBE BOSS (Level 5)</span> - First boss encounter
                  with unique attack patterns
                </li>
                <li>
                  <span className="text-[hsl(330,100%,65%)] font-bold">SPHERE BOSS (Level 10)</span> - Multi-phase boss
                  with escalating difficulty
                </li>
                <li>
                  <span className="text-[hsl(280,80%,60%)] font-bold">PYRAMID BOSS (Level 15)</span> - Ultimate
                  challenge! Splits into 3 smaller bosses
                </li>
                <li>
                  <span className="text-[hsl(0,85%,55%)] font-bold">MEGA BOSS (Level 20)</span> - Final boss with 4
                  phases, orb swarms, and ball capture mechanics
                </li>
                <li>Bosses attack with shots, lasers, spiral patterns, and cross patterns</li>
                <li>Boss health bars show current phase HP</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">Power-ups</h3>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>
                  <span className="text-[hsl(330,100%,65%)]">Multiball</span> - Split ball into three
                </li>
                <li>
                  <span className="text-[hsl(30,100%,60%)]">Turrets</span> - Add cannons to paddle (30 shots normal / 15
                  godlike, 50% chance at 90s)
                </li>
                <li>
                  <span className="text-[hsl(30,100%,60%)]">Fireball</span> - Ball destroys everything
                </li>
                <li>
                  <span className="text-[hsl(0,100%,60%)]">Extra Life</span> - Gain one life
                </li>
                <li>
                  <span className="text-[hsl(200,100%,60%)]">Slowdown</span> - Slow ball speed
                </li>
                <li>
                  <span className="text-[hsl(120,60%,45%)]">Extend</span> - Wider paddle
                </li>
                <li>
                  <span className="text-[hsl(0,75%,55%)]">Shrink</span> - Smaller paddle
                </li>
                <li>
                  <span className="text-[hsl(280,80%,60%)]">Shield</span> - Protects paddle from 1 projectile hit
                </li>
                <li>
                  <span className="text-[hsl(45,100%,50%)] font-bold">Boss Stunner</span> - Freezes boss for 5 seconds
                  (boss minions only)
                </li>
                <li>
                  <span className="text-[hsl(280,90%,60%)] font-bold">Reflect Shield</span> - Reflects boss attacks back
                  for 15 seconds (boss minions only)
                </li>
                <li>
                  <span className="text-[hsl(0,100%,50%)] font-bold">Homing Ball</span> - Ball curves toward boss for 8
                  seconds with red trail (boss levels only)
                </li>
                <li>
                  <span className="text-[hsl(180,70%,50%)] font-bold">Barrier</span> - Creates a barrier at the bottom
                  that saves your ball once
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(200,70%,50%)]">
                Difficulty Modes
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>
                  <span className="text-[hsl(120,60%,45%)]">Normal</span> - Standard gameplay, speed cap 150%
                </li>
                <li>
                  <span className="text-[hsl(0,85%,55%)]">Godlike</span> - No extra lives (power-ups or boss defeat), 1
                  life, speed cap ~149%, faster enemies, more enemy fire
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(330,100%,65%)]">
                Player Profile
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>Create an account from the login screen with a unique username and 3-letter initials</li>
                <li>Upload a custom avatar image (max 256×256 pixels) from your profile page</li>
                <li>Toggle your profile between public and private visibility</li>
                <li>Public profiles are linked from the leaderboard — click any player's initials to view their stats</li>
                <li>View lifetime stats: bricks destroyed, bosses killed, total play time, best combo, and more</li>
                <li>Unlock achievements by reaching milestones</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 text-[hsl(45,100%,50%)]">
                Daily Challenge
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>Access from the main menu — a new challenge is generated every day</li>
                <li>Each challenge has a unique procedural brick layout with special modifiers</li>
                <li>Modifiers include: 125% ball speed, enemy spawns every 10s, music-reactive backgrounds, no extra lives</li>
                <li>Additional daily modifiers: One Life, Two Lives, Fast Ball, or Brick Wall</li>
                <li>Complete objectives like No Deaths, Speed Run, Score Hunter, Purist, or Combo Master</li>
                <li>Build a daily streak by completing challenges on consecutive days</li>
                <li>Unlock exclusive daily challenge achievements</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowInstructions(false);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className="w-full mt-3 sm:mt-4 bg-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,60%)] text-white text-sm sm:text-base py-3 sm:py-4"
          >
            Back to Menu
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 bg-contain bg-center bg-no-repeat bg-[hsl(220,25%,12%)] relative"
      style={{ backgroundImage: `url(${startScreenImg})` }}
    >
      {qualitySettings.backgroundEffects && <CRTOverlay quality={quality} crtEnabled={gameSettings.crtEnabled} />}
      <Card className="max-w-sm w-full max-h-[90vh] overflow-y-auto smooth-scroll custom-scrollbar p-6 bg-black/60 backdrop-blur-sm border-[hsl(200,70%,50%)]">
        {/* Settings */}
        <div className="space-y-4">
          {/* Top Scores Display */}
          <TopScoresDisplay />

          {/* Difficulty */}
          <div className="space-y-2">
            <Label className="text-white text-base">Difficulty</Label>
            <RadioGroup
              value={difficulty}
              onValueChange={(value) => {
                setDifficulty(value as Difficulty);
                soundManager.playMenuClick();
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="text-white cursor-pointer">
                  Normal
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="godlike" id="godlike" />
                <Label htmlFor="godlike" className="text-[hsl(0,85%,55%)] cursor-pointer font-bold">
                  Godlike (No extra lives, harder enemies)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Game Mode */}
          <div className="space-y-2 pt-2 border-t border-[hsl(200,70%,50%)]/30">
            <Label className="text-white text-base">Game Mode</Label>
            <RadioGroup
              value={gameMode}
              onValueChange={(value) => {
                setGameMode(value as GameMode);
                soundManager.playMenuClick();
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="mode-normal" />
                <Label htmlFor="mode-normal" className="text-white cursor-pointer">
                  Normal (20 levels)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bossRush" id="mode-bossRush" />
                <Label htmlFor="mode-bossRush" className="text-[hsl(30,100%,60%)] cursor-pointer font-bold">
                  Boss Rush (4 bosses only)
                </Label>
              </div>
            </RadioGroup>
            {gameMode === "bossRush" && (
              <p className="text-xs text-gray-400 mt-1">
                Fight all 4 bosses consecutively! Start with {BOSS_RUSH_CONFIG.startingLives} lives.
              </p>
            )}
          </div>

          {/* Starting Level Selector - hidden in Boss Rush mode */}
          {gameMode === "normal" && (
            <div className="pt-2 border-t border-[hsl(200,70%,50%)]/30 relative">
              <div className="flex items-center justify-between">
                <Label className="text-white text-base">Starting Level</Label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLevelChange(-1)}
                    onMouseEnter={() => soundManager.playMenuHover()}
                    disabled={startingLevel <= 1}
                    className="p-1 rounded bg-[hsl(220,20%,20%)] hover:bg-[hsl(220,20%,30%)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 text-[hsl(200,70%,50%)]" />
                  </button>
                  <span
                    className={`text-sm font-mono min-w-[28px] text-center transition-colors ${
                      ENABLE_DEBUG_FEATURES || isLevelUnlocked(startingLevel) ? "text-white" : "text-gray-500"
                    }`}
                    style={{ fontFamily: "'Press Start 2P', monospace" }}
                  >
                    {startingLevel.toString().padStart(2, "0")}
                  </span>
                  <button
                    onClick={() => handleLevelChange(1)}
                    onMouseEnter={() => soundManager.playMenuHover()}
                    disabled={startingLevel >= FINAL_LEVEL}
                    className="p-1 rounded bg-[hsl(220,20%,20%)] hover:bg-[hsl(220,20%,30%)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-4 h-4 text-[hsl(200,70%,50%)]" />
                  </button>
                </div>
              </div>

              {/* Locked level floating message */}
              {showLockedMessage && (
                <div className="absolute right-0 top-full mt-1 px-3 py-1.5 bg-[hsl(0,85%,45%)] text-white text-xs rounded-lg shadow-lg animate-pulse whitespace-nowrap z-10">
                  You have not made it to this level yet!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 mt-6">
          <Button
            onClick={() => {
              // In normal mode, check level unlock; in Boss Rush mode, always allow
              if (gameMode === "normal" && !ENABLE_DEBUG_FEATURES && !isLevelUnlocked(startingLevel)) {
                soundManager.playMenuClick();
                if (lockedMessageTimeoutRef.current) {
                  clearTimeout(lockedMessageTimeoutRef.current);
                }
                setShowLockedMessage(true);
                lockedMessageTimeoutRef.current = setTimeout(() => {
                  setShowLockedMessage(false);
                }, 2000);
                return;
              }
              soundManager.playMenuClick();
              handleStart();
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className={`w-full text-white text-lg py-4 ${
              gameMode === "bossRush"
                ? "bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,60%)]"
                : ENABLE_DEBUG_FEATURES || isLevelUnlocked(startingLevel)
                  ? "bg-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,60%)]"
                  : "bg-gray-600 cursor-not-allowed"
            }`}
          >
            {gameMode === "bossRush" ? "Start Boss Rush" : `Start Game${ENABLE_DEBUG_FEATURES ? " (DEBUG)" : ""}`}
          </Button>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowDailyChallenge(true);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className="w-full relative bg-[hsl(45,100%,45%)] hover:bg-[hsl(45,100%,55%)] text-white"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
          >
            ⚡ Daily Challenge <span className="text-[hsl(0,100%,60%)] font-bold ml-2">BETA</span>
          </Button>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowInstructions(true);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            variant="outline"
            className="w-full border-[hsl(200,70%,50%)] text-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,50%)] hover:text-white"
          >
            Instructions
          </Button>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowHighScores(true);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            variant="outline"
            className="w-full border-[hsl(200,70%,50%)] text-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,50%)] hover:text-white"
          >
            High Scores
          </Button>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowWhatsNew(true);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            variant="outline"
            className="w-full relative border-[hsl(330,100%,65%)] text-[hsl(330,100%,65%)] hover:bg-[hsl(330,100%,65%)] hover:text-white"
          >
            <span className="absolute -top-2 -right-2 bg-[hsl(0,85%,55%)] text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              NEW
            </span>
            What's New
          </Button>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowAbout(true);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            variant="outline"
            className="w-full border-[hsl(200,70%,50%)] text-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,50%)] hover:text-white"
          >
            About
           </Button>

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              setShowSettings(true);
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            variant="outline"
            className="w-full border-[hsl(0,0%,50%)] text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,30%)] hover:text-white"
          >
            ⚙️ Settings
          </Button>

          <SettingsDialog
            open={showSettings}
            onOpenChange={setShowSettings}
            hideTrigger
          />

          <Button
            onClick={() => {
              soundManager.playMenuClick();
              navigate(isLoggedIn ? "/profile" : "/auth");
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            variant="outline"
            className="w-full border-[hsl(330,40%,50%)] text-[hsl(330,40%,50%)] hover:bg-[hsl(330,40%,50%)] hover:text-white"
          >
            {isLoggedIn ? "👤 Profile" : "🔑 Login"}
          </Button>
        </div>
      </Card>
    </div>
  );
};
