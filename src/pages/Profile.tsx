import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";
import { ACHIEVEMENTS } from "@/constants/achievements";

interface ProfileData {
  display_name: string;
  total_bricks_destroyed: number;
  total_enemies_killed: number;
  total_bosses_killed: number;
  total_power_ups_collected: number;
  total_games_played: number;
  total_time_played_seconds: number;
  best_score: number;
  best_level: number;
  best_combo_streak: number;
  favorite_power_up: string | null;
  power_up_usage: Record<string, number>;
  achievements: Array<{ id: string; unlockedAt: string }>;
  daily_challenge_streak: number;
  best_daily_streak: number;
  total_daily_challenges_completed: number;
}

const formatPlayTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const POWER_UP_LABELS: Record<string, string> = {
  multiball: "Multi-Ball",
  turrets: "Turrets",
  fireball: "Fireball",
  life: "Extra Life",
  slowdown: "Slow Down",
  paddleExtend: "Extend",
  paddleShrink: "Shrink",
  shield: "Shield",
  bossStunner: "Stunner",
  reflectShield: "Reflect",
  homingBall: "Homing",
  secondChance: "2nd Chance",
};

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("player_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error || !data) {
        console.error("Failed to load profile:", error);
        navigate("/auth");
        return;
      }

      setProfile({
        display_name: data.display_name,
        total_bricks_destroyed: data.total_bricks_destroyed,
        total_enemies_killed: data.total_enemies_killed,
        total_bosses_killed: data.total_bosses_killed,
        total_power_ups_collected: data.total_power_ups_collected,
        total_games_played: data.total_games_played,
        total_time_played_seconds: data.total_time_played_seconds,
        best_score: data.best_score,
        best_level: data.best_level,
        best_combo_streak: data.best_combo_streak,
        favorite_power_up: data.favorite_power_up,
        power_up_usage: (data.power_up_usage as Record<string, number>) || {},
        achievements: (data.achievements as Array<{ id: string; unlockedAt: string }>) || [],
        daily_challenge_streak: (data as any).daily_challenge_streak || 0,
        best_daily_streak: (data as any).best_daily_streak || 0,
        total_daily_challenges_completed: (data as any).total_daily_challenges_completed || 0,
      });
      setLoading(false);
    };
    loadProfile();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)" }}
      >
        <p style={{ color: "hsl(200, 70%, 50%)" }} className="retro-pixel-text">LOADING...</p>
      </div>
    );
  }

  if (!profile) return null;

  const unlockedIds = new Set(profile.achievements.map((a) => a.id));

  const statItems = [
    { label: "Games Played", value: profile.total_games_played.toLocaleString() },
    { label: "Time Played", value: formatPlayTime(profile.total_time_played_seconds) },
    { label: "Bricks Destroyed", value: profile.total_bricks_destroyed.toLocaleString() },
    { label: "Enemies Killed", value: profile.total_enemies_killed.toLocaleString() },
    { label: "Bosses Killed", value: profile.total_bosses_killed.toLocaleString() },
    { label: "Power-Ups Collected", value: profile.total_power_ups_collected.toLocaleString() },
    { label: "Best Score", value: profile.best_score.toLocaleString() },
    { label: "Best Level", value: String(profile.best_level) },
    { label: "Best Combo Streak", value: String(profile.best_combo_streak) },
    { label: "Daily Challenges", value: profile.total_daily_challenges_completed.toLocaleString() },
    { label: "Daily Streak", value: `${profile.daily_challenge_streak} (Best: ${profile.best_daily_streak})` },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)",
        overflowY: "auto",
        height: "100vh",
        position: "fixed",
        inset: 0,
      }}
    >
      <CRTOverlay quality="medium" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="amiga-box rounded-lg p-6 mb-6 text-center">
          <h1
            className="retro-pixel-text mb-2"
            style={{ fontSize: "28px", color: "hsl(200, 70%, 50%)", textShadow: "0 0 10px hsl(200,70%,50%,0.5)" }}
          >
            {profile.display_name}
          </h1>
          <p style={{ color: "hsl(0,0%,60%)", fontSize: "12px" }}>PLAYER PROFILE</p>
        </div>

        {/* Favorite Power-Up */}
        {profile.favorite_power_up && (
          <div className="amiga-box rounded-lg p-4 mb-6 text-center">
            <p style={{ color: "hsl(0,0%,60%)", fontSize: "11px", letterSpacing: "2px" }}>FAVORITE POWER-UP</p>
            <p className="retro-pixel-text mt-1" style={{ color: "hsl(330, 100%, 65%)", fontSize: "18px" }}>
              {POWER_UP_LABELS[profile.favorite_power_up] || profile.favorite_power_up}
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="amiga-box rounded-lg p-4 mb-6">
          <h2
            className="retro-pixel-text mb-4 text-center"
            style={{ fontSize: "16px", color: "hsl(30, 75%, 55%)" }}
          >
            LIFETIME STATS
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {statItems.map((stat) => (
              <div key={stat.label} className="text-center p-2 rounded" style={{ background: "hsl(0,0%,15%)" }}>
                <p style={{ color: "hsl(0,0%,50%)", fontSize: "10px", letterSpacing: "1px" }}>
                  {stat.label.toUpperCase()}
                </p>
                <p className="retro-pixel-text mt-1" style={{ color: "hsl(0,0%,90%)", fontSize: "16px" }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="amiga-box rounded-lg p-4 mb-6">
          <h2
            className="retro-pixel-text mb-4 text-center"
            style={{ fontSize: "16px", color: "hsl(30, 75%, 55%)" }}
          >
            ACHIEVEMENTS ({profile.achievements.length}/{ACHIEVEMENTS.length})
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = unlockedIds.has(ach.id);
              return (
                <div
                  key={ach.id}
                  className="flex items-center gap-2 p-2 rounded"
                  style={{
                    background: unlocked ? "hsl(200, 30%, 18%)" : "hsl(0,0%,12%)",
                    opacity: unlocked ? 1 : 0.4,
                    border: unlocked ? "1px solid hsl(200,70%,50%,0.3)" : "1px solid hsl(0,0%,20%)",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{ach.icon}</span>
                  <div>
                    <p style={{ color: unlocked ? "hsl(0,0%,90%)" : "hsl(0,0%,50%)", fontSize: "12px", fontWeight: 600 }}>
                      {ach.name}
                    </p>
                    <p style={{ color: "hsl(0,0%,45%)", fontSize: "10px" }}>{ach.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded text-sm font-bold"
            style={{
              background: "hsl(200, 70%, 50%)",
              color: "white",
            }}
          >
            HOME
          </button>
          <button
            onClick={() => navigate("/play")}
            className="px-4 py-2 rounded text-sm font-bold"
            style={{
              background: "hsl(120, 50%, 40%)",
              color: "white",
            }}
          >
            PLAY
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded text-sm font-bold"
            style={{
              background: "hsl(0, 65%, 50%)",
              color: "white",
            }}
          >
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
