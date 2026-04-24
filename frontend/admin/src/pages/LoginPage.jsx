import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/autovet-logo.png";
import DarkModeToggle from "../components/ui/DarkModeToggle";

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
    
    document.title = "AUTOVET";
    const favicon = document.querySelector("link[rel='icon']");
    if (favicon) {
      favicon.href = logo; // Use the AutoVet logo imported above
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
      // 1. Fetch CSRF cookie before login
      await fetch("/sanctum/csrf-cookie", { credentials: "include" });

      // 2. Attempt login
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && !data.error) {
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
      setError("Network error. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-dark-bg transition-colors duration-300">
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          
        </span>
        <DarkModeToggle />
      </div>

      <form
        onSubmit={handleSubmit}
        className="card-shell w-full max-w-md p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500"
      >
        <div className="text-center space-y-2">
          <img src={logo} alt="AutoVet Logo" className="mx-auto w-32 h-32 object-contain" />
          <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">AutoVet</h1>
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
            placeholder="admin@autovet.com"
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
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-none dark:hover:text-zinc-300 transition-colors"
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
