import { useState, useEffect } from "react";
import { Button } from "./ui/button";

interface HighScoreEntryProps {
  score: number;
  level: number;
  onSubmit: (name: string) => void;
  qualifiedLeaderboards?: {
    daily: boolean;
    weekly: boolean;
    allTime: boolean;
  };
  defaultName?: string;
}

export const HighScoreEntry = ({ score, level, onSubmit, qualifiedLeaderboards, defaultName }: HighScoreEntryProps) => {
  const [name, setName] = useState(defaultName ?? "");
  const [displayScore, setDisplayScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevent game keyboard shortcuts from interfering with input
  useEffect(() => {
    const preventGameShortcuts = (e: KeyboardEvent) => {
      // If the event target is the input field, don't let it propagate
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') {
        // Prevent specific game keys from triggering their actions
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
    e.stopPropagation(); // Stop propagation to prevent game shortcuts
    if (e.key === "Enter" && name.length === 3) {
      handleSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // Stop propagation for all key presses in the input
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

  return (
    <div className="retro-border bg-slate-900/95 rounded-lg p-6 sm:p-12 w-full max-w-2xl max-h-[85vh] overflow-y-auto text-center animate-scale-in relative">
      {/* Animated glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 animate-pulse pointer-events-none" />
      
      {/* Rotating glow rings */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border-4 border-cyan-400/30 rounded-full animate-spin" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border-4 border-purple-400/30 rounded-full animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
      </div>
      
      {/* Content with relative positioning */}
      <div className="relative z-10">
        {/* Trophy Icon */}
        <div className="flex justify-center mb-4">
          <div className="text-8xl animate-bounce">
            🏆
          </div>
        </div>
        
        <h2 className="text-6xl font-bold mb-2 font-mono relative">
          <span className="retro-title inline-block animate-pulse">HIGH SCORE!</span>
          <span className="absolute -top-2 -left-4 text-yellow-400 animate-ping">✨</span>
          <span className="absolute -top-2 -right-4 text-yellow-400 animate-ping" style={{ animationDelay: '0.5s' }}>✨</span>
        </h2>
        
        {/* Qualification badges */}
        {qualifiedLeaderboards && (
          <div className="mb-4">
            <div className="text-xl text-pink-300 mb-2 font-mono">YOU QUALIFIED FOR:</div>
            <div className="flex justify-center gap-4 flex-wrap">
              {qualifiedLeaderboards.daily && (
                <div className="px-4 py-2 bg-cyan-500/20 border-2 border-cyan-400 rounded-lg animate-pulse">
                  <span className="text-2xl font-bold font-mono text-cyan-300">📅 DAILY</span>
                </div>
              )}
              {qualifiedLeaderboards.weekly && (
                <div className="px-4 py-2 bg-purple-500/20 border-2 border-purple-400 rounded-lg animate-pulse" style={{ animationDelay: '0.2s' }}>
                  <span className="text-2xl font-bold font-mono text-purple-300">📆 WEEKLY</span>
                </div>
              )}
              {qualifiedLeaderboards.allTime && (
                <div className="px-4 py-2 bg-amber-500/20 border-2 border-amber-400 rounded-lg animate-pulse" style={{ animationDelay: '0.4s' }}>
                  <span className="text-2xl font-bold font-mono text-amber-300">🌟 ALL-TIME</span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="text-4xl text-cyan-300 mb-4 font-mono font-bold animate-pulse">
          {displayScore.toLocaleString()} POINTS
        </div>
        <div className="text-2xl text-purple-400 mb-8 font-mono">
          LEVEL {level}
        </div>
        
        <div className="mb-8">
          <label className="block text-pink-400 mb-4 font-mono text-2xl tracking-wider">
            ENTER YOUR INITIALS:
          </label>
          <input
            type="text"
            value={name}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onKeyDown={handleKeyDown}
            onFocus={(e) => {
              // Auto-scroll input into view on mobile when keyboard appears
              setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            }}
            maxLength={3}
            placeholder="___"
            autoFocus
            autoComplete="off"
            className="w-64 text-center text-6xl font-bold font-mono bg-slate-800 text-cyan-300 border-4 border-cyan-500 rounded-lg px-6 py-4 focus:outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/50 uppercase tracking-widest animate-pulse"
          />
        </div>
        
        <Button
          onClick={handleSubmit}
          disabled={name.length !== 3 || isSubmitting}
          className="px-12 py-6 text-2xl font-bold font-mono bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed retro-button"
        >
          {isSubmitting ? "SUBMITTING..." : "SUBMIT SCORE"}
        </Button>
        
        {/* Extra space for mobile keyboard scrolling */}
        <div className="h-[50vh] sm:h-0" />
      </div>
    </div>
  );
};
