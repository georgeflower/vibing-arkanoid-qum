import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";
import { validatePassword } from "@/utils/passwordValidation";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const pwCheck = validatePassword(password);
    if (!pwCheck.isValid) {
      setError(pwCheck.errors.join(". "));
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Password updated successfully!");
      setTimeout(() => navigate("/profile"), 2000);
    }
    setLoading(false);
  };

  const pwValidation = validatePassword(password);

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)" }}
    >
    <div className="min-h-full flex items-center justify-center p-4">
      <CRTOverlay quality="medium" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="amiga-box rounded-lg p-6 sm:p-8">
          <h1
            className="retro-pixel-text text-center mb-6"
            style={{ fontSize: "24px", color: "hsl(200, 70%, 50%)", textShadow: "0 0 10px hsl(200,70%,50%,0.5)" }}
          >
            NEW PASSWORD
          </h1>

          {!isRecovery ? (
            <div className="text-center">
              <p className="text-sm mb-4" style={{ color: "hsl(0,0%,70%)" }}>
                Loading recovery session...
              </p>
              <p className="text-xs" style={{ color: "hsl(0,0%,50%)" }}>
                If nothing happens, your reset link may have expired.
              </p>
              <button onClick={() => navigate("/auth")} className="mt-4 text-sm underline" style={{ color: "hsl(200,70%,50%)" }}>
                Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: "hsl(0,0%,70%)" }}>New Password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm" placeholder="••••••••••" required minLength={10}
                  style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,30%)", color: "hsl(0,0%,90%)" }}
                />
                {password.length > 0 && (
                  <>
                    <div className="mt-1">
                      <div className="w-full h-1.5 rounded" style={{ background: "hsl(0,0%,20%)" }}>
                        <div className="h-full rounded transition-all duration-300" style={{
                          width: { weak: "25%", fair: "50%", strong: "75%", "very-strong": "100%" }[pwValidation.strength],
                          background: { weak: "hsl(0,70%,50%)", fair: "hsl(40,80%,50%)", strong: "hsl(120,50%,45%)", "very-strong": "hsl(200,70%,50%)" }[pwValidation.strength],
                        }} />
                      </div>
                    </div>
                    {pwValidation.errors.map((err, i) => (
                      <p key={i} className="text-[10px] mt-0.5" style={{ color: "hsl(0,60%,55%)" }}>• {err}</p>
                    ))}
                  </>
                )}
              </div>

              {error && <p className="text-sm" style={{ color: "hsl(0, 70%, 55%)" }}>{error}</p>}
              {message && <p className="text-sm" style={{ color: "hsl(120, 50%, 50%)" }}>{message}</p>}

              <button type="submit" disabled={loading || !pwValidation.isValid}
                className="w-full py-2 rounded font-bold text-sm transition-colors"
                style={{ background: "hsl(200, 70%, 50%)", color: "hsl(0,0%,100%)", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Updating..." : "SET NEW PASSWORD"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default ResetPassword;
