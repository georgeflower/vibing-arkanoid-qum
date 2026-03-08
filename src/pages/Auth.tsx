import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";
import { validatePassword, validateUsername, validateInitials } from "@/utils/passwordValidation";

const PasswordStrengthBar = ({ strength }: { strength: string }) => {
  const colors: Record<string, string> = {
    weak: "hsl(0, 70%, 50%)",
    fair: "hsl(40, 80%, 50%)",
    strong: "hsl(120, 50%, 45%)",
    "very-strong": "hsl(200, 70%, 50%)",
  };
  const widths: Record<string, string> = { weak: "25%", fair: "50%", strong: "75%", "very-strong": "100%" };
  return (
    <div className="mt-1">
      <div className="w-full h-1.5 rounded" style={{ background: "hsl(0,0%,20%)" }}>
        <div
          className="h-full rounded transition-all duration-300"
          style={{ width: widths[strength] || "0%", background: colors[strength] || "hsl(0,0%,30%)" }}
        />
      </div>
      <p className="text-[10px] mt-0.5" style={{ color: colors[strength] || "hsl(0,0%,50%)" }}>
        {strength.replace("-", " ").toUpperCase()}
      </p>
    </div>
  );
};

type AuthMode = "login" | "signup" | "forgot" | "resend";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [initials, setInitials] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.onAuthStateChange((_, session) => {
      if (session) navigate("/profile");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/profile");
    });
  }, [navigate]);

  const handleSignup = async () => {
    if (!displayName.trim()) { setError("Display name is required"); return; }

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.isValid) { setError(`Username: ${usernameCheck.error}`); return; }

    const initialsCheck = validateInitials(initials);
    if (!initialsCheck.isValid) { setError(`Initials: ${initialsCheck.error}`); return; }

    const pwCheck = validatePassword(password);
    if (!pwCheck.isValid) { setError(pwCheck.errors.join(". ")); return; }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim(), username: username.toLowerCase(), initials: initials.toUpperCase() },
        emailRedirectTo: window.location.origin,
      },
    });
    if (signUpError) setError(signUpError.message);
    else setMessage("Check your email for a verification link!");
  };

  const handleLogin = async () => {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email address"); return; }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setMessage("Check your email for a password reset link!");
  };

  const handleResendVerification = async () => {
    if (!email) { setError("Enter your email address"); return; }
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    if (resendError) setError(resendError.message);
    else setMessage("Verification email sent! Check your inbox.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "login") await handleLogin();
    else if (mode === "signup") await handleSignup();
    else if (mode === "forgot") await handleForgotPassword();
    else if (mode === "resend") await handleResendVerification();

    setLoading(false);
  };

  const pwValidation = mode === "signup" ? validatePassword(password) : null;

  const titles: Record<AuthMode, string> = { login: "LOGIN", signup: "SIGN UP", forgot: "RESET PASSWORD", resend: "RESEND VERIFICATION" };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)" }}
    >
      <CRTOverlay quality="medium" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="amiga-box rounded-lg p-6 sm:p-8">
          <h1
            className="retro-pixel-text text-center mb-6"
            style={{ fontSize: "24px", color: "hsl(200, 70%, 50%)", textShadow: "0 0 10px hsl(200,70%,50%,0.5)" }}
          >
            {titles[mode]}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
                    className="w-full px-3 py-2 rounded text-sm" placeholder="Your name"
                    style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }} required />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value.slice(0, 20).replace(/[^a-zA-Z0-9_]/g, ""))}
                    className="w-full px-3 py-2 rounded text-sm" placeholder="unique_username"
                    style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }} required />
                  <p className="text-[10px] mt-0.5" style={{ color: "hsl(0,0%,50%)" }}>3-20 chars, letters/numbers/underscores</p>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>Initials (for high scores)</label>
                  <input type="text" value={initials} maxLength={3}
                    onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                    className="w-full px-3 py-2 rounded text-sm font-mono tracking-widest" placeholder="AAA"
                    style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }} required />
                </div>
              </>
            )}

            {(mode === "login" || mode === "signup" || mode === "forgot" || mode === "resend") && (
              <div>
                <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm" placeholder="you@email.com"
                  style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }} required />
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div>
                <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm" placeholder="••••••••••"
                  style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }}
                  required minLength={10} />
                {mode === "signup" && password.length > 0 && pwValidation && (
                  <>
                    <PasswordStrengthBar strength={pwValidation.strength} />
                    {pwValidation.errors.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {pwValidation.errors.map((err, i) => (
                          <li key={i} className="text-[10px]" style={{ color: "hsl(0, 60%, 55%)" }}>• {err}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            {error && <p className="text-sm" style={{ color: "hsl(0, 70%, 55%)" }}>{error}</p>}
            {message && <p className="text-sm" style={{ color: "hsl(120, 50%, 50%)" }}>{message}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-2 rounded font-bold text-sm transition-colors"
              style={{ background: "hsl(200, 70%, 50%)", color: "hsl(0,0%,100%)", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Please wait..." : titles[mode]}
            </button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
                  className="text-sm underline block w-full" style={{ color: "hsl(330, 40%, 50%)" }}>
                  Don't have an account? Sign up
                </button>
                <button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}
                  className="text-sm underline block w-full" style={{ color: "hsl(200, 50%, 55%)" }}>
                  Forgot password?
                </button>
                <button onClick={() => { setMode("resend"); setError(""); setMessage(""); }}
                  className="text-sm underline block w-full" style={{ color: "hsl(0,0%,55%)" }}>
                  Resend verification email
                </button>
              </>
            )}
            {mode !== "login" && (
              <button onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className="text-sm underline block w-full" style={{ color: "hsl(330, 40%, 50%)" }}>
                Back to login
              </button>
            )}
          </div>

          <div className="mt-4 text-center">
            <button onClick={() => navigate("/")} className="text-sm underline" style={{ color: "hsl(0,0%,60%)" }}>
              ← Back to Home
            </button>
          </div>

          <div className="mt-4 flex justify-center gap-4 text-[10px]">
            <Link to="/privacy" style={{ color: "hsl(0,0%,45%)" }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: "hsl(0,0%,45%)" }}>Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
