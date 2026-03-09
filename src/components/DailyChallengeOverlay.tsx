import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
import { soundManager } from "@/utils/sounds";
import { supabase } from "@/integrations/supabase/client";
import { getDailyChallenge, getTodayString, getShapeIcon, type DailyChallenge } from "@/utils/dailyChallenge";
import { fetchDailyChallengeScores, type DailyChallengeScoreEntry } from "@/utils/dailyChallengeSubmit";
import { DailyChallengeArchive } from "./DailyChallengeArchive";

interface DailyChallengeOverlayProps {
  onPlay: (challenge: DailyChallenge) => void;
  onClose: () => void;
}

export const DailyChallengeOverlay = ({ onPlay, onClose }: DailyChallengeOverlayProps) => {
  const [challenge] = useState(() => getDailyChallenge());
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [todayScores, setTodayScores] = useState<DailyChallengeScoreEntry[]>([]);

  useEffect(() => {
    const checkCompletion = async () => {
      const todayStr = getTodayString();

      // Fetch today's scores (public, no auth needed)
      fetchDailyChallengeScores(todayStr).then(setTodayScores);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: completion } = await (supabase as any)
          .from("daily_challenge_completions")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("challenge_date", todayStr)
          .maybeSingle();

        if (completion) setAlreadyCompleted(true);

        const { data: profile } = await (supabase as any)
          .from("player_profiles")
          .select("daily_challenge_streak")
          .eq("user_id", session.user.id)
          .single();

        if (profile) setStreak((profile as any).daily_challenge_streak || 0);
      }
      setLoading(false);
    };
    checkCompletion();
  }, []);

  if (showArchive) {
    return (
      <DailyChallengeArchive
        onPlay={onPlay}
        onClose={() => setShowArchive(false)}
      />
    );
  }

  const shapeIcon = getShapeIcon(challenge.shapeName);

  return (
    <div className="fixed inset-0 w-full h-screen bg-gradient-to-b from-[hsl(220,25%,12%)] to-[hsl(220,30%,8%)] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-fade-in z-50">
      <Card className="relative w-full max-w-md p-6 bg-[hsl(220,20%,15%)] border-[hsl(45,100%,50%)]">
        <button
          onClick={() => { soundManager.playMenuClick(); onClose(); }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
          title="Close"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <h2
            className="retro-pixel-text text-xl mb-1"
            style={{ color: "hsl(45, 100%, 50%)", textShadow: "0 0 15px hsl(45,100%,50%,0.5)" }}
          >
            ⚡ DAILY CHALLENGE
          </h2>
          <p className="text-xs" style={{ color: "hsl(0,0%,50%)" }}>
            {challenge.dateString}
          </p>
        </div>

        {/* Shape Name */}
        <div className="text-center mb-4 p-3 rounded" style={{ background: "hsl(220,20%,20%)", border: "2px solid hsl(45,100%,40%)" }}>
          {challenge.isBossChallenge ? (
            <>
              <p className="retro-pixel-text text-lg" style={{ color: "hsl(0, 70%, 55%)" }}>
                👹 BOSS CHALLENGE
              </p>
              <p className="text-sm mt-1" style={{ color: "hsl(0,0%,80%)" }}>
                {shapeIcon} {challenge.shapeName.replace("Saturday Boss: ", "")} Boss
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold" style={{ color: "hsl(45,100%,50%)", letterSpacing: "1px" }}>
                TODAY'S SHAPE
              </p>
              <p className="retro-pixel-text text-lg mt-1" style={{ color: "hsl(0,0%,90%)" }}>
                {shapeIcon} {challenge.shapeName}
              </p>
            </>
          )}
        </div>

        {/* Streak */}
        {!loading && streak > 0 && (
          <div className="text-center mb-4 p-2 rounded" style={{ background: "hsl(30,80%,20%)", border: "1px solid hsl(30,80%,40%)" }}>
            <span className="retro-pixel-text text-sm" style={{ color: "hsl(30,100%,60%)" }}>
              🔥 {streak} Day Streak
            </span>
          </div>
        )}

        {/* Modifier */}
        <div className="mb-4 p-3 rounded" style={{ background: "hsl(220,20%,20%)", border: "1px solid hsl(200,70%,30%)" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "hsl(200,70%,50%)", letterSpacing: "1px" }}>
            MODIFIER
          </p>
          <p className="text-sm font-bold" style={{ color: "hsl(0,0%,90%)" }}>
            {challenge.modifier.label}
          </p>
          <p className="text-xs" style={{ color: "hsl(0,0%,60%)" }}>
            {challenge.modifier.description}
          </p>
        </div>

        {/* Objectives */}
        <div className="mb-4">
          <p className="text-xs font-bold mb-2" style={{ color: "hsl(45,100%,50%)", letterSpacing: "1px" }}>
            OBJECTIVES
          </p>
          <div className="space-y-2">
            {challenge.objectives.map((obj) => (
              <div
                key={obj.id}
                className="flex items-center gap-2 p-2 rounded"
                style={{ background: "hsl(220,20%,18%)", border: "1px solid hsl(0,0%,20%)" }}
              >
                <span style={{ fontSize: "18px" }}>{obj.icon}</span>
                <div>
                  <p className="text-xs font-bold" style={{ color: "hsl(0,0%,90%)" }}>
                    {obj.label}
                  </p>
                  <p className="text-xs" style={{ color: "hsl(0,0%,50%)" }}>
                    {obj.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="mb-4 text-center">
          <p className="text-xs" style={{ color: "hsl(0,0%,45%)" }}>
            Lives: {challenge.startingLives} • 
            {challenge.timeLimit > 0 ? ` Time Limit: ${Math.floor(challenge.timeLimit / 60)}m ${challenge.timeLimit % 60}s` : " No time limit"}
          </p>
        </div>

        {/* Completed status */}
        {alreadyCompleted && (
          <div className="mb-4 text-center p-2 rounded" style={{ background: "hsl(120,30%,18%)", border: "1px solid hsl(120,50%,30%)" }}>
            <p className="retro-pixel-text text-sm" style={{ color: "hsl(120,60%,50%)" }}>
              ✅ COMPLETED TODAY
            </p>
            <p className="text-xs mt-1" style={{ color: "hsl(0,0%,50%)" }}>
              Come back tomorrow for a new challenge!
            </p>
          </div>
        )}

        {/* Play button */}
        <Button
          onClick={() => {
            soundManager.playMenuClick();
            onPlay(challenge);
          }}
          disabled={loading}
          className="w-full text-white text-lg py-4 bg-[hsl(45,100%,45%)] hover:bg-[hsl(45,100%,55%)]"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          {alreadyCompleted ? "Play Again (no rewards)" : challenge.isBossChallenge ? "FIGHT BOSS" : "PLAY CHALLENGE"}
        </Button>

        {/* Past Challenges button */}
        <Button
          onClick={() => { soundManager.playMenuClick(); setShowArchive(true); }}
          onMouseEnter={() => soundManager.playMenuHover()}
          variant="outline"
          className="w-full mt-2 border-[hsl(45,100%,40%)] text-[hsl(45,100%,50%)] hover:bg-[hsl(45,100%,40%)] hover:text-white"
        >
          📜 Past Challenges
        </Button>

        <Button
          onClick={() => { soundManager.playMenuClick(); onClose(); }}
          onMouseEnter={() => soundManager.playMenuHover()}
          variant="outline"
          className="w-full mt-2 border-[hsl(200,70%,50%)] text-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,50%)] hover:text-white"
        >
          Back to Menu
        </Button>
      </Card>
    </div>
  );
};
