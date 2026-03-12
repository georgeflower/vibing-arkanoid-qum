import { Button } from "@/components/ui/button";
import { soundManager } from "@/utils/sounds";
import type { DailyChallenge, DailyChallengeResult } from "@/utils/dailyChallenge";

interface DailyChallengeResultOverlayProps {
  active: boolean;
  challenge: DailyChallenge;
  result: DailyChallengeResult;
  score: number;
  timeSeconds: number;
  streak: number;
  timedOut?: boolean;
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
  timedOut,
  onRetry,
  onBackToDaily,
  onReturnToMenu,
}: DailyChallengeResultOverlayProps) => {
  if (!active) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black/80 z-[200] animate-fade-in p-4">
      <div className="min-h-screen flex items-center justify-center">
      <div
        className="max-w-md w-full p-6 rounded-lg my-6"
        style={{
          background: "linear-gradient(180deg, hsl(220,25%,15%) 0%, hsl(220,30%,10%) 100%)",
          border: timedOut
            ? "3px solid hsl(0,70%,50%)"
            : result.allObjectivesMet
              ? "3px solid hsl(45,100%,50%)"
              : "3px solid hsl(200,70%,50%)",
          boxShadow: timedOut
            ? "0 0 30px hsl(0,70%,50%,0.3)"
            : result.allObjectivesMet
              ? "0 0 30px hsl(45,100%,50%,0.3)"
              : "0 0 20px hsl(200,70%,50%,0.2)",
        }}
      >
        {/* Header */}
        <h2
          className="retro-pixel-text text-center text-xl mb-4"
          style={{
            color: timedOut
              ? "hsl(0, 70%, 55%)"
              : result.allObjectivesMet ? "hsl(45, 100%, 50%)" : "hsl(200, 70%, 50%)",
            textShadow: `0 0 15px ${timedOut ? "hsl(0,70%,50%,0.5)" : result.allObjectivesMet ? "hsl(45,100%,50%,0.5)" : "hsl(200,70%,50%,0.5)"}`,
          }}
        >
          {timedOut ? "⏰ TIME'S UP ⏰" : result.allObjectivesMet ? "⭐ PERFECT CLEAR ⭐" : "CHALLENGE COMPLETE"}
        </h2>

        {timedOut && (
          <div className="text-center mb-4 p-2 rounded" style={{ background: "hsl(0,30%,15%)", border: "1px solid hsl(0,50%,30%)" }}>
            <p className="text-sm" style={{ color: "hsl(0,60%,60%)" }}>
              Challenge failed — time limit exceeded!
            </p>
          </div>
        )}

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
        {!timedOut && (
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
        )}

        {/* Streak */}
        {streak > 0 && !timedOut && (
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

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          {(timedOut || !result.allObjectivesMet) && (
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
              🔄 RETRY
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
    </div>
  );
};
