import { supabase } from "@/integrations/supabase/client";

export interface GameSessionStats {
  bricksDestroyed: number;
  enemiesKilled: number;
  bossesKilled: number;
  powerUpsCollected: number;
  powerUpTypes: string[];
  timePlayed: number; // seconds
  score: number;
  level: number;
  comboStreak: number;
  difficulty: string;
  isVictory: boolean;
  collectedAllLetters?: boolean;
}

export async function submitGameStats(stats: GameSessionStats): Promise<string[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return []; // Not logged in, skip silently

    const { data, error } = await supabase.functions.invoke("update-profile-stats", {
      body: stats,
    });

    if (error) {
      console.error("Failed to submit game stats:", error);
      return [];
    }

    return Array.isArray(data?.newAchievements) ? data.newAchievements : [];
  } catch (err) {
    console.error("Error submitting game stats:", err);
    return [];
  }
}

export async function getProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("player_profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  if (error) {
    console.error("Failed to fetch profile:", error);
    return null;
  }
  return data;
}
