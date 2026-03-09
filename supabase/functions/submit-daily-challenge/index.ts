import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Daily challenge achievement checks
const DAILY_ACHIEVEMENT_CHECKS: Array<{
  id: string;
  check: (p: { streak: number; total: number; allMet: boolean }) => boolean;
}> = [
  { id: "daily_warrior", check: (p) => p.total >= 1 },
  { id: "streak_3", check: (p) => p.streak >= 3 },
  { id: "streak_7", check: (p) => p.streak >= 7 },
  { id: "streak_30", check: (p) => p.streak >= 30 },
  { id: "daily_perfectionist", check: (p) => p.allMet },
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
      challengeDate,
      score = 0,
      timeSeconds = 0,
      objectivesMet = [],
      allObjectivesMet = false,
      playerName,
    } = body;

    // Validate
    if (!challengeDate || typeof score !== "number" || typeof timeSeconds !== "number") {
      return new Response(JSON.stringify({ error: "Invalid data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already completed today
    const { data: existing } = await supabaseAdmin
      .from("daily_challenge_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("challenge_date", challengeDate)
      .single();

    if (existing) {
      // Already completed - still return daily scores
      const { data: dailyScores } = await supabaseAdmin
        .from("daily_challenge_scores")
        .select("player_name, score, time_seconds, objectives_met, all_objectives_met")
        .eq("challenge_date", challengeDate)
        .order("score", { ascending: false })
        .limit(3);

      return new Response(JSON.stringify({ 
        error: "Already completed today", 
        alreadyCompleted: true,
        dailyScores: dailyScores || [],
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert completion
    const { error: insertError } = await supabaseAdmin
      .from("daily_challenge_completions")
      .insert({
        user_id: userId,
        challenge_date: challengeDate,
        score,
        time_seconds: timeSeconds,
        objectives_met: objectivesMet,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save completion" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve player name from profile if not provided
    let resolvedName = playerName || "???";
    if (!playerName) {
      const { data: profile } = await supabaseAdmin
        .from("player_profiles")
        .select("display_name, initials")
        .eq("user_id", userId)
        .single();
      if (profile) {
        resolvedName = profile.initials || profile.display_name || "???";
      }
    }

    // Insert into daily_challenge_scores (top 3 per day)
    const { data: existingScores } = await supabaseAdmin
      .from("daily_challenge_scores")
      .select("id, score")
      .eq("challenge_date", challengeDate)
      .order("score", { ascending: false });

    const currentScores = existingScores || [];

    if (currentScores.length < 3) {
      // Less than 3 scores, just insert
      await supabaseAdmin.from("daily_challenge_scores").insert({
        challenge_date: challengeDate,
        player_name: resolvedName,
        user_id: userId,
        score,
        time_seconds: timeSeconds,
        objectives_met: objectivesMet,
        all_objectives_met: allObjectivesMet,
      });
    } else {
      // Check if this score beats the lowest
      const lowestScore = currentScores[currentScores.length - 1];
      if (score > lowestScore.score) {
        // Delete the lowest and insert new
        await supabaseAdmin
          .from("daily_challenge_scores")
          .delete()
          .eq("id", lowestScore.id);
        await supabaseAdmin.from("daily_challenge_scores").insert({
          challenge_date: challengeDate,
          player_name: resolvedName,
          user_id: userId,
          score,
          time_seconds: timeSeconds,
          objectives_met: objectivesMet,
          all_objectives_met: allObjectivesMet,
        });
      }
    }

    // Fetch profile for streak calculation
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("player_profiles")
      .select("daily_challenge_streak, best_daily_streak, total_daily_challenges_completed, last_daily_challenge_date, achievements")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      const { data: dailyScores } = await supabaseAdmin
        .from("daily_challenge_scores")
        .select("player_name, score, time_seconds, objectives_met, all_objectives_met")
        .eq("challenge_date", challengeDate)
        .order("score", { ascending: false })
        .limit(3);

      return new Response(JSON.stringify({ success: true, streak: 0, newAchievements: 0, dailyScores: dailyScores || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate streak
    const today = new Date(challengeDate);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = 1;
    if (profile.last_daily_challenge_date === yesterdayStr) {
      newStreak = profile.daily_challenge_streak + 1;
    } else if (profile.last_daily_challenge_date === challengeDate) {
      newStreak = profile.daily_challenge_streak;
    }

    const newBestStreak = Math.max(profile.best_daily_streak, newStreak);
    const newTotal = profile.total_daily_challenges_completed + 1;

    // Check achievements
    const existingAchievements = (profile.achievements as Array<{ id: string; unlockedAt: string }>) || [];
    const existingIds = new Set(existingAchievements.map((a) => a.id));
    const newAchievements = [...existingAchievements];

    for (const ach of DAILY_ACHIEVEMENT_CHECKS) {
      if (!existingIds.has(ach.id) && ach.check({ streak: newStreak, total: newTotal, allMet: allObjectivesMet })) {
        newAchievements.push({ id: ach.id, unlockedAt: new Date().toISOString() });
      }
    }

    const newlyUnlocked = newAchievements.length - existingAchievements.length;

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from("player_profiles")
      .update({
        daily_challenge_streak: newStreak,
        best_daily_streak: newBestStreak,
        total_daily_challenges_completed: newTotal,
        last_daily_challenge_date: challengeDate,
        achievements: newAchievements,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
    }

    // Fetch final daily scores
    const { data: dailyScores } = await supabaseAdmin
      .from("daily_challenge_scores")
      .select("player_name, score, time_seconds, objectives_met, all_objectives_met")
      .eq("challenge_date", challengeDate)
      .order("score", { ascending: false })
      .limit(3);

    return new Response(
      JSON.stringify({ success: true, streak: newStreak, newAchievements: newlyUnlocked, dailyScores: dailyScores || [] }),
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
