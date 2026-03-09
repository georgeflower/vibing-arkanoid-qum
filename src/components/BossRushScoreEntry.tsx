import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { BOSS_RUSH_CONFIG } from "@/constants/bossRushConfig";

interface BossRushScoreEntryProps {
  score: number;
  completionTimeMs: number;
  bossLevel: number;
  completed: boolean;
  onSubmit: (name: string) => void;
  defaultName?: string;
}

export const BossRushScoreEntry = ({ score, completionTimeMs, bossLevel, completed, onSubmit, defaultName }: BossRushScoreEntryProps) => {
  const [name, setName] = useState(defaultName ?? "");
  const [displayScore, setDisplayScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format time as M:SS.CC
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const preventGameShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') {
        const gameKeys = ['f', 'F', 'p', 'P', 'm', 'M', 'n', 'N', 'b', 'B', 'Escape'];
        if (gameKeys.includes(e.key)) {
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', preventGameShortcuts, true);
    return () => window.removeEventListener('keydown', preventGameShortcuts, true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 3);
    setName(value);
  };

  const handleSubmit = () => {
    if (name.length === 3 && !isSubmitting) {
      setIsSubmitting(true);
      onSubmit(name);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter" && name.length === 3) {
      handleSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const totalScore = completed ? score + BOSS_RUSH_CONFIG.completionBonus : score;
  const bossName = BOSS_RUSH_CONFIG.bossNames[bossLevel as keyof typeof BOSS_RUSH_CONFIG.bossNames] || `BOSS ${bossLevel}`;

  return (
    <div className="retro-border bg-slate-900/95 rounded-lg p-6 sm:p-12 w-full max-w-2xl max-h-[85vh] overflow-y-auto smooth-scroll text-center animate-scale-in relative">
      <div className={`absolute inset-0 ${completed ? 'bg-gradient-to-br from-red-500/20 via-orange-500/20 to-yellow-500/20' : 'bg-gradient-to-br from-slate-600/20 via-red-500/20 to-slate-600/20'} animate-pulse pointer-events-none`} />

      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border-4 ${completed ? 'border-red-400/30' : 'border-slate-500/30'} rounded-full animate-spin`} style={{ animationDuration: '8s' }} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border-4 ${completed ? 'border-orange-400/30' : 'border-red-500/30'} rounded-full animate-spin`} style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
      </div>

      <div className="relative z-10">
        <div className="flex justify-center mb-4">
          <div className="text-8xl animate-bounce">{completed ? '⚔️' : '💀'}</div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-bold mb-2 font-mono relative">
          {completed ? (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 inline-block animate-pulse">
              BOSS RUSH COMPLETE!
            </span>
          ) : (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-400 via-red-400 to-slate-400 inline-block">
              BOSS RUSH OVER
            </span>
          )}
        </h2>

        {!completed && (
          <div className="text-xl text-purple-400 mb-2 font-mono">
            Reached: {bossName} (Level {bossLevel})
          </div>
        )}

        <div className="text-3xl text-cyan-300 mb-2 font-mono font-bold animate-pulse">
          ⏱️ {formatTime(completionTimeMs)}
        </div>

        {completed ? (
          <>
            <div className="text-2xl text-amber-300 mb-2 font-mono">
              {displayScore.toLocaleString()} + {BOSS_RUSH_CONFIG.completionBonus.toLocaleString()} BONUS
            </div>
            <div className="text-xl text-purple-400 mb-6 font-mono">
              TOTAL: {totalScore.toLocaleString()} POINTS
            </div>
          </>
        ) : (
          <div className="text-2xl text-amber-300 mb-6 font-mono">
            SCORE: {displayScore.toLocaleString()}
          </div>
        )}

        <div className="mb-8">
          <label className="block text-pink-400 mb-4 font-mono text-xl tracking-wider">
            ENTER YOUR INITIALS:
          </label>
          <input
            type="text"
            value={name}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onKeyDown={handleKeyDown}
            onFocus={(e) => {
              setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            }}
            maxLength={3}
            placeholder="___"
            autoFocus
            autoComplete="off"
            className="w-64 text-center text-6xl font-bold font-mono bg-slate-800 text-cyan-300 border-4 border-red-500 rounded-lg px-6 py-4 focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-400/50 uppercase tracking-widest animate-pulse"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={name.length !== 3 || isSubmitting}
          className="px-12 py-6 text-2xl font-bold font-mono bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed retro-button"
        >
          {isSubmitting ? "SUBMITTING..." : "SUBMIT SCORE"}
        </Button>

        <div className="h-[50vh] sm:h-0" />
      </div>
    </div>
  );
};