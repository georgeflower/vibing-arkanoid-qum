import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, dailySinceIso, weeklySinceIso, fetchHighScoreRows } from "@/lib/api";
import { toast } from "sonner";

export type LeaderboardType = 'all-time' | 'weekly' | 'daily';
export type DifficultyFilter = 'all' | 'normal' | 'godlike';

export interface HighScore {
  id?: string;
  name: string;
  score: number;
  level: number;
  difficulty?: string;
  beatLevel50?: boolean;
  collectedAllLetters?: boolean;
  startingLives?: number;
  createdAt?: string;
  gameMode?: string;
}

const MAX_HIGH_SCORES = 20;

export const useHighScores = (leaderboardType: LeaderboardType = 'all-time', difficultyFilter: DifficultyFilter = 'all') => {
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHighScores = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { scores: rows } = await fetchHighScoreRows(leaderboardType, difficultyFilter);

      const scores: HighScore[] = (rows || []).slice(0, MAX_HIGH_SCORES).map(row => ({
        id: row.id,
        name: row.player_name,
        score: row.score,
        level: row.level,
        difficulty: row.difficulty || undefined,
        beatLevel50: row.beat_level_50 || undefined,
        collectedAllLetters: row.collected_all_letters || undefined,
        startingLives: row.starting_lives || undefined,
        createdAt: row.created_at,
        gameMode: row.game_mode || undefined,
      }));

      setHighScores(scores);
    } catch (err) {
      console.error('Failed to fetch high scores:', err);
      setError(err instanceof Error ? err.message : 'Failed to load high scores');
      toast.error('Failed to load high scores');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHighScores();
  }, [leaderboardType, difficultyFilter]);

  type LeaderboardQualification = {
    daily: boolean;
    weekly: boolean;
    allTime: boolean;
  };

  type TopScores = {
    daily: { name: string; score: number } | null;
    weekly: { name: string; score: number } | null;
    allTime: { name: string; score: number } | null;
  };

  type QualifyResponse = { daily: boolean; weekly: boolean; allTime: boolean };

  const fetchQualification = (score: number) =>
    apiGet<QualifyResponse>("/api/scores/qualify", {
      score,
      dailySince: dailySinceIso(),
      weeklySince: weeklySinceIso(),
    });

  const isHighScore = async (score: number): Promise<boolean> => {
    if (score <= 0) return false;
    try {
      const q = await fetchQualification(score);
      return q.daily || q.weekly || q.allTime;
    } catch (err) {
      console.error('Failed to check high score:', err);
      return false;
    }
  };

  const getQualifiedLeaderboards = async (score: number): Promise<LeaderboardQualification> => {
    if (score <= 0) return { daily: false, weekly: false, allTime: false };
    try {
      const q = await fetchQualification(score);
      return { daily: !!q.daily, weekly: !!q.weekly, allTime: !!q.allTime };
    } catch (err) {
      console.error('Failed to check qualified leaderboards:', err);
      return { daily: false, weekly: false, allTime: false };
    }
  };

  const fetchTopScores = useCallback(async (): Promise<TopScores> => {
    try {
      const top = await apiGet<TopScores>("/api/scores/top", {
        dailySince: dailySinceIso(),
        weeklySince: weeklySinceIso(),
      });
      return {
        daily: top.daily ?? null,
        weekly: top.weekly ?? null,
        allTime: top.allTime ?? null,
      };
    } catch (err) {
      console.error('Failed to fetch top scores:', err);
      return { daily: null, weekly: null, allTime: null };
    }
  }, []);

  const addHighScore = async (
    name: string,
    score: number,
    level: number,
    difficulty?: string,
    beatLevel50?: boolean,
    collectedAllLetters?: boolean,
    startingLives?: number,
    gameMode?: string
  ) => {
    try {
      const lastSubmissionKey = 'lastHighScoreSubmission';
      const lastSubmission = sessionStorage.getItem(lastSubmissionKey);
      const now = Date.now();
      if (lastSubmission) {
        const timeSinceLastSubmission = now - parseInt(lastSubmission, 10);
        const cooldownMs = 30000;
        if (timeSinceLastSubmission < cooldownMs) {
          const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSubmission) / 1000);
          toast.error(`Please wait ${remainingSeconds} seconds before submitting another score`);
          throw new Error('Rate limit exceeded');
        }
      }

      await apiPost('/api/scores', {
        type: 'high_score',
        player_name: name,
        score,
        level,
        difficulty,
        beat_level_50: beatLevel50,
        collected_all_letters: collectedAllLetters,
        starting_lives: startingLives,
        game_mode: gameMode,
      });

      sessionStorage.setItem(lastSubmissionKey, now.toString());
      toast.success('High score submitted!');
      await fetchHighScores();
    } catch (err) {
      console.error('Failed to add high score:', err);
      if (err instanceof Error && err.message !== 'Rate limit exceeded') {
        toast.error('Failed to submit high score');
      }
      throw err;
    }
  };

  const clearHighScores = () => {
    console.warn('clearHighScores: Not available for cloud storage');
    toast.error('Cannot clear cloud high scores');
  };

  return {
    highScores,
    isHighScore,
    addHighScore,
    clearHighScores,
    isLoading,
    error,
    refetch: fetchHighScores,
    getQualifiedLeaderboards,
    fetchTopScores,
  };
};
