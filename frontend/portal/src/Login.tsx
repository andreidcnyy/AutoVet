import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import clsx from "clsx";
import { FiEye, FiEyeOff, FiArrowLeft, FiCalendar, FiFileText, FiShield } from "react-icons/fi";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "./context/AuthContext";
import DarkModeToggle from "./components/DarkModeToggle";
import CompleteProfileModal from "./components/CompleteProfileModal";
import { PawPrint, PawTrail, DogSilhouette, CatSilhouette } from "./pages/Landing";
import logo from "./assets/logo.png";

const PERKS = [
  { icon: <FiCalendar />, text: "Book appointments online anytime"   },
  { icon: <FiFileText />, text: "Access your pet's full health records" },
  { icon: <FiShield />,   text: "Secure, private, and always available" },
];

function LoginPage() {
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingGoogle, setPendingGoogle] = useState<{ token: string } | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGoogleSuccess = async (accessToken: string) => {
    setGoogleLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        if (data.profile_complete === false) {
          setPendingGoogle({ token: data.token });
          login(data);
        } else {
          login(data);
          navigate("/dashboard");
        }
      } else {
        setError(data.error || data.message || "Google sign-in failed.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse: import("@react-oauth/google").TokenResponse) => handleGoogleSuccess(tokenResponse.access_token),
    onError:   () => setError("Google sign-in was cancelled or failed."),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && !data.error) {
        login(data);
        navigate("/dashboard");
      } else {
        let errorMsg = "Invalid credentials";
        if (typeof data.error === "string")          errorMsg = data.error;
        else if (data.error?.message)                errorMsg = data.error.message;
        else if (data.message)                       errorMsg = data.message;
        setError(String(errorMsg));
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (pendingGoogle) {
    return (
      <CompleteProfileModal
        token={pendingGoogle.token}
        onComplete={() => navigate("/dashboard")}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300">

      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-500 via-emerald-600 to-emerald-700 p-12">

        {/* Scattered paws */}
        <PawPrint className="absolute top-8    right-8   w-32 h-32 text-white opacity-20 rotate-12  pointer-events-none" />
        <PawPrint className="absolute top-1/3  left-4    w-20 h-20 text-white opacity-15 -rotate-20 pointer-events-none" />
        <PawPrint className="absolute bottom-24 right-6  w-24 h-24 text-white opacity-20 rotate-30  pointer-events-none" />
        <PawPrint className="absolute top-2/3  right-1/3 w-14 h-14 text-white opacity-15 -rotate-10 pointer-events-none" />
        <PawTrail className="absolute bottom-40 left-8   w-48 text-white opacity-20 pointer-events-none -rotate-6" />
        <PawTrail className="absolute top-16   left-1/3  w-36 text-white opacity-15 pointer-events-none rotate-6" />

        {/* Dog sits at bottom-right */}
        <DogSilhouette className="absolute bottom-0 right-0 w-64 text-white opacity-25 pointer-events-none" />
        {/* Cat peeks from top-left */}
        <CatSilhouette className="absolute -top-4 -left-4 w-40 text-white opacity-20 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <img src={logo} alt="Logo" className="w-12 h-12 object-contain drop-shadow-lg" />
            <span className="text-white font-black text-lg uppercase tracking-tight leading-tight">
              Pet Wellness<br />Animal Clinic
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          {/* Big paw watermark behind text */}
          <PawPrint className="absolute -left-8 top-1/2 -translate-y-1/2 w-64 h-64 text-white opacity-10 pointer-events-none" />

          <div>
            <h2 className="text-4xl font-black text-white leading-tight">
              Your Pet Deserves<br />the Best Care 🐾
            </h2>
            <p className="text-emerald-100 mt-3 text-base font-medium leading-relaxed">
              Sign in to manage appointments, view health records, and stay connected with your vet.
            </p>
          </div>

          <ul className="space-y-3">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-white text-sm font-bold">
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-base">
                  {p.icon}
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <PawTrail className="w-36 text-white opacity-30" />
          <p className="text-emerald-200 text-xs font-bold mt-3">© 2026 Digivet Management System</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col relative">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 pt-8">
          <Link to="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-600 dark:text-zinc-400 font-bold hover:text-brand-500 transition-all shadow-sm active:scale-95 text-sm">
            <FiArrowLeft /> Back
          </Link>
          <DarkModeToggle />
        </div>

        {/* Subtle paw decoratives on form side */}
        <PawPrint className="absolute bottom-12 right-6 w-28 h-28 text-brand-500 opacity-[0.08] dark:opacity-[0.05] rotate-12 pointer-events-none" />
        <PawPrint className="absolute top-32 right-2  w-16 h-16 text-emerald-500 opacity-[0.08] dark:opacity-[0.04] -rotate-20 pointer-events-none" />

        {/* Form centered */}
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">

            {/* Logo (mobile only — panel hidden on mobile) */}
            <div className="text-center space-y-2 lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-1">
                <img src={logo} alt="Logo" className="w-12 h-12 object-contain lg:hidden" />
              </div>
              <h1 className="text-3xl font-black text-zinc-800 dark:text-zinc-100">Welcome back!</h1>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                Sign in to your Pet Wellness account 🐾
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Email Address
                </label>
                <input id="email" type="email" autoComplete="off" name="no-autofill-email" required
                  className="input-field"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-bold text-zinc-600 dark:text-zinc-400">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs font-bold text-brand-600 hover:text-brand-700">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                    className="input-field pr-10"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                    {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-sm text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400">
                {error}
              </div>
            )}

            <div className="space-y-4 pt-2">
              <button type="submit" disabled={loading || googleLoading}
                className={clsx(
                  "w-full h-12 rounded-xl bg-brand-500 text-white font-bold text-lg transition-all hover:bg-brand-600 shadow-lg shadow-brand-500/20 active:scale-[0.98] flex items-center justify-center gap-2",
                  (loading || googleLoading) && "opacity-60 cursor-not-allowed"
                )}>
                {loading ? "Signing in…" : <>Log In <span className="text-base">🐾</span></>}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-200 dark:bg-dark-border" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-dark-border" />
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={() => googleLogin()}
                disabled={loading || googleLoading}
                className={clsx(
                  "w-full h-12 rounded-xl border-2 border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card text-zinc-700 dark:text-zinc-200 font-bold text-sm transition-all hover:border-brand-400 hover:bg-zinc-50 dark:hover:bg-dark-border active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm",
                  (loading || googleLoading) && "opacity-60 cursor-not-allowed"
                )}>
                {googleLoading ? (
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </button>

              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Don't have an account?{" "}
                <Link to="/register" className="font-bold text-brand-600 hover:text-brand-700">Register here</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
