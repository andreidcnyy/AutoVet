import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import DarkModeToggle from "../components/DarkModeToggle";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (res.ok && !data.error) {
        register(data);
        navigate("/");
      } else {
        setError(data.error || data.message || "Registration failed");
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
          <h1 className="text-3xl font-bold text-slate-800 dark:text-zinc-100">Create Account</h1>
          <p className="text-slate-500 dark:text-zinc-400">Join the AutoVet community</p>
        </div>
        
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-1">Full Name</label>
          <input
            id="name"
            type="text"
            required
            className="input-field"
            placeholder="Juan Dela Cruz"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-1">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input-field"
            placeholder="juan@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password" uncomfortable-name="password" className="block text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-1">Password</label>
          <input
            id="password"
            type="password"
            required
            className="input-field"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-sm text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400">
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
            {loading ? "Creating Account..." : "Register"}
          </button>
          
          <p className="text-center text-sm text-slate-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">Log in</Link>
          </p>
        </div>
      </form>
    </div>
  );
}
