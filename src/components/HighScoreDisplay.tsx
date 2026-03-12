import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { useHighScores, type LeaderboardType, type DifficultyFilter } from "@/hooks/useHighScores";
import { useBossRushScores } from "@/hooks/useBossRushScores";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { X } from "lucide-react";

type TabType = 'normal' | 'bossRush';

interface HighScoreDisplayProps {
  onClose: () => void;
  leaderboardType?: LeaderboardType;
  initialTab?: TabType;
}

export const HighScoreDisplay = ({ onClose, leaderboardType = 'all-time', initialTab = 'normal' }: HighScoreDisplayProps) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [selectedType, setSelectedType] = useState<LeaderboardType>(leaderboardType);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const { highScores: currentScores, isLoading: currentLoading } = useHighScores(selectedType, difficultyFilter);
  const { scores: bossRushScores, isLoading: bossRushLoading, formatTime } = useBossRushScores();
  const containerRef = useRef<HTMLDivElement>(null);

  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ("ontouchstart" in window && window.matchMedia("(max-width: 768px)").matches);
  
  useSwipeGesture(containerRef, onClose, { enabled: isMobileDevice });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div ref={containerRef} className="fixed inset-0 w-full h-screen overflow-y-auto swipe-container animate-fade-in bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 w-full h-full flex items-center justify-center p-4">
        <div className="relative z-10 bg-slate-900/90 backdrop-blur-md rounded-lg p-8 border-2 border-cyan-500/50 max-w-3xl w-full animate-scale-in">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-20" title="Close">
            <X size={24} />
          </button>
          
          <h2 className="text-5xl font-bold text-center mb-4 text-cyan-400">HIGH SCORES</h2>
          
          {/* Tab switcher */}
          <div className="flex justify-center gap-2 mb-4">
            <Button onClick={() => setActiveTab('normal')} variant={activeTab === 'normal' ? 'default' : 'outline'}
              className={`px-6 py-2 text-sm font-bold ${activeTab === 'normal' ? 'bg-cyan-600 hover:bg-cyan-500' : ''}`}>
              CAMPAIGN
            </Button>
            <Button onClick={() => setActiveTab('bossRush')} variant={activeTab === 'bossRush' ? 'default' : 'outline'}
              className={`px-6 py-2 text-sm font-bold ${activeTab === 'bossRush' ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 border-0' : 'border-red-500/50 text-red-400 hover:bg-red-500/20'}`}>
              ⚔️ BOSS RUSH
            </Button>
          </div>

          {activeTab === 'normal' && (
            <>
              <div className="flex justify-center gap-2 mb-6">
                <Button onClick={() => setSelectedType('all-time')} variant={selectedType === 'all-time' ? 'default' : 'outline'} className="px-4 py-2 text-sm font-bold">ALL TIME</Button>
                <Button onClick={() => setSelectedType('weekly')} variant={selectedType === 'weekly' ? 'default' : 'outline'} className="px-4 py-2 text-sm font-bold">WEEKLY</Button>
                <Button onClick={() => setSelectedType('daily')} variant={selectedType === 'daily' ? 'default' : 'outline'} className="px-4 py-2 text-sm font-bold">DAILY</Button>
              </div>

              <div className="flex justify-center gap-2 mb-6">
                <Button onClick={() => setDifficultyFilter('all')} variant={difficultyFilter === 'all' ? 'default' : 'outline'} className="px-3 py-1 text-xs font-bold">ALL</Button>
                <Button onClick={() => setDifficultyFilter('normal')} variant={difficultyFilter === 'normal' ? 'default' : 'outline'} className="px-3 py-1 text-xs font-bold">NORMAL</Button>
                <Button onClick={() => setDifficultyFilter('godlike')} variant={difficultyFilter === 'godlike' ? 'default' : 'outline'}
                  className={`px-3 py-1 text-xs font-bold ${difficultyFilter === 'godlike' ? 'bg-red-600 hover:bg-red-500 border-0' : 'border-red-500/50 text-red-400 hover:bg-red-500/20'}`}>
                  🔥 GOD-MODE
                </Button>
              </div>

              <div className="space-y-2 mb-8 max-h-[50vh] overflow-y-auto smooth-scroll custom-scrollbar">
                {currentLoading ? (
                  <div className="text-center text-slate-400 py-12">Loading scores...</div>
                ) : currentScores.length === 0 ? (
                  <div className="text-center text-slate-500 py-12">No scores yet!</div>
                ) : (
                  currentScores.map((entry, index) => (
                    <div key={entry.id || index} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 sm:gap-3 md:gap-4 items-center text-[10px] sm:text-xs md:text-sm lg:text-xl px-2 sm:px-3 md:px-4 py-1 sm:py-2 bg-slate-800/60 rounded-lg border border-cyan-500/30">
                      <span className="text-cyan-300">{index + 1}.</span>
                      
                      <div className="flex flex-col min-w-0">
                        <span className="text-white font-bold flex items-center gap-1 truncate">
                          {entry.beatLevel50 && <span>👑</span>}
                          {entry.profileLink ? (
                            <Link to={`/player/${entry.profileLink.username}`} className="truncate underline hover:text-cyan-300 transition-colors">
                              {entry.name}
                            </Link>
                          ) : (
                            <span className="truncate">{entry.name}</span>
                          )}
                        </span>
                        {entry.difficulty === "godlike" && (
                          <span className="text-red-500 text-[8px] sm:text-[9px] md:text-[10px] font-bold leading-tight">GOD-MODE</span>
                        )}
                        {entry.gameMode === "boss_rush" && (
                          <span className="text-orange-400 text-[8px] sm:text-[9px] md:text-[10px] font-bold leading-tight">BOSS RUSH</span>
                        )}
                      </div>
                      
                      <span className="text-white font-bold text-right tabular-nums">{entry.score.toString().padStart(6, '0')}</span>
                      <span className="text-white text-right whitespace-nowrap">LVL{entry.level}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'bossRush' && (
            <>
              <div className="text-center text-orange-400 text-sm mb-4 font-mono">🏆 BOSS RUSH SCORES 🏆</div>
              <div className="space-y-2 mb-8 max-h-[50vh] overflow-y-auto smooth-scroll custom-scrollbar">
                {bossRushLoading ? (
                  <div className="text-center text-slate-400 py-12">Loading scores...</div>
                ) : bossRushScores.length === 0 ? (
                  <div className="text-center text-slate-500 py-12">No scores yet! Be the first!</div>
                ) : (
                  bossRushScores.map((entry, index) => (
                    <div key={entry.id || index} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-800/60 rounded-lg border border-red-500/30 whitespace-nowrap overflow-x-auto">
                      <span className="text-red-300 font-bold flex-shrink-0 w-6 sm:w-8">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </span>
                      <span className="text-orange-400 font-bold flex-shrink-0 w-10 sm:w-14">{entry.name}</span>
                      <span className="text-amber-300 font-bold tabular-nums flex-1 text-right">{entry.score}</span>
                      <span className="text-cyan-300 tabular-nums flex-shrink-0">⏱️{formatTime(entry.completionTimeMs)}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          <div className="flex justify-center">
            <Button onClick={onClose} className="px-8 py-4 text-xl font-bold">CONTINUE</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
