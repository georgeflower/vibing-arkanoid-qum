import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting by IP (resets on cold start, but good enough)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10_000; // 10 seconds between submissions per IP

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const now = Date.now();
    const lastSubmission = rateLimitMap.get(ip);
    
    if (lastSubmission && now - lastSubmission < RATE_LIMIT_MS) {
      const remaining = Math.ceil((RATE_LIMIT_MS - (now - lastSubmission)) / 1000);
      return new Response(
        JSON.stringify({ error: `Rate limited. Wait ${remaining} seconds.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { type, player_name, score, level, completion_time_ms, boss_level, difficulty, beat_level_50, collected_all_letters, starting_lives, game_mode, user_id } = body;

    // Validate type
    if (type !== "high_score" && type !== "boss_rush") {
      return new Response(
        JSON.stringify({ error: "Invalid score type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate player_name
    if (!player_name || typeof player_name !== "string" || player_name.length < 1 || player_name.length > 10) {
      return new Response(
        JSON.stringify({ error: "Invalid player name (1-10 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow alphanumeric names
    if (!/^[A-Za-z0-9]+$/.test(player_name)) {
      return new Response(
        JSON.stringify({ error: "Player name must be alphanumeric" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate score
    if (typeof score !== "number" || score < 0 || score > 10_000_000) {
      return new Response(
        JSON.stringify({ error: "Invalid score" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let insertError;

    if (type === "high_score") {
      if (typeof level !== "number" || level < 0 || level > 100) {
        return new Response(
          JSON.stringify({ error: "Invalid level" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const insertData: Record<string, any> = {
        player_name,
        score,
        level,
        difficulty: typeof difficulty === "string" ? difficulty.slice(0, 20) : null,
        beat_level_50: typeof beat_level_50 === "boolean" ? beat_level_50 : false,
        collected_all_letters: typeof collected_all_letters === "boolean" ? collected_all_letters : false,
        starting_lives: typeof starting_lives === "number" ? Math.min(Math.max(starting_lives, 1), 10) : 3,
        game_mode: typeof game_mode === "string" ? game_mode.slice(0, 20) : "campaign",
      };
      if (typeof user_id === "string" && user_id.length > 0 && user_id.length <= 36) {
        insertData.user_id = user_id;
      }
      const { error } = await supabase.from("high_scores").insert(insertData);
      insertError = error;
    } else {
      if (typeof completion_time_ms !== "number" || completion_time_ms < 0 || completion_time_ms > 86_400_000) {
        return new Response(
          JSON.stringify({ error: "Invalid completion time" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase.from("boss_rush_scores").insert({
        player_name,
        score,
        completion_time_ms,
        boss_level: typeof boss_level === "number" ? Math.min(Math.max(boss_level, 1), 20) : 5,
      });
      insertError = error;
    }

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit score" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record rate limit
    rateLimitMap.set(ip, now);

    // Clean old entries periodically
    if (rateLimitMap.size > 1000) {
      for (const [key, time] of rateLimitMap) {
        if (now - time > RATE_LIMIT_MS * 10) rateLimitMap.delete(key);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
