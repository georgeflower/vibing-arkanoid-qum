import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { soundManager } from "@/utils/sounds";
import type { DailyChallenge, DailyChallengeResult } from "@/utils/dailyChallenge";
import type { DailyChallengeScoreEntry } from "@/utils/dailyChallengeSubmit";

interface DailyChallengeResultOverlayProps {
  active: boolean;
  challenge: DailyChallenge;
  result: DailyChallengeResult;
  score: number;
  timeSeconds: number;
  streak: number;
  dailyScores: DailyChallengeScoreEntry[];
  onRetry: () => void;
  onBackToDaily: () => void;
  onReturnToMenu: () => void;
}

export const DailyChallengeResultOverlay = ({
  active,
  challenge,
  result,
  score,
  timeSeconds,
  streak,
  dailyScores,
  onRetry,
  onBackToDaily,
  onReturnToMenu,
}: DailyChallengeResultOverlayProps) => {
  // Release pointer lock when overlay is active
  useEffect(() => {
    if (active && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [active]);

  if (!active) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[200] animate-fade-in">
      <div
        className="max-w-md w-full mx-4 p-6 rounded-lg overflow-y-auto max-h-[90vh]"
        style={{
          background: "linear-gradient(180deg, hsl(220,25%,15%) 0%, hsl(220,30%,10%) 100%)",
          border: result.allObjectivesMet
            ? "3px solid hsl(45,100%,50%)"
            : "3px solid hsl(200,70%,50%)",
          boxShadow: result.allObjectivesMet
            ? "0 0 30px hsl(45,100%,50%,0.3)"
            : "0 0 20px hsl(200,70%,50%,0.2)",
        }}
      >
        {/* Header */}
        <h2
          className="retro-pixel-text text-center text-xl mb-4"
          style={{
            color: result.allObjectivesMet ? "hsl(45, 100%, 50%)" : "hsl(200, 70%, 50%)",
            textShadow: `0 0 15px ${result.allObjectivesMet ? "hsl(45,100%,50%,0.5)" : "hsl(200,70%,50%,0.5)"}`,
          }}
        >
          {result.allObjectivesMet ? "⭐ PERFECT CLEAR ⭐" : "CHALLENGE COMPLETE"}
        </h2>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="text-center p-2 rounded" style={{ background: "hsl(0,0%,12%)" }}>
            <p className="text-xs" style={{ color: "hsl(0,0%,50%)" }}>SCORE</p>
            <p className="retro-pixel-text text-sm" style={{ color: "hsl(0,0%,90%)" }}>
              {score.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-2 rounded" style={{ background: "hsl(0,0%,12%)" }}>
            <p className="text-xs" style={{ color: "hsl(0,0%,50%)" }}>TIME</p>
            <p className="retro-pixel-text text-sm" style={{ color: "hsl(0,0%,90%)" }}>
              {formatTime(timeSeconds)}
            </p>
          </div>
        </div>

        {/* Objectives */}
        <div className="mb-4">
          <p className="text-xs font-bold mb-2" style={{ color: "hsl(45,100%,50%)", letterSpacing: "1px" }}>
            OBJECTIVES
          </p>
          <div className="space-y-2">
            {challenge.objectives.map((obj) => {
              const met = result.objectivesMet.includes(obj.id);
              return (
                <div
                  key={obj.id}
                  className="flex items-center gap-2 p-2 rounded"
                  style={{
                    background: met ? "hsl(120,20%,15%)" : "hsl(0,20%,15%)",
                    border: met ? "1px solid hsl(120,50%,30%)" : "1px solid hsl(0,50%,25%)",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>{met ? "✅" : "❌"}</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: met ? "hsl(120,60%,60%)" : "hsl(0,60%,60%)" }}>
                      {obj.label}
                    </p>
                    <p className="text-xs" style={{ color: "hsl(0,0%,50%)" }}>
                      {obj.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div
            className="text-center mb-4 p-2 rounded"
            style={{
              background: "hsl(30,80%,15%)",
              border: "1px solid hsl(30,80%,40%)",
            }}
          >
            <span className="retro-pixel-text text-sm" style={{ color: "hsl(30,100%,60%)" }}>
              🔥 {streak} Day Streak!
            </span>
          </div>
        )}

        {/* Daily Leaderboard */}
        {dailyScores.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold mb-2" style={{ color: "hsl(200,70%,50%)", letterSpacing: "1px" }}>
              TODAY'S TOP SCORES
            </p>
            <div className="space-y-1">
              {dailyScores.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded"
                  style={{
                    background: idx === 0 ? "hsl(45,30%,15%)" : "hsl(0,0%,12%)",
                    border: idx === 0 ? "1px solid hsl(45,60%,40%)" : "1px solid hsl(0,0%,20%)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="retro-pixel-text text-xs" style={{
                      color: idx === 0 ? "hsl(45,100%,60%)" : idx === 1 ? "hsl(0,0%,75%)" : "hsl(25,60%,50%)",
                    }}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                    </span>
                    <span className="text-xs font-bold" style={{ color: "hsl(0,0%,80%)" }}>
                      {entry.player_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="retro-pixel-text text-xs" style={{ color: "hsl(0,0%,90%)" }}>
                      {entry.score.toLocaleString()}
                    </span>
                    <span className="text-xs" style={{ color: "hsl(0,0%,50%)" }}>
                      {formatTime(entry.time_seconds)}
                    </span>
                    {entry.all_objectives_met && (
                      <span style={{ fontSize: "12px" }}>⭐</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          {!result.allObjectivesMet && (
            <Button
              onClick={() => {
                soundManager.playMenuClick();
                onRetry();
              }}
              onMouseEnter={() => soundManager.playMenuHover()}
              className="w-full text-sm py-3"
              style={{
                background: "hsl(45,80%,45%)",
                color: "hsl(0,0%,10%)",
              }}
            >
              🔄 RETRY (COMPLETE ALL OBJECTIVES)
            </Button>
          )}
          <Button
            onClick={() => {
              soundManager.playMenuClick();
              onBackToDaily();
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className="w-full text-sm py-3"
            style={{
              background: "hsl(200,70%,50%)",
              color: "hsl(0,0%,100%)",
            }}
          >
            📅 DAILY CHALLENGES
          </Button>
          <Button
            onClick={() => {
              soundManager.playMenuClick();
              onReturnToMenu();
            }}
            onMouseEnter={() => soundManager.playMenuHover()}
            className="w-full text-sm py-3"
            variant="ghost"
            style={{
              color: "hsl(0,0%,60%)",
              border: "1px solid hsl(0,0%,25%)",
            }}
          >
            MAIN MENU
          </Button>
        </div>
      </div>
    </div>
  );
};
