import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Achievement definitions (mirrored server-side for validation)
const ACHIEVEMENT_CHECKS: Array<{
  id: string;
  check: (p: Record<string, unknown>) => boolean;
}> = [
  { id: "first_blood", check: (p) => (p.total_bricks_destroyed as number) >= 1 },
  { id: "brick_breaker", check: (p) => (p.total_bricks_destroyed as number) >= 1000 },
  { id: "demolition_expert", check: (p) => (p.total_bricks_destroyed as number) >= 10000 },
  { id: "boss_slayer", check: (p) => (p.total_bosses_killed as number) >= 10 },
  { id: "marathon", check: (p) => (p.total_time_played_seconds as number) >= 3600 },
  { id: "high_roller", check: (p) => (p.best_score as number) >= 100000 },
  { id: "power_collector", check: (p) => Object.keys((p.power_up_usage as Record<string, number>) || {}).length >= 12 },
  { id: "perfect_combo", check: (p) => (p.best_combo_streak as number) >= 10 },
  { id: "victory_lap", check: (p) => (p.best_level as number) >= 20 },
  { id: "qumran_collector", check: (p) => (p._session_collected_all_letters as boolean) === true },
  { id: "godlike", check: (p) => (p.best_level as number) >= 20 && (p._session_difficulty as string) === "godlike" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const body = await req.json();
    const {
      bricksDestroyed = 0,
      enemiesKilled = 0,
      bossesKilled = 0,
      powerUpsCollected = 0,
      powerUpTypes = [],
      timePlayed = 0,
      score = 0,
      level = 0,
      comboStreak = 0,
      difficulty = "normal",
      collectedAllLetters = false,
    } = body;

    // Validate inputs
    if (typeof bricksDestroyed !== "number" || typeof score !== "number") {
      return new Response(JSON.stringify({ error: "Invalid stats" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current profile
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("player_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (fetchError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate new stats
    const newBricks = profile.total_bricks_destroyed + bricksDestroyed;
    const newEnemies = profile.total_enemies_killed + enemiesKilled;
    const newBosses = profile.total_bosses_killed + bossesKilled;
    const newPowerUps = profile.total_power_ups_collected + powerUpsCollected;
    const newGamesPlayed = profile.total_games_played + 1;
    const newTimePlayed = profile.total_time_played_seconds + timePlayed;
    const newBestScore = Math.max(profile.best_score, score);
    const newBestLevel = Math.max(profile.best_level, level);
    const newBestCombo = Math.max(profile.best_combo_streak, comboStreak);

    // Update power-up usage
    const currentUsage = (profile.power_up_usage as Record<string, number>) || {};
    const newUsage = { ...currentUsage };
    for (const type of powerUpTypes) {
      if (typeof type === "string") {
        newUsage[type] = (newUsage[type] || 0) + 1;
      }
    }

    // Calculate favorite power-up
    let favoritePowerUp: string | null = null;
    let maxUsage = 0;
    for (const [type, count] of Object.entries(newUsage)) {
      if (count > maxUsage) {
        maxUsage = count;
        favoritePowerUp = type;
      }
    }

    // Check achievements
    const existingAchievements = (profile.achievements as Array<{ id: string; unlockedAt: string }>) || [];
    const existingIds = new Set(existingAchievements.map((a) => a.id));

    const profileForCheck: Record<string, unknown> = {
      total_bricks_destroyed: newBricks,
      total_enemies_killed: newEnemies,
      total_bosses_killed: newBosses,
      total_power_ups_collected: newPowerUps,
      total_games_played: newGamesPlayed,
      total_time_played_seconds: newTimePlayed,
      best_score: newBestScore,
      best_level: newBestLevel,
      best_combo_streak: newBestCombo,
      power_up_usage: newUsage,
      _session_difficulty: difficulty,
      _session_collected_all_letters: collectedAllLetters,
    };

    const newAchievements = [...existingAchievements];
    const newlyUnlockedIds: string[] = [];
    for (const achievement of ACHIEVEMENT_CHECKS) {
      if (!existingIds.has(achievement.id) && achievement.check(profileForCheck)) {
        newAchievements.push({
          id: achievement.id,
          unlockedAt: new Date().toISOString(),
        });
        newlyUnlockedIds.push(achievement.id);
      }
    }

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from("player_profiles")
      .update({
        total_bricks_destroyed: newBricks,
        total_enemies_killed: newEnemies,
        total_bosses_killed: newBosses,
        total_power_ups_collected: newPowerUps,
        total_games_played: newGamesPlayed,
        total_time_played_seconds: newTimePlayed,
        best_score: newBestScore,
        best_level: newBestLevel,
        best_combo_streak: newBestCombo,
        power_up_usage: newUsage,
        favorite_power_up: favoritePowerUp,
        achievements: newAchievements,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, newAchievements: newlyUnlockedIds }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
