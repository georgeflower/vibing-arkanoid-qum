import { useEffect, useState, useCallback } from "react";
import { BOSS_RUSH_CONFIG } from "@/constants/bossRushConfig";

interface BossRushStatsOverlayProps {
  active: boolean;
  currentTime: number; // Total elapsed time (ms)
  bossName: string;
  bossIndex: number; // 0-3

  // Per-boss stats
  livesLostThisBoss: number;
  powerUpsThisBoss: number;
  enemiesKilledThisBoss: number;
  accuracyThisBoss: number; // 0-100%

  // Accumulated stats (all bosses so far)
  totalLivesLost: number;
  totalPowerUpsCollected: number;
  totalEnemiesKilled: number;
  totalAccuracy: number; // 0-100%
  livesRemaining: number;

  onContinue: () => void;
}

// Animated counter hook (from EndScreen pattern)
const useAnimatedCounter = (target: number, duration: number = 1500, delay: number = 0) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (delay > 0) {
      const delayTimer = setTimeout(() => {
        startAnimation();
      }, delay);
      return () => clearTimeout(delayTimer);
    } else {
      startAnimation();
    }

    function startAnimation() {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(Math.floor(target * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCurrent(target);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [target, duration, delay]);

  return current;
};

// Format time as MM:SS
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const BossRushStatsOverlay = ({
  active,
  currentTime,
  bossName,
  bossIndex,
  livesLostThisBoss,
  powerUpsThisBoss,
  enemiesKilledThisBoss,
  accuracyThisBoss,
  totalLivesLost,
  totalPowerUpsCollected,
  totalEnemiesKilled,
  totalAccuracy,
  livesRemaining,
  onContinue,
}: BossRushStatsOverlayProps) => {
  const [showStats, setShowStats] = useState(false);
  const [canContinue, setCanContinue] = useState(false);

  // Animated counters for "this boss" stats
  const animatedLivesLost = useAnimatedCounter(showStats ? livesLostThisBoss : 0, 800, 200);
  const animatedPowerUps = useAnimatedCounter(showStats ? powerUpsThisBoss : 0, 800, 400);
  const animatedEnemies = useAnimatedCounter(showStats ? enemiesKilledThisBoss : 0, 800, 600);
  const animatedAccuracy = useAnimatedCounter(showStats ? Math.round(accuracyThisBoss) : 0, 1000, 800);

  // Animated counters for "total" stats
  const animatedTotalLives = useAnimatedCounter(showStats ? totalLivesLost : 0, 800, 300);
  const animatedTotalPowerUps = useAnimatedCounter(showStats ? totalPowerUpsCollected : 0, 800, 500);
  const animatedTotalEnemies = useAnimatedCounter(showStats ? totalEnemiesKilled : 0, 800, 700);
  const animatedTotalAccuracy = useAnimatedCounter(showStats ? Math.round(totalAccuracy) : 0, 1000, 900);

  useEffect(() => {
    if (active) {
      // Show stats with a slight delay for dramatic effect
      const statsTimer = setTimeout(() => setShowStats(true), 300);
      // Allow continue after stats are shown
      const continueTimer = setTimeout(() => setCanContinue(true), 1200);

      return () => {
        clearTimeout(statsTimer);
        clearTimeout(continueTimer);
      };
    } else {
      setShowStats(false);
      setCanContinue(false);
    }
  }, [active]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (canContinue) {
      e.stopPropagation();
      e.preventDefault();
      onContinue();
    }
  }, [canContinue, onContinue]);

  // Also listen for keyboard
  useEffect(() => {
    if (!active || !canContinue) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.stopPropagation();
        e.preventDefault();
        onContinue();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, canContinue, onContinue]);
  // Allow click-to-continue even when Pointer Lock is active
  useEffect(() => {
    if (!active || !canContinue) return;

    const handlePointerDown = (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onContinue();
    };

    // pointerdown works even under Pointer Lock
    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [active, canContinue, onContinue]);

  if (!active) return null;

  const nextBossIndex = bossIndex + 1;
  const isLastBoss = nextBossIndex >= BOSS_RUSH_CONFIG.bossOrder.length;
  const nextBossLevel = isLastBoss ? null : BOSS_RUSH_CONFIG.bossOrder[nextBossIndex];
  const nextBossName = nextBossLevel !== null ? BOSS_RUSH_CONFIG.bossNames[nextBossLevel] : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer" onClick={handleClick}>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Stats container */}
      <div
        className={`relative z-10 p-6 md:p-8 max-w-2xl w-full mx-4 transition-all duration-500 ${
          showStats ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
          border: "4px solid",
          borderImage: "linear-gradient(135deg, hsl(48, 100%, 50%), hsl(38, 100%, 45%)) 1",
          boxShadow: "0 0 40px rgba(234, 179, 8, 0.3), inset 0 0 20px rgba(234, 179, 8, 0.1)",
        }}
      >
        {/* Victory title */}
        <h1
          className="retro-pixel-text text-2xl md:text-4xl text-center mb-6 animate-pulse"
          style={{
            color: "hsl(48, 100%, 60%)",
            textShadow: "0 0 20px hsl(48, 100%, 50%), 0 0 40px hsl(48, 100%, 40%)",
          }}
        >
          ⚔️ BOSS DEFEATED! ⚔️
        </h1>

        {/* Current time */}
        <div className="text-center mb-6">
          <span className="retro-pixel-text text-lg md:text-xl" style={{ color: "hsl(180, 70%, 60%)" }}>
            TIME: {formatTime(currentTime)}
          </span>
        </div>

        {/* Two-column stats layout */}
        <div className="grid grid-cols-2 gap-4 md:gap-8 mb-6">
          {/* This Boss column */}
          <div className="space-y-3">
            <h2
              className="retro-pixel-text text-sm md:text-base text-center mb-3 pb-2"
              style={{
                color: "hsl(280, 70%, 65%)",
                borderBottom: "2px solid hsl(280, 70%, 40%)",
              }}
            >
              THIS BOSS
            </h2>

            <StatRow label="Lives Lost" value={animatedLivesLost} color="hsl(0, 70%, 60%)" />
            <StatRow label="Power-ups" value={animatedPowerUps} color="hsl(120, 60%, 55%)" />
            <StatRow label="Enemies" value={animatedEnemies} color="hsl(30, 80%, 55%)" />
            <StatRow label="Accuracy" value={`${animatedAccuracy}%`} color="hsl(200, 80%, 60%)" />
          </div>

          {/* Total column */}
          <div className="space-y-3">
            <h2
              className="retro-pixel-text text-sm md:text-base text-center mb-3 pb-2"
              style={{
                color: "hsl(48, 90%, 60%)",
                borderBottom: "2px solid hsl(48, 80%, 40%)",
              }}
            >
              TOTAL
            </h2>

            <StatRow label="Lives Lost" value={animatedTotalLives} color="hsl(0, 70%, 60%)" />
            <StatRow label="Power-ups" value={animatedTotalPowerUps} color="hsl(120, 60%, 55%)" />
            <StatRow label="Enemies" value={animatedTotalEnemies} color="hsl(30, 80%, 55%)" />
            <StatRow label="Accuracy" value={`${animatedTotalAccuracy}%`} color="hsl(200, 80%, 60%)" />
          </div>
        </div>

        {/* Lives remaining */}
        <div className="text-center mb-6">
          <span className="retro-pixel-text text-base md:text-lg" style={{ color: "hsl(0, 70%, 60%)" }}>
            ❤️ LIVES REMAINING: {livesRemaining}
          </span>
        </div>

        {/* Next boss preview */}
        <div className="text-center mb-6">
          {isLastBoss ? (
            <span
              className="retro-pixel-text text-lg md:text-xl animate-pulse"
              style={{
                color: "hsl(0, 80%, 60%)",
                textShadow: "0 0 10px hsl(0, 80%, 50%)",
              }}
            >
              🎉 ALL BOSSES DEFEATED! 🎉
            </span>
          ) : (
            <span className="retro-pixel-text text-base md:text-lg" style={{ color: "hsl(45, 90%, 60%)" }}>
              NEXT: {nextBossName} ({nextBossIndex + 1}/4)
            </span>
          )}
        </div>

        {/* Continue prompt */}
        <div className={`text-center transition-opacity duration-500 ${canContinue ? "opacity-100" : "opacity-0"}`}>
          <span className="retro-pixel-text text-sm md:text-base animate-pulse" style={{ color: "hsl(0, 0%, 70%)" }}>
            {isLastBoss ? "🖱️ CLICK TO FINISH" : "🖱️ CLICK TO CONTINUE"}
          </span>
        </div>
      </div>
    </div>
  );
};

// Helper component for stat rows
const StatRow = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
  <div className="flex justify-between items-center">
    <span className="retro-pixel-text text-xs md:text-sm" style={{ color: "hsl(0, 0%, 70%)" }}>
      {label}:
    </span>
    <span className="retro-pixel-text text-sm md:text-base font-bold" style={{ color, textShadow: `0 0 8px ${color}` }}>
      {value}
    </span>
  </div>
);
