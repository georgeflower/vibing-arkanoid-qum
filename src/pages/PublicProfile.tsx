import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";
import { ACHIEVEMENTS } from "@/constants/achievements";

const POWER_UP_LABELS: Record<string, string> = {
  multiball: "Multi-Ball", turrets: "Turrets", fireball: "Fireball", life: "Extra Life",
  slowdown: "Slow Down", paddleExtend: "Extend", paddleShrink: "Shrink", shield: "Shield",
  bossStunner: "Stunner", reflectShield: "Reflect", homingBall: "Homing", secondChance: "2nd Chance",
};

const formatPlayTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!username) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("player_profiles")
        .select("*")
        .eq("username", username)
        .eq("is_public", true)
        .single();

      if (error || !data) { setNotFound(true); } else { setProfile(data); }
      setLoading(false);
    };
    load();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)" }}>
        <p style={{ color: "hsl(200, 70%, 50%)" }} className="retro-pixel-text">LOADING...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)" }}>
        <CRTOverlay quality="medium" />
        <div className="relative z-10 text-center">
          <h1 className="retro-pixel-text mb-4" style={{ fontSize: "28px", color: "hsl(0, 70%, 55%)" }}>PLAYER NOT FOUND</h1>
          <p className="text-sm mb-6" style={{ color: "hsl(0,0%,60%)" }}>This profile is private or doesn't exist.</p>
          <Link to="/" className="retro-pixel-text px-4 py-2 rounded" style={{ background: "hsl(200,70%,50%)", color: "white", fontSize: "14px" }}>HOME</Link>
        </div>
      </div>
    );
  }

  const avatarUrl = (profile as any).avatar_url || null;
  const achievements = (profile.achievements as Array<{ id: string; unlockedAt: string }>) || [];
  const unlockedIds = new Set(achievements.map((a: any) => a.id));

  const stats = [
    { label: "Games Played", value: profile.total_games_played.toLocaleString() },
    { label: "Time Played", value: formatPlayTime(profile.total_time_played_seconds) },
    { label: "Bricks Destroyed", value: profile.total_bricks_destroyed.toLocaleString() },
    { label: "Best Score", value: profile.best_score.toLocaleString() },
    { label: "Best Level", value: String(profile.best_level) },
    { label: "Bosses Killed", value: profile.total_bosses_killed.toLocaleString() },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)", overflowY: "auto", height: "100vh", position: "fixed", inset: 0 }}>
      <CRTOverlay quality="medium" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="amiga-box rounded-lg p-6 mb-6 text-center">
          {/* Avatar */}
          {avatarUrl && (
            <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3" style={{ border: "2px solid hsl(200,70%,50%,0.5)" }}>
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="retro-pixel-text mb-1" style={{ fontSize: "28px", color: "hsl(200, 70%, 50%)", textShadow: "0 0 10px hsl(200,70%,50%,0.5)" }}>
            {profile.username}
          </h1>
          {profile.bio && <p className="mt-2" style={{ color: "hsl(0,0%,65%)", fontSize: "12px" }}>{profile.bio}</p>}
          {profile.favorite_power_up && (
            <p className="mt-2" style={{ color: "hsl(330,100%,65%)", fontSize: "11px" }}>
              ★ Favorite: {POWER_UP_LABELS[profile.favorite_power_up] || profile.favorite_power_up}
            </p>
          )}
        </div>

        <div className="amiga-box rounded-lg p-4 mb-6">
          <h2 className="retro-pixel-text mb-4 text-center" style={{ fontSize: "16px", color: "hsl(30, 75%, 55%)" }}>STATS</h2>
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ background: "hsl(0,0%,15%)" }}>
                <p style={{ color: "hsl(0,0%,50%)", fontSize: "10px", letterSpacing: "1px" }}>{s.label.toUpperCase()}</p>
                <p className="retro-pixel-text mt-1" style={{ color: "hsl(0,0%,90%)", fontSize: "16px" }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="amiga-box rounded-lg p-4 mb-6">
          <h2 className="retro-pixel-text mb-4 text-center" style={{ fontSize: "16px", color: "hsl(30, 75%, 55%)" }}>
            ACHIEVEMENTS ({achievements.length}/{ACHIEVEMENTS.length})
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = unlockedIds.has(ach.id);
              return (
                <div key={ach.id} className="flex items-center gap-2 p-2 rounded" style={{
                  background: unlocked ? "hsl(200, 30%, 18%)" : "hsl(0,0%,12%)",
                  opacity: unlocked ? 1 : 0.4,
                  border: unlocked ? "1px solid hsl(200,70%,50%,0.3)" : "1px solid hsl(0,0%,20%)",
                }}>
                  <span style={{ fontSize: "20px" }}>{ach.icon}</span>
                  <div>
                    <p style={{ color: unlocked ? "hsl(0,0%,90%)" : "hsl(0,0%,50%)", fontSize: "12px", fontWeight: 600 }}>{ach.name}</p>
                    <p style={{ color: "hsl(0,0%,45%)", fontSize: "10px" }}>{ach.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center">
          <Link to="/" className="px-4 py-2 rounded text-sm font-bold" style={{ background: "hsl(200, 70%, 50%)", color: "white" }}>HOME</Link>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
