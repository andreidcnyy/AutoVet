import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import clsx from "clsx";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "./context/AuthContext";
import DarkModeToggle from "./components/DarkModeToggle";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && !data.error) {
        login(data); 
        navigate("/");
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
      <div className="absolute top-8 right-8">
        <DarkModeToggle />
      </div>

      <form
        onSubmit={handleSubmit}
        className="card-shell w-full max-w-md p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-lg shadow-brand-500/20">A</div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-zinc-100">AutoVet Login</h1>
          <p className="text-slate-500 dark:text-zinc-400">Welcome back, Pet Owner!</p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-1">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input-field"
            placeholder="name@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password" uncomfortable-name="password" className="block text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-1">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="input-field pr-10"
              placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none dark:hover:text-zinc-300 transition-colors"
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

        <div className="space-y-4 pt-2">
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

          <p className="text-center text-sm text-slate-500 dark:text-zinc-400">
            Don't have an account?{" "}
            <Link to="/register" className="font-bold text-brand-600 hover:text-brand-700">Register</Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
