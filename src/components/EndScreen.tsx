import endScreenImg from "@/assets/end-screen.png";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";

interface GameStats {
  totalBricksDestroyed: number;
  totalShots: number;
  accuracy: number;
  levelSkipped: boolean;
  finalScore: number;
  finalLevel: number;
  powerUpsCollected?: number;
  bricksDestroyedByTurrets?: number;
  enemiesKilled?: number;
  bossesKilled?: number;
  totalPlayTime?: number; // in seconds
  isVictory?: boolean; // True if player beat level 20
}

interface EndScreenProps {
  onContinue: () => void;
  onReturnToMenu: () => void;
  onRetryLevel?: () => void;
  stats?: GameStats;
}

const useAnimatedCounter = (targetValue: number, duration: number, delay: number = 0) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now() + delay;
    const endTime = startTime + duration;
    
    const animate = () => {
      const now = Date.now();
      
      if (now < startTime) {
        requestAnimationFrame(animate);
        return;
      }
      
      if (now >= endTime) {
        setCount(targetValue);
        return;
      }
      
      const progress = (now - startTime) / duration;
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(targetValue * easeOutQuart));
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }, [targetValue, duration, delay]);
  
  return count;
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  const minText = mins === 1 ? "min" : "mins";
  const secText = secs === 1 ? "second" : "seconds";
  
  return `${mins} ${minText} ${secs} ${secText}`;
};

export const EndScreen = ({ onContinue, onReturnToMenu, onRetryLevel, stats }: EndScreenProps) => {
  // Animate each counter with different speeds and delays
  const animatedScore = useAnimatedCounter(stats?.finalScore ?? 0, 2000, 0);
  const animatedLevel = useAnimatedCounter(stats?.finalLevel ?? 1, 800, 100);
  const animatedBricks = useAnimatedCounter(stats?.totalBricksDestroyed ?? 0, 1500, 200);
  const animatedPowerUps = useAnimatedCounter(stats?.powerUpsCollected ?? 0, 1000, 400);
  const animatedTurretKills = useAnimatedCounter(stats?.bricksDestroyedByTurrets ?? 0, 1300, 500);
  const animatedEnemies = useAnimatedCounter(stats?.enemiesKilled ?? 0, 1400, 600);
  const animatedBosses = useAnimatedCounter(stats?.bossesKilled ?? 0, 900, 700);
  const animatedPlayTime = useAnimatedCounter(stats?.totalPlayTime ?? 0, 1600, 150);
  
  const isVictory = stats?.isVictory === true;
  
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center"
      style={{
        backgroundImage: `url(${endScreenImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className={`text-center bg-black/70 p-4 md:p-8 rounded-lg border-4 ${isVictory ? 'border-yellow-500/70' : 'border-red-500/50'} w-[95vw] md:w-auto max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in`}>
        {isVictory ? (
          <>
            <h1 className="text-3xl md:text-5xl font-bold text-yellow-400 mb-2 animate-pulse">🎉 CONGRATULATIONS! 🎉</h1>
            <h2 className="text-xl md:text-3xl font-bold text-green-400 mb-4 md:mb-6">YOU BEAT THE GAME!</h2>
          </>
        ) : (
          <h1 className="text-3xl md:text-6xl font-bold text-red-500 mb-3 md:mb-6 animate-pulse">GAME OVER</h1>
        )}
        
        {stats?.levelSkipped && (
          <div className="mb-3 md:mb-6 p-2 md:p-4 bg-yellow-900/50 border-2 border-yellow-500 rounded animate-pulse">
            <p className="text-xl md:text-3xl font-bold text-yellow-400">LEVEL SKIPPER!</p>
            <p className="text-sm md:text-xl text-yellow-300">CHEATER - DISQUALIFIED FROM HIGH SCORES</p>
          </div>
        )}
        
        <div className="mb-3 md:mb-6 space-y-1.5 md:space-y-3 text-left">
          <h2 className="text-xl md:text-3xl font-bold text-cyan-400 mb-2 md:mb-4 text-center">STATISTICS</h2>
          
          <div className="flex justify-between text-sm md:text-xl">
            <span className="text-gray-300">Final Score:</span>
            <span className="text-white font-bold">{animatedScore.toString().padStart(6, '0')}</span>
          </div>
          
          <div className="flex justify-between text-sm md:text-xl">
            <span className="text-gray-300">Level Reached:</span>
            <span className="text-white font-bold">{animatedLevel}</span>
          </div>
          
          <div className="flex justify-between text-sm md:text-xl">
            <span className="text-gray-300">Time Played:</span>
            <span className="text-cyan-400 font-bold">{formatTime(animatedPlayTime)}</span>
          </div>
          
          <div className="flex justify-between text-sm md:text-xl">
            <span className="text-gray-300">Bricks Destroyed:</span>
            <span className="text-white font-bold">{animatedBricks}</span>
          </div>
          
          <div className="flex justify-between text-sm md:text-xl">
            <span className="text-gray-300">Power-ups Collected:</span>
            <span className="text-white font-bold">{animatedPowerUps}</span>
          </div>
          
          <div className="flex justify-between text-sm md:text-xl">
            <span className="text-gray-300">Turret Brick Kills:</span>
            <span className="text-white font-bold">{animatedTurretKills}</span>
          </div>
          
          <div className="flex justify-between text-sm md:text-xl">
            <span className="text-gray-300">Enemies Killed:</span>
            <span className="text-white font-bold">{animatedEnemies}</span>
          </div>
          
          <div className="flex justify-between text-sm md:text-xl">
            <span className="text-gray-300">Bosses Defeated:</span>
            <span className="text-white font-bold">{animatedBosses}</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 md:gap-3 mt-4 md:mt-8">
          {onRetryLevel && (
            <Button 
              onClick={onRetryLevel}
              className="w-full text-base md:text-xl py-3 md:py-6 bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              RETRY LEVEL
            </Button>
          )}
          
          <Button 
            onClick={onContinue}
            className="w-full text-base md:text-xl py-3 md:py-6 bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
          >
            HIGH SCORES
          </Button>
          
          <Button 
            onClick={onReturnToMenu}
            variant="outline"
            className="w-full text-base md:text-xl py-3 md:py-6 border-2 border-white/30 text-white font-bold hover:bg-white/10"
          >
            MAIN MENU
          </Button>
        </div>
      </div>
    </div>
  );
};
