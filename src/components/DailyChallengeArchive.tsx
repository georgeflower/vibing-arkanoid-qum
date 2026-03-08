import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check } from "lucide-react";
import { soundManager } from "@/utils/sounds";
import { supabase } from "@/integrations/supabase/client";
import { getDailyChallenge, getShapeIcon, type DailyChallenge } from "@/utils/dailyChallenge";

interface DailyChallengeArchiveProps {
  onPlay: (challenge: DailyChallenge) => void;
  onClose: () => void;
}

interface ArchiveEntry {
  date: Date;
  challenge: DailyChallenge;
  completed: boolean;
}

export const DailyChallengeArchive = ({ onPlay, onClose }: DailyChallengeArchiveProps) => {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArchive = async () => {
      // Generate past 90 days of challenges
      const today = new Date();
      const pastChallenges: ArchiveEntry[] = [];

      for (let i = 1; i <= 90; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const challenge = getDailyChallenge(date);
        pastChallenges.push({
          date,
          challenge,
          completed: false,
        });
      }

      // Check completions from database
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: completions } = await (supabase as any)
          .from("daily_challenge_completions")
          .select("challenge_date")
          .eq("user_id", session.user.id);

        if (completions) {
          const completedDates = new Set(
            (completions as Array<{ challenge_date: string }>).map((c) => c.challenge_date)
          );
          for (const entry of pastChallenges) {
            if (completedDates.has(entry.challenge.dateString)) {
              entry.completed = true;
            }
          }
        }
      }

      setEntries(pastChallenges);
      setLoading(false);
    };

    loadArchive();
  }, []);

  const formatDate = (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  };

  return (
    <div className="fixed inset-0 w-full h-screen bg-gradient-to-b from-[hsl(220,25%,12%)] to-[hsl(220,30%,8%)] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-fade-in z-50">
      <Card className="relative w-full max-w-lg p-4 bg-[hsl(220,20%,15%)] border-[hsl(45,100%,50%)] max-h-[90vh] flex flex-col">
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
            className="retro-pixel-text text-lg"
            style={{ color: "hsl(45, 100%, 50%)", textShadow: "0 0 15px hsl(45,100%,50%,0.5)" }}
          >
            📜 PAST CHALLENGES
          </h2>
          <p className="text-xs mt-1" style={{ color: "hsl(0,0%,50%)" }}>
            Last 90 days • Replay any challenge (no rewards)
          </p>
        </div>

        {/* Challenge List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-2">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: "hsl(0,0%,50%)" }}>Loading challenges...</p>
              </div>
            ) : (
              entries.map((entry) => {
                const icon = getShapeIcon(entry.challenge.shapeName);
                const today = isToday(entry.date);

                return (
                  <div
                    key={entry.challenge.dateString}
                    className="flex items-center gap-3 p-3 rounded cursor-pointer transition-all hover:brightness-110"
                    style={{
                      background: today
                        ? "hsl(45,30%,18%)"
                        : "hsl(220,20%,18%)",
                      border: today
                        ? "1px solid hsl(45,100%,40%)"
                        : entry.completed
                          ? "1px solid hsl(120,40%,30%)"
                          : "1px solid hsl(0,0%,20%)",
                    }}
                    onClick={() => {
                      soundManager.playMenuClick();
                      onPlay(entry.challenge);
                    }}
                  >
                    {/* Completion indicator */}
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: entry.completed
                          ? "hsl(120,50%,25%)"
                          : "hsl(0,0%,15%)",
                        border: entry.completed
                          ? "2px solid hsl(120,60%,40%)"
                          : "2px solid hsl(0,0%,25%)",
                      }}
                    >
                      {entry.completed ? (
                        <Check size={16} style={{ color: "hsl(120,60%,60%)" }} />
                      ) : (
                        <span style={{ color: "hsl(0,0%,40%)", fontSize: "12px" }}>—</span>
                      )}
                    </div>

                    {/* Shape icon */}
                    <span style={{ fontSize: "24px" }}>{icon}</span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate" style={{ color: "hsl(0,0%,90%)" }}>
                          {entry.challenge.shapeName}
                        </p>
                        {today && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: "hsl(45,100%,40%)", color: "hsl(0,0%,10%)", fontWeight: "bold" }}
                          >
                            TODAY
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "hsl(0,0%,50%)" }}>
                        {formatDate(entry.date)} • {entry.challenge.modifier.label}
                        {entry.challenge.isBossChallenge && " • 👹 Boss"}
                      </p>
                    </div>

                    {/* Play button */}
                    <Button
                      size="sm"
                      className="flex-shrink-0 text-xs"
                      style={{
                        background: today ? "hsl(45,100%,45%)" : "hsl(200,70%,40%)",
                        color: "white",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        soundManager.playMenuClick();
                        onPlay(entry.challenge);
                      }}
                    >
                      {today ? "PLAY" : "REPLAY"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Back button */}
        <Button
          onClick={() => { soundManager.playMenuClick(); onClose(); }}
          onMouseEnter={() => soundManager.playMenuHover()}
          variant="outline"
          className="w-full mt-3 border-[hsl(200,70%,50%)] text-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,50%)] hover:text-white"
        >
          Back to Today's Challenge
        </Button>
      </Card>
    </div>
  );
};
