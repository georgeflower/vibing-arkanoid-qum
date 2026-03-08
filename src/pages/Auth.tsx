import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/profile");
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/profile");
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
      }
    } else {
      if (!displayName.trim()) {
        setError("Display name is required");
        setLoading(false);
        return;
      }
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage("Check your email for a verification link!");
      }
    }
    setLoading(false);
  };

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
            {isLogin ? "LOGIN" : "SIGN UP"}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{
                    background: "hsl(0,0%,15%)",
                    border: "1px solid hsl(0,0%,30%)",
                    color: "hsl(0,0%,90%)",
                  }}
                  placeholder="Your name"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: "hsl(0,0%,15%)",
                  border: "1px solid hsl(0,0%,30%)",
                  color: "hsl(0,0%,90%)",
                }}
                placeholder="you@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: "hsl(0,0%,15%)",
                  border: "1px solid hsl(0,0%,30%)",
                  color: "hsl(0,0%,90%)",
                }}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "hsl(0, 70%, 55%)" }}>
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm" style={{ color: "hsl(120, 50%, 50%)" }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded font-bold text-sm transition-colors"
              style={{
                background: "hsl(200, 70%, 50%)",
                color: "hsl(0,0%,100%)",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Please wait..." : isLogin ? "LOGIN" : "SIGN UP"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setMessage("");
              }}
              className="text-sm underline"
              style={{ color: "hsl(330, 40%, 50%)" }}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-sm underline"
              style={{ color: "hsl(0,0%,60%)" }}
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
