import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";
import { ACHIEVEMENTS } from "@/constants/achievements";
import { validateUsername, validateInitials } from "@/utils/passwordValidation";

interface ProfileData {
  username: string | null;
  initials: string;
  bio: string | null;
  is_public: boolean;
  avatar_url: string | null;
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
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const POWER_UP_LABELS: Record<string, string> = {
  multiball: "Multi-Ball", turrets: "Turrets", fireball: "Fireball", life: "Extra Life",
  slowdown: "Slow Down", paddleExtend: "Extend", paddleShrink: "Shrink", shield: "Shield",
  bossStunner: "Stunner", reflectShield: "Reflect", homingBall: "Homing", secondChance: "2nd Chance",
};

const resizeImage = (file: File, maxSize: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round((h * maxSize) / w); w = maxSize; }
        else { w = Math.round((w * maxSize) / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to resize image"));
      }, "image/webp", 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
};

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  // Edit form state
  const [editUsername, setEditUsername] = useState("");
  const [editInitials, setEditInitials] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      setEmailVerified(!!session.user.email_confirmed_at);
      setUserEmail(session.user.email || "");
      setUserId(session.user.id);

      const { data, error } = await supabase
        .from("player_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error || !data) { navigate("/auth"); return; }

      const p: ProfileData = {
        username: data.username,
        initials: data.initials || "AAA",
        bio: data.bio,
        is_public: data.is_public,
        avatar_url: (data as any).avatar_url || null,
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
        daily_challenge_streak: data.daily_challenge_streak || 0,
        best_daily_streak: data.best_daily_streak || 0,
        total_daily_challenges_completed: data.total_daily_challenges_completed || 0,
      };
      setProfile(p);
      setEditUsername(p.username || "");
      setEditInitials(p.initials);
      setEditBio(p.bio || "");
      setEditIsPublic(p.is_public);
      setLoading(false);
    };
    loadProfile();
  }, [navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file (JPG, PNG, or WebP).");
      return;
    }

    setUploadingAvatar(true);
    try {
      const resized = await resizeImage(file, 256);
      if (resized.size > 262144) {
        setAvatarError("Image is too large even after resize. Try a smaller image.");
        setUploadingAvatar(false);
        return;
      }

      const filePath = `${userId}/avatar.webp`;

      // Remove old avatar first
      await supabase.storage.from("avatars").remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, resized, { contentType: "image/webp", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = urlData.publicUrl + "?t=" + Date.now();

      await supabase.from("player_profiles").update({ avatar_url: avatarUrl }).eq("user_id", userId);

      setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
    } catch (err: any) {
      setAvatarError("Upload failed: " + (err.message || "Unknown error"));
    }
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");

    const uCheck = validateUsername(editUsername);
    if (!uCheck.isValid) { setSaveError(`Username: ${uCheck.error}`); setSaving(false); return; }

    const iCheck = validateInitials(editInitials);
    if (!iCheck.isValid) { setSaveError(`Initials: ${iCheck.error}`); setSaving(false); return; }

    // Check username uniqueness
    if (editUsername.toLowerCase() !== profile?.username) {
      const { data: existing } = await supabase
        .from("player_profiles")
        .select("id")
        .eq("username", editUsername.toLowerCase())
        .maybeSingle();
      if (existing) { setSaveError("Username is already taken"); setSaving(false); return; }
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

    const { error } = await supabase
      .from("player_profiles")
      .update({
        display_name: editUsername.toLowerCase(),
        username: editUsername.toLowerCase(),
        initials: editInitials.toUpperCase(),
        bio: editBio.trim() || null,
        is_public: editIsPublic,
      })
      .eq("user_id", session.user.id);

    if (error) { setSaveError("Failed to save: " + error.message); }
    else {
      setProfile((prev) => prev ? {
        ...prev,
        username: editUsername.toLowerCase(),
        initials: editInitials.toUpperCase(),
        bio: editBio.trim() || null,
        is_public: editIsPublic,
      } : prev);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation_email: deleteEmail.trim() },
      });

      if (error) throw error;
      const result = data as { error?: string; success?: boolean };
      if (result?.error) throw new Error(result.error);

      await supabase.auth.signOut();
      navigate("/");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account");
    }
    setDeleting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)" }}>
        <p style={{ color: "hsl(200, 70%, 50%)" }} className="retro-pixel-text">LOADING...</p>
      </div>
    );
  }

  if (!profile) return null;

  const unlockedIds = new Set(profile.achievements.map((a) => a.id));
  const avatarSrc = profile.avatar_url || null;

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
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)", overflowY: "auto", height: "100vh", position: "fixed", inset: 0 }}>
      <CRTOverlay quality="medium" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Beta Status Banner */}
        <div className="mb-4 p-3 rounded-lg" style={{ background: "hsl(45,100%,50%,0.15)", border: "1px solid hsl(45,100%,50%,0.5)" }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "hsl(45,100%,50%)", color: "hsl(220,30%,10%)" }}>
              BETA
            </span>
            <span className="text-xs font-bold" style={{ color: "hsl(45,100%,60%)" }}>Profile System</span>
          </div>
          <p className="text-[10px] text-center" style={{ color: "hsl(0,0%,70%)" }}>
            This feature is in beta. Some features may be unstable or incomplete.
          </p>
          <details className="mt-2">
            <summary className="text-[10px] text-center cursor-pointer" style={{ color: "hsl(200,70%,60%)" }}>
              Known Issues (click to expand)
            </summary>
            <ul className="mt-2 space-y-1 text-[9px] list-disc list-inside" style={{ color: "hsl(0,0%,65%)" }}>
              <li>Avatar upload may occasionally fail on slow connections</li>
              <li>Public profile links may take a few seconds to update after changes</li>
              <li>Stats synchronization can be delayed during high server load</li>
            </ul>
          </details>
        </div>

        {/* Header */}
        <div className="amiga-box rounded-lg p-6 mb-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden mb-2" style={{ background: "hsl(0,0%,20%)", border: "2px solid hsl(200,70%,50%,0.5)" }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ color: "hsl(0,0%,40%)", fontSize: "28px" }}>👤</div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="text-[10px] px-3 py-1 rounded"
              style={{ background: "hsl(0,0%,20%)", color: "hsl(200,70%,60%)", border: "1px solid hsl(0,0%,30%)", opacity: uploadingAvatar ? 0.5 : 1 }}
            >
              {uploadingAvatar ? "UPLOADING..." : "CHANGE AVATAR"}
            </button>
            <p className="text-[9px] mt-1 text-center" style={{ color: "hsl(0,0%,45%)" }}>
              Max 256×256px. JPG/PNG/WebP. Inappropriate images may result in account suspension.
            </p>
            {avatarError && <p className="text-[10px] mt-1" style={{ color: "hsl(0,70%,55%)" }}>{avatarError}</p>}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "hsl(0,0%,60%)" }}>USERNAME</label>
                <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value.slice(0, 20).replace(/[^a-zA-Z0-9_]/g, ""))}
                  className="w-full px-3 py-2 rounded text-sm" placeholder="your_username"
                  style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }} />
                <p className="text-[10px] mt-0.5" style={{ color: "hsl(0,0%,50%)" }}>3-20 chars. Used for your public profile URL. Must be unique.</p>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "hsl(0,0%,60%)" }}>INITIALS</label>
                <input type="text" value={editInitials} maxLength={3}
                  onChange={(e) => setEditInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                  className="w-full px-3 py-2 rounded text-sm font-mono tracking-widest"
                  style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "hsl(0,0%,60%)" }}>BIO</label>
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value.slice(0, 200))}
                  className="w-full px-3 py-2 rounded text-sm resize-none" rows={3} placeholder="Tell us about yourself..."
                  style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }} />
                <p className="text-[10px] mt-0.5 text-right" style={{ color: "hsl(0,0%,50%)" }}>{editBio.length}/200</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editIsPublic} onChange={(e) => setEditIsPublic(e.target.checked)}
                    className="rounded" style={{ accentColor: "hsl(200,70%,50%)" }} />
                  <span className="text-sm" style={{ color: "hsl(0,0%,75%)" }}>Public profile</span>
                </label>
                {editIsPublic && editUsername && (
                  <span className="text-[10px]" style={{ color: "hsl(200,70%,50%)" }}>
                    /player/{editUsername.toLowerCase()}
                  </span>
                )}
              </div>
              {saveError && <p className="text-sm" style={{ color: "hsl(0, 70%, 55%)" }}>{saveError}</p>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded text-sm font-bold"
                  style={{ background: "hsl(120, 50%, 40%)", color: "white", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "SAVING..." : "SAVE"}
                </button>
                <button onClick={() => { setEditing(false); setSaveError(""); }} className="px-4 py-2 rounded text-sm font-bold"
                  style={{ background: "hsl(0,0%,25%)", color: "hsl(0,0%,80%)" }}>CANCEL</button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="retro-pixel-text mb-1" style={{ fontSize: "28px", color: "hsl(200, 70%, 50%)", textShadow: "0 0 10px hsl(200,70%,50%,0.5)" }}>
                {profile.username || "Player"}
              </h1>
              <p className="mt-1" style={{ color: "hsl(0,0%,50%)", fontSize: "11px" }}>
                Initials: <span style={{ color: "hsl(330,100%,65%)", fontFamily: "monospace", letterSpacing: "3px" }}>{profile.initials}</span>
              </p>
              {profile.bio && <p className="mt-2" style={{ color: "hsl(0,0%,65%)", fontSize: "12px" }}>{profile.bio}</p>}

              {/* Status indicators */}
              <div className="flex justify-center gap-3 mt-3">
                <span className="text-[10px] px-2 py-0.5 rounded" style={{
                  background: emailVerified ? "hsl(120,40%,20%)" : "hsl(0,40%,20%)",
                  color: emailVerified ? "hsl(120,50%,60%)" : "hsl(0,50%,60%)",
                  border: `1px solid ${emailVerified ? "hsl(120,50%,30%)" : "hsl(0,50%,30%)"}`,
                }}>
                  {emailVerified ? "✓ EMAIL VERIFIED" : "✗ EMAIL NOT VERIFIED"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded" style={{
                  background: profile.is_public ? "hsl(200,40%,20%)" : "hsl(0,0%,18%)",
                  color: profile.is_public ? "hsl(200,70%,60%)" : "hsl(0,0%,55%)",
                  border: `1px solid ${profile.is_public ? "hsl(200,50%,30%)" : "hsl(0,0%,30%)"}`,
                }}>
                  {profile.is_public ? "🌐 PUBLIC" : "🔒 PRIVATE"}
                </span>
              </div>

              {profile.is_public && profile.username && (
                <Link to={`/player/${profile.username}`} className="text-[10px] mt-2 inline-block underline" style={{ color: "hsl(200,70%,50%)" }}>
                  View public profile →
                </Link>
              )}

              <button onClick={() => setEditing(true)} className="mt-3 px-4 py-1.5 rounded text-xs font-bold"
                style={{ background: "hsl(0,0%,20%)", color: "hsl(0,0%,80%)", border: "1px solid hsl(0,0%,35%)" }}>
                ✏️ EDIT PROFILE
              </button>
            </div>
          )}
        </div>

        {/* Navigation & Logout buttons */}
        <div className="flex justify-center gap-3 mb-6">
          <Link to="/" className="px-4 py-2 rounded text-xs font-bold text-center"
            style={{ background: "hsl(200,50%,30%)", color: "hsl(200,70%,85%)", border: "1px solid hsl(200,50%,40%)" }}>
            🏠 HOMEPAGE
          </Link>
          <Link to="/play" className="px-4 py-2 rounded text-xs font-bold text-center"
            style={{ background: "hsl(120,50%,30%)", color: "hsl(120,70%,85%)", border: "1px solid hsl(120,50%,40%)" }}>
            🎮 PLAY
          </Link>
          <button onClick={handleLogout} className="px-4 py-2 rounded text-xs font-bold"
            style={{ background: "hsl(0,50%,30%)", color: "hsl(0,70%,85%)", border: "1px solid hsl(0,50%,40%)" }}>
            🚪 LOGOUT
          </button>
        </div>

        {/* Email info */}
        <div className="amiga-box rounded-lg p-3 mb-6 text-center">
          <p style={{ color: "hsl(0,0%,50%)", fontSize: "11px" }}>
            Signed in as <span style={{ color: "hsl(0,0%,70%)" }}>{userEmail}</span>
          </p>
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
          <h2 className="retro-pixel-text mb-4 text-center" style={{ fontSize: "16px", color: "hsl(30, 75%, 55%)" }}>LIFETIME STATS</h2>
          <div className="grid grid-cols-3 gap-3">
            {statItems.map((stat) => (
              <div key={stat.label} className="text-center p-2 rounded" style={{ background: "hsl(0,0%,15%)" }}>
                <p style={{ color: "hsl(0,0%,50%)", fontSize: "10px", letterSpacing: "1px" }}>{stat.label.toUpperCase()}</p>
                <p className="retro-pixel-text mt-1" style={{ color: "hsl(0,0%,90%)", fontSize: "16px" }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="amiga-box rounded-lg p-4 mb-6">
          <h2 className="retro-pixel-text mb-4 text-center" style={{ fontSize: "16px", color: "hsl(30, 75%, 55%)" }}>
            ACHIEVEMENTS ({profile.achievements.length}/{ACHIEVEMENTS.length})
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

        {/* Navigation */}
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate("/")} className="px-4 py-2 rounded text-sm font-bold" style={{ background: "hsl(200, 70%, 50%)", color: "white" }}>HOME</button>
          <button onClick={() => navigate("/play")} className="px-4 py-2 rounded text-sm font-bold" style={{ background: "hsl(120, 50%, 40%)", color: "white" }}>PLAY</button>
          <button onClick={handleLogout} className="px-4 py-2 rounded text-sm font-bold" style={{ background: "hsl(0, 65%, 50%)", color: "white" }}>LOGOUT</button>
        </div>

        {/* Delete Account Section */}
        <div className="amiga-box rounded-lg p-4 mt-6 text-center" style={{ borderColor: "hsl(0,60%,35%)" }}>
          <p className="text-[11px] mb-2" style={{ color: "hsl(0,0%,55%)" }}>
            ⚠️ DANGER ZONE
          </p>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="px-4 py-2 rounded text-xs font-bold"
            style={{ background: "hsl(0, 65%, 40%)", color: "white", border: "1px solid hsl(0,65%,50%)" }}
          >
            🗑️ DELETE ACCOUNT
          </button>
          <p className="text-[9px] mt-2" style={{ color: "hsl(0,0%,40%)" }}>
            This permanently deletes your profile, stats, and achievements. Your initials will remain on the leaderboard but will no longer link to your profile. This cannot be undone.
          </p>
        </div>

        {/* Delete Account Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "hsla(0,0%,0%,0.8)" }}>
            <div className="amiga-box rounded-lg p-6 max-w-sm w-full">
              <h2 className="retro-pixel-text text-center mb-4" style={{ fontSize: "18px", color: "hsl(0, 70%, 55%)" }}>
                DELETE ACCOUNT
              </h2>
              <p className="text-[11px] mb-3 text-center" style={{ color: "hsl(0,0%,65%)" }}>
                This will permanently delete your profile, stats, achievements, and avatar. Your initials will remain on the leaderboard but the link to your profile will be removed.
              </p>
              <p className="text-[11px] mb-3 text-center font-bold" style={{ color: "hsl(0, 70%, 60%)" }}>
                This action cannot be undone.
              </p>
              <p className="text-[11px] mb-2" style={{ color: "hsl(0,0%,55%)" }}>
                Type your email to confirm: <span style={{ color: "hsl(0,0%,75%)" }}>{userEmail}</span>
              </p>
              <input
                type="email"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm mb-3"
                placeholder="your@email.com"
                style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }}
              />
              {deleteError && <p className="text-[11px] mb-2" style={{ color: "hsl(0,70%,55%)" }}>{deleteError}</p>}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteEmail.toLowerCase().trim() !== userEmail.toLowerCase()}
                  className="px-4 py-2 rounded text-sm font-bold"
                  style={{
                    background: "hsl(0, 65%, 45%)",
                    color: "white",
                    opacity: (deleting || deleteEmail.toLowerCase().trim() !== userEmail.toLowerCase()) ? 0.4 : 1,
                  }}
                >
                  {deleting ? "DELETING..." : "PERMANENTLY DELETE"}
                </button>
                <button
                  onClick={() => { setShowDeleteDialog(false); setDeleteEmail(""); setDeleteError(""); }}
                  className="px-4 py-2 rounded text-sm font-bold"
                  style={{ background: "hsl(0,0%,25%)", color: "hsl(0,0%,80%)" }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center gap-4 text-[10px]">
          <Link to="/privacy" style={{ color: "hsl(0,0%,45%)" }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: "hsl(0,0%,45%)" }}>Terms of Service</Link>
        </div>
      </div>
    </div>
  );
};

export default Profile;
