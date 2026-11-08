import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { FiEye, FiEyeOff } from "react-icons/fi";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/autovet-logo.png";
import DarkModeToggle from "../components/ui/DarkModeToggle";

/**
 * The message for a failed sign-in, chosen by what actually went wrong.
 * err.status is set by api.js for HTTP replies; it is absent when the request
 * never got an answer (offline, server unreachable, timeout).
 */
function loginErrorMessage(err) {
  const status = err?.status;

  // The backend's 401 text mentions "Continue with Google", which this page
  // does not have (it is shared with the portal), so it is not shown here.
  if (status === 401) return "Incorrect email or password.";
  // Account state (deactivated, unverified, blocked) and form validation:
  // the backend's own message is the accurate one.
  if (status === 403 || status === 422) {
    return err.message || "You can't sign in with this account.";
  }
  if (status === 429) {
    return "Too many sign-in attempts. Please wait a minute and try again.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "The server is not responding right now. Please try again in a moment.";
  }
  if (status >= 500) {
    return "Something went wrong on the server. Please try again.";
  }
  if (status) return err.message || "Sign-in failed. Please try again.";

  if (err?.name === "TimeoutError") {
    return "The server is taking too long to respond. It may be starting up, so please try again in a moment.";
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You're offline. Check your internet connection and try again.";
  }
  return "Can't reach the server right now. Please try again in a moment.";
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Dynamically change browser tab branding for Login Page ONLY
  useEffect(() => {
    const originalTitle = document.title;
    const originalFavicon = document.querySelector("link[rel='icon']")?.href;
    
    document.title = "DIGIVET";
    const favicon = document.querySelector("link[rel='icon']");
    if (favicon) {
      favicon.href = logo; // Use the Digivet logo imported above
    }

    return () => {
      document.title = originalTitle;
      if (favicon && originalFavicon) {
        favicon.href = originalFavicon;
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Attempt login directly (API uses Bearer tokens, not sessions)
      const data = await api.post("/api/login", { email, password });

      if (data && !data.error) {
        login(data); 
        if (data.must_change_password) {
          navigate("/change-password");
        } else if (data.role === "super_admin") {
          navigate("/super-admin");
        } else {
          navigate("/");
        }
      } else {
        // Extremely robust string extraction
        let errorMsg = "Invalid credentials";
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
      // api.post throws for every non-2xx reply too, so a wrong password used
      // to land here and show the same "network error" as a dead server.
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-dark-bg transition-colors duration-300 px-4 py-8"
      style={{ minHeight: '100dvh' }}
    >
      <div
        className="absolute flex items-center gap-3"
        style={{ top: 'max(1.5rem, env(safe-area-inset-top))', right: 'max(1.5rem, env(safe-area-inset-right))' }}
      >
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          
        </span>
        <DarkModeToggle />
      </div>

      <form
        onSubmit={handleSubmit}
        className="card-shell w-full max-w-md p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500"
      >
        <div className="text-center space-y-2">
          <img src={logo} alt="Digivet Logo" className="mx-auto w-32 h-32 object-contain" />
          <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">Digivet</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Multi-Clinic Management Platform</p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input-field"
            placeholder="admin@digivet.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password" name="password" className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="input-field pr-10"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-hidden dark:hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-sm text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400 animate-shake">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={clsx(
            "w-full h-12 rounded-xl bg-brand-500 text-white font-bold text-lg transition-all hover:bg-brand-600 shadow-lg shadow-brand-500/20 active:scale-[0.98]",
            loading && "opacity-60 cursor-not-allowed"
          )}
        >
          {loading ? "Signing in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
