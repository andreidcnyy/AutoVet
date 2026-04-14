import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import DarkModeToggle from "../components/DarkModeToggle";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    const e = searchParams.get("email");
    if (t) setToken(t);
    if (e) setEmail(e);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      return setError("Passwords do not match.");
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ 
          token, 
          email, 
          password, 
          password_confirmation: passwordConfirmation 
        }),
      });

      const data = await res.json();
      if (res.ok) {
        navigate("/login", { state: { message: "Password reset successful! Please log in with your new password." } });
      } else {
        // Extremely robust string extraction
        let errorMsg = "Reset failed. The link may be expired.";
        if (typeof data.error === "string") {
          errorMsg = data.error;
        } else if (data.error && typeof data.error === "object") {
          errorMsg = data.error.message || data.error.code || JSON.stringify(data.error);
        } else if (data.message) {
          errorMsg = data.message;
        } else if (data.code) {
          errorMsg = `Error Code: ${data.code}`;
        }
        setError(String(errorMsg));
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-dark-bg transition-colors duration-300 relative">
      <div className="absolute top-8 right-8">
        <DarkModeToggle />
      </div>

      <form onSubmit={handleSubmit} className="card-shell w-full max-w-md p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-lg shadow-brand-500/20">A</div>
          <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">New Password</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Please enter your new secure password</p>
        </div>

        <input type="hidden" value={token} />
        
        <div>
          <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
          <input
            type="email"
            readOnly
            className="input-field bg-zinc-100 dark:bg-zinc-800/50 cursor-not-allowed"
            value={email}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">New Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <FiLock />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              className="input-field pl-10"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400"
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Confirm Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <FiLock />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              className="input-field pl-10"
              placeholder="Repeat new password"
              value={passwordConfirmation}
              onChange={e => setPasswordConfirmation(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-sm text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-brand-500 text-white font-bold text-lg transition-all hover:bg-brand-600 shadow-lg shadow-brand-500/20 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Updating..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}
