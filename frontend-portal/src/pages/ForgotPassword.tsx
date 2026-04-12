import { useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiMail, FiCheckCircle } from "react-icons/fi";
import DarkModeToggle from "../components/DarkModeToggle";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-dark-bg transition-colors duration-300 relative">
      <div className="absolute top-8 left-8">
        <Link 
          to="/login" 
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-600 dark:text-zinc-400 font-bold hover:text-brand-500 transition-all shadow-sm active:scale-95"
        >
          <FiArrowLeft /> Back to Login
        </Link>
      </div>

      <div className="absolute top-8 right-8">
        <DarkModeToggle />
      </div>

      <div className="card-shell w-full max-w-md p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-lg shadow-brand-500/20">A</div>
          <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">Reset Password</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Enter your email to receive a reset link</p>
        </div>

        {message ? (
          <div className="text-center space-y-4 py-4 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
              <FiCheckCircle />
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 font-medium px-4">
              {message}
            </p>
            <Link to="/login" className="block font-bold text-brand-600 hover:text-brand-700">Return to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <FiMail />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  className="input-field pl-10"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
              {loading ? "Sending Link..." : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
