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
      // Check if it's a 409 "already completed" response
      if (error.name === "FunctionsHttpError") {
        try {
          const errorBody = error.context && typeof (error as any).context === "object"
            ? (error as any).context
            : null;
          // Try to parse the response body from the error
          const resp = (error as any).response;
          if (resp && typeof resp.json === "function") {
            const parsed = await resp.json();
            if (parsed?.alreadyCompleted) {
              return { success: true, streak: 0, newAchievements: [], alreadyCompleted: true };
            }
          }
        } catch {
          // ignore parse errors
        }
      }
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
