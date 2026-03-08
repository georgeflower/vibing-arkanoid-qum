import { supabase } from "@/integrations/supabase/client";

export interface DailyChallengeSubmission {
  challengeDate: string;
  score: number;
  timeSeconds: number;
  objectivesMet: string[];
  allObjectivesMet: boolean;
}

export async function submitDailyChallenge(
  submission: DailyChallengeSubmission
): Promise<{ success: boolean; streak: number; newAchievements: number; alreadyCompleted?: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, streak: 0, newAchievements: 0 };
    }

    const { data, error } = await supabase.functions.invoke("submit-daily-challenge", {
      body: submission,
    });

    if (error) {
      console.error("Failed to submit daily challenge:", error);
      return { success: false, streak: 0, newAchievements: 0 };
    }

    return data as { success: boolean; streak: number; newAchievements: number; alreadyCompleted?: boolean };
  } catch (err) {
    console.error("Error submitting daily challenge:", err);
    return { success: false, streak: 0, newAchievements: 0 };
  }
}
