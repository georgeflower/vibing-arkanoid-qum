import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { toast } from "sonner";

export interface BossRushScore {
  id?: string;
  name: string;
  score: number;
  completionTimeMs: number;
  bossLevel: number;
  createdAt?: string;
}

const MAX_BOSS_RUSH_SCORES = 20;

export const useBossRushScores = () => {
  const [scores, setScores] = useState<BossRushScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScores = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { scores: data } = await apiGet<{ scores: Array<{ id: string; player_name: string; score: number; completion_time_ms: number; boss_level: number; created_at: string }> }>('/api/boss-rush');

      const mappedScores: BossRushScore[] = (data || []).slice(0, MAX_BOSS_RUSH_SCORES).map(row => ({
        id: row.id,
        name: row.player_name,
        score: row.score,
        completionTimeMs: row.completion_time_ms,
        bossLevel: row.boss_level,
        createdAt: row.created_at,
      }));

      setScores(mappedScores);
    } catch (err) {
      console.error('Failed to fetch boss rush scores:', err);
      setError(err instanceof Error ? err.message : 'Failed to load boss rush scores');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  const isTopScore = async (score: number): Promise<boolean> => {
    try {
      const { qualifies } = await apiGet<{ qualifies: boolean }>('/api/boss-rush/qualify', { score });
      return !!qualifies;
    } catch (err) {
      console.error('Failed to check boss rush score:', err);
      return false;
    }
  };

  const addScore = async (name: string, score: number, completionTimeMs: number, bossLevel: number = 20) => {
    try {
      // Rate limiting
      const lastSubmissionKey = 'lastBossRushScoreSubmission';
      const lastSubmission = sessionStorage.getItem(lastSubmissionKey);
      const now = Date.now();

      if (lastSubmission) {
        const timeSince = now - parseInt(lastSubmission, 10);
        const cooldownMs = 30000;

        if (timeSince < cooldownMs) {
          const remaining = Math.ceil((cooldownMs - timeSince) / 1000);
          toast.error(`Please wait ${remaining} seconds before submitting another score`);
          throw new Error('Rate limit exceeded');
        }
      }

      await apiPost('/api/scores', {
        type: 'boss_rush',
        player_name: name,
        score,
        completion_time_ms: completionTimeMs,
        boss_level: bossLevel,
      });

      sessionStorage.setItem(lastSubmissionKey, now.toString());
      toast.success('Boss Rush score submitted!');
      await fetchScores();
    } catch (err) {
      console.error('Failed to add boss rush score:', err);
      if (err instanceof Error && err.message !== 'Rate limit exceeded') {
        toast.error('Failed to submit boss rush score');
      }
      throw err;
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  return {
    scores,
    isLoading,
    error,
    isTopScore,
    addScore,
    refetch: fetchScores,
    formatTime,
  };
};
