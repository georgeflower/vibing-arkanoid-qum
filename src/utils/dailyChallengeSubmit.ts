import { supabase } from "@/integrations/supabase/client";

export interface DailyChallengeSubmission {
  challengeDate: string;
  score: number;
  timeSeconds: number;
  objectivesMet: string[];
  allObjectivesMet: boolean;
  playerName?: string;
}

export interface DailyChallengeScoreEntry {
  player_name: string;
  score: number;
  time_seconds: number;
  objectives_met: string[];
  all_objectives_met: boolean;
}

export interface DailyChallengeSubmitResult {
  success: boolean;
  streak: number;
  newAchievements: number;
  alreadyCompleted?: boolean;
  dailyScores: DailyChallengeScoreEntry[];
}

export async function submitDailyChallenge(
  submission: DailyChallengeSubmission
): Promise<DailyChallengeSubmitResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, streak: 0, newAchievements: 0, dailyScores: [] };
    }

    const { data, error } = await supabase.functions.invoke("submit-daily-challenge", {
      body: submission,
    });

    if (error) {
      console.error("Failed to submit daily challenge:", error);
      return { success: false, streak: 0, newAchievements: 0, dailyScores: [] };
    }

    return {
      success: data?.success ?? false,
      streak: data?.streak ?? 0,
      newAchievements: data?.newAchievements ?? 0,
      alreadyCompleted: data?.alreadyCompleted,
      dailyScores: data?.dailyScores ?? [],
    };
  } catch (err) {
    console.error("Error submitting daily challenge:", err);
    return { success: false, streak: 0, newAchievements: 0, dailyScores: [] };
  }
}

export async function fetchDailyChallengeScores(
  challengeDate: string
): Promise<DailyChallengeScoreEntry[]> {
  try {
    const { data, error } = await supabase
      .from("daily_challenge_scores")
      .select("player_name, score, time_seconds, objectives_met, all_objectives_met")
      .eq("challenge_date", challengeDate)
      .order("score", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Failed to fetch daily challenge scores:", error);
      return [];
    }

    return (data || []).map((d: any) => ({
      player_name: d.player_name,
      score: d.score,
      time_seconds: d.time_seconds,
      objectives_met: d.objectives_met || [],
      all_objectives_met: d.all_objectives_met || false,
    }));
  } catch (err) {
    console.error("Error fetching daily challenge scores:", err);
    return [];
  }
}
