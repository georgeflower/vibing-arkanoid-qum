import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LeaderboardType = 'all-time' | 'weekly' | 'daily';
export type DifficultyFilter = 'all' | 'normal' | 'godlike';

export interface ProfileLink {
  username: string;
  avatar_url: string | null;
}

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
  userId?: string | null;
  profileLink?: ProfileLink | null;
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

      let query = supabase
        .from('high_scores')
        .select('*')
        .order('score', { ascending: false })
        .limit(MAX_HIGH_SCORES);

      if (difficultyFilter === 'godlike') {
        query = query.eq('difficulty', 'godlike');
      } else if (difficultyFilter === 'normal') {
        query = query.or('difficulty.is.null,difficulty.neq.godlike');
      }

      if (leaderboardType === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('created_at', weekAgo.toISOString());
      } else if (leaderboardType === 'daily') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('created_at', today.toISOString());
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const scores: HighScore[] = (data || []).map(row => ({
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
        userId: row.user_id || null,
      }));

      // Batch-fetch public profiles for scores with user_ids
      const userIds = [...new Set(scores.filter(s => s.userId).map(s => s.userId!))];
      let profileMap = new Map<string, ProfileLink>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('player_profiles')
          .select('user_id, username, avatar_url, is_public')
          .in('user_id', userIds)
          .eq('is_public', true);

        if (profiles) {
          for (const p of profiles) {
            if (p.username) {
              profileMap.set(p.user_id, {
                username: p.username,
                avatar_url: (p as any).avatar_url || null,
              });
            }
          }
        }
      }

      // Attach profile links
      for (const score of scores) {
        score.profileLink = score.userId ? (profileMap.get(score.userId) || null) : null;
      }

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

  const isHighScore = async (score: number): Promise<boolean> => {
    if (score <= 0) return false;
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const { count: dailyHigherCount, error: dailyError } = await supabase
        .from('high_scores')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .gte('score', score);
      if (dailyError) throw dailyError;
      if ((dailyHigherCount || 0) < MAX_HIGH_SCORES) return true;

      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: weeklyHigherCount, error: weeklyError } = await supabase
        .from('high_scores')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString())
        .gte('score', score);
      if (weeklyError) throw weeklyError;
      if ((weeklyHigherCount || 0) < MAX_HIGH_SCORES) return true;

      const { count: allTimeHigherCount, error: allTimeError } = await supabase
        .from('high_scores')
        .select('*', { count: 'exact', head: true })
        .gte('score', score);
      if (allTimeError) throw allTimeError;
      return (allTimeHigherCount || 0) < MAX_HIGH_SCORES;
    } catch (err) {
      console.error('Failed to check high score:', err);
      return false;
    }
  };

  const getQualifiedLeaderboards = async (score: number): Promise<LeaderboardQualification> => {
    if (score <= 0) return { daily: false, weekly: false, allTime: false };
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const { count: dailyHigherCount } = await supabase
        .from('high_scores')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .gte('score', score);
      const dailyQualifies = (dailyHigherCount || 0) < MAX_HIGH_SCORES;

      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: weeklyHigherCount } = await supabase
        .from('high_scores')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString())
        .gte('score', score);
      const weeklyQualifies = (weeklyHigherCount || 0) < MAX_HIGH_SCORES;

      const { count: allTimeHigherCount } = await supabase
        .from('high_scores')
        .select('*', { count: 'exact', head: true })
        .gte('score', score);
      const allTimeQualifies = (allTimeHigherCount || 0) < MAX_HIGH_SCORES;

      return { daily: dailyQualifies, weekly: weeklyQualifies, allTime: allTimeQualifies };
    } catch (err) {
      console.error('Failed to check qualified leaderboards:', err);
      return { daily: false, weekly: false, allTime: false };
    }
  };

  const fetchTopScores = async (): Promise<TopScores> => {
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const { data: dailyData } = await supabase
        .from('high_scores')
        .select('player_name, score')
        .gte('created_at', today.toISOString())
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();

      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weeklyData } = await supabase
        .from('high_scores')
        .select('player_name, score')
        .gte('created_at', weekAgo.toISOString())
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: allTimeData } = await supabase
        .from('high_scores')
        .select('player_name, score')
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        daily: dailyData ? { name: dailyData.player_name, score: dailyData.score } : null,
        weekly: weeklyData ? { name: weeklyData.player_name, score: weeklyData.score } : null,
        allTime: allTimeData ? { name: allTimeData.player_name, score: allTimeData.score } : null,
      };
    } catch (err) {
      console.error('Failed to fetch top scores:', err);
      return { daily: null, weekly: null, allTime: null };
    }
  };

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

      // Get current user id if logged in
      let currentUserId: string | undefined;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) currentUserId = session.user.id;
      } catch {}

      const response = await supabase.functions.invoke('submit-score', {
        body: {
          type: 'high_score',
          player_name: name,
          score,
          level,
          difficulty,
          beat_level_50: beatLevel50,
          collected_all_letters: collectedAllLetters,
          starting_lives: startingLives,
          game_mode: gameMode,
          user_id: currentUserId,
        },
      });

      if (response.error) throw response.error;
      const result = response.data as { error?: string };
      if (result?.error) throw new Error(result.error);

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
