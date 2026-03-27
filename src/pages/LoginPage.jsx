import { useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
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
        login(data); // Set user context
        navigate("/");
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-bg">
      <form
        onSubmit={handleSubmit}
        className="card-shell w-full max-w-md p-8 space-y-6"
      >
        <h1 className="text-3xl font-bold text-center text-brand-600 dark:text-brand-500 mb-4">AutoVet Login</h1>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input-field"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input-field"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className={clsx(
            "w-full h-12 rounded-xl bg-brand-500 text-white font-semibold text-lg transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
            loading && "opacity-60 cursor-not-allowed"
          )}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
