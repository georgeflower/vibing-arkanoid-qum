import { supabase } from "@/integrations/supabase/client";

export interface DailyChallengeSubmission {
  challengeDate: string;
  score: number;
  timeSeconds: number;
  objectivesMet: string[];
}

export interface DailyChallengeSubmitResult {
  success: boolean;
  streak: number;
  newAchievements: string[];
  alreadyCompleted?: boolean;
}

export async function submitDailyChallenge(
  submission: DailyChallengeSubmission
): Promise<DailyChallengeSubmitResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, streak: 0, newAchievements: [] };
    }

    const { data, error } = await supabase.functions.invoke("submit-daily-challenge", {
      body: submission,
    });

    if (error) {
      console.error("Failed to submit daily challenge:", error);
      return { success: false, streak: 0, newAchievements: [] };
    }

    return {
      success: data?.success ?? false,
      streak: data?.streak ?? 0,
      newAchievements: Array.isArray(data?.newAchievements) ? data.newAchievements : [],
      alreadyCompleted: data?.alreadyCompleted,
    };
  } catch (err) {
    console.error("Error submitting daily challenge:", err);
    return { success: false, streak: 0, newAchievements: [] };
  }
}
