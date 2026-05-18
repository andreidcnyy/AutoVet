import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import clsx from "clsx";
import { FiArrowLeft, FiEye, FiEyeOff, FiMail, FiUser, FiLock, FiMapPin, FiChevronDown, FiMap, FiHeart, FiBell, FiUsers } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import DarkModeToggle from "../components/DarkModeToggle";
import CompleteProfileModal from "../components/CompleteProfileModal";
import PhoneInput from "../components/PhoneInput";
import { PH_LOCATION_DATA, City } from "../utils/phLocationData";
import { PawPrint, PawTrail, CatSilhouette, DogSilhouette } from "./Landing";
import logo from "../assets/logo.png";

const PERKS = [
  { icon: <FiHeart />,  text: "Track your pet's health history"       },
  { icon: <FiBell />,   text: "Get reminders for vaccines & check-ups" },
  { icon: <FiUsers />,  text: "Connect directly with your vet online"  },
];

export default function Register() {
  const [name, setName]                             = useState("");
  const [email, setEmail]                           = useState("");
  const [phone, setPhone]                           = useState("");
  const [address, setAddress]                       = useState("");
  const [province, setProvince]                     = useState("");
  const [city, setCity]                             = useState("");
  const [zip, setZip]                               = useState("");
  const [availableCities, setAvailableCities]       = useState<City[]>([]);
  const [password, setPassword]                     = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword]             = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError]                           = useState("");
  const [loading, setLoading]                       = useState(false);
  const [success, setSuccess]                       = useState(false);
  const [googleLoading, setGoogleLoading]           = useState(false);
  const [pendingGoogle, setPendingGoogle]           = useState<{ accessToken: string; name: string; email: string } | null>(null);
  const navigate = useNavigate();
  const { register, login } = useAuth();

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
      if (res.ok && data.needs_profile) {
        // New user — collect profile before creating account
        setPendingGoogle({ accessToken, name: data.name, email: data.email });
      } else if (res.ok && data.token) {
        // Existing user — log in directly
        login(data);
        navigate("/dashboard");
      } else {
        setError(data.error || data.message || "Google sign-in failed.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleRegister = async (profileData: { phone: string; address: string; province: string; city: string; zip: string }) => {
    if (!pendingGoogle) return;
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ access_token: pendingGoogle.accessToken, ...profileData }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      login(data);
      navigate("/dashboard");
    } else {
      throw new Error(data.error || data.message || "Registration failed.");
    }
  };

  const googleSignup = () => {
    if (!window.google) {
      setError("Google sign-in is loading, please try again in a moment.");
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: "email profile openid",
      callback: (response) => {
        if (response.error || !response.access_token) {
          setError("Google sign-in was cancelled or failed.");
          return;
        }
        handleGoogleSuccess(response.access_token);
      },
    });
    client.requestAccessToken();
  };

  useEffect(() => {
    const sel = PH_LOCATION_DATA.find(p => p.name === province);
    if (sel) { setAvailableCities(sel.cities); setCity(""); setZip(""); }
    else      setAvailableCities([]);
  }, [province]);

  useEffect(() => {
    const sel = availableCities.find(c => c.name === city);
    if (sel) setZip(sel.zip);
  }, [city, availableCities]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPhone = phone.startsWith('+63')
      ? '0' + phone.slice(3).replace(/\D/g, '')
      : phone.replace(/\D/g, '');
    if (normalizedPhone.length !== 11) { setError("Please enter a valid 11-digit contact number."); return; }
    if (password !== passwordConfirmation) { setError("Passwords do not match."); return; }

    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ name, email, phone: normalizedPhone, address, city, province, zip, password, password_confirmation: passwordConfirmation }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setSuccess(true);
      } else {
        if (data.errors) {
          const first = Object.values(data.errors)[0] as string[];
          setError(first[0] || "Registration failed.");
        } else {
          setError(data.message || data.error || "Registration failed.");
        }
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
        onComplete={() => navigate("/dashboard")}
        onRegister={handleGoogleRegister}
        prefillName={pendingGoogle.name}
        prefillEmail={pendingGoogle.email}
      />
    );
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-dark-bg p-4 relative overflow-hidden">
        <PawPrint className="absolute top-8  right-8  w-32 h-32 text-brand-500 opacity-[0.12] rotate-12  pointer-events-none" />
        <PawPrint className="absolute bottom-8 left-8  w-24 h-24 text-brand-500 opacity-[0.10] -rotate-15 pointer-events-none" />
        <DogSilhouette className="absolute bottom-0 right-0 w-48 text-brand-500 opacity-[0.08] pointer-events-none" />

        <div className="card-shell w-full max-w-md p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 relative">
          <PawTrail className="absolute top-2 left-1/2 -translate-x-1/2 w-28 text-brand-500 opacity-20" />
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <FiMail className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-tight">Verify Your Email</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            We've sent a verification link to <span className="font-bold text-zinc-800 dark:text-zinc-200">{email}</span>.
            Please check your inbox (and spam folder) to complete your registration.
          </p>
          <div className="pt-4">
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-black uppercase tracking-widest text-xs hover:scale-105 transition-all">
              Go to Login 🐾
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main register page ── */
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300">

      {/* ── Left decorative panel (sticky) ── */}
      <div className="hidden lg:flex lg:w-5/12 sticky top-0 h-screen flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-brand-500 to-emerald-700 p-12 shrink-0">

        {/* Scattered paws */}
        <PawPrint className="absolute top-6    right-6   w-28 h-28 text-white opacity-20  rotate-20  pointer-events-none" />
        <PawPrint className="absolute top-1/2  left-4    w-16 h-16 text-white opacity-15 -rotate-15 pointer-events-none" />
        <PawPrint className="absolute bottom-20 right-10 w-22 h-22 text-white opacity-20  rotate-8   pointer-events-none" />
        <PawPrint className="absolute top-2/3  right-1/4 w-12 h-12 text-white opacity-15 -rotate-25 pointer-events-none" />
        <PawTrail className="absolute top-20   left-1/3  w-40 text-white opacity-15 rotate-8  pointer-events-none" />
        <PawTrail className="absolute bottom-36 left-6   w-44 text-white opacity-20 -rotate-4 pointer-events-none" />

        {/* Cat at bottom-right, Dog peeking top-left */}
        <CatSilhouette className="absolute bottom-0 right-0 w-60 text-white opacity-25 pointer-events-none" />
        <DogSilhouette className="absolute -top-2 -left-6 w-44 text-white opacity-20 pointer-events-none -scale-x-100" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-12 h-12 object-contain drop-shadow-lg" />
            <span className="text-white font-black text-lg uppercase tracking-tight leading-tight">
              Pet Wellness<br />Animal Clinic
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <PawPrint className="absolute -left-8 top-1/2 -translate-y-1/2 w-56 h-56 text-white opacity-[0.08] pointer-events-none" />
          <div>
            <h2 className="text-4xl font-black text-white leading-tight">
              Join Our Pet<br />Wellness Family 🐾
            </h2>
            <p className="text-emerald-100 mt-3 text-base font-medium leading-relaxed">
              Create your free account and get access to everything your pet needs — all in one place.
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

      {/* ── Right scrollable form panel ── */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 pt-8 shrink-0">
          <Link to="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-600 dark:text-zinc-400 font-bold hover:text-brand-500 transition-all shadow-sm active:scale-95 text-sm">
            <FiArrowLeft /> Back
          </Link>
          <DarkModeToggle />
        </div>

        {/* Subtle paw on form side */}
        <PawPrint className="absolute bottom-16 right-6 w-28 h-28 text-brand-500 opacity-[0.08] dark:opacity-[0.04] rotate-12 pointer-events-none" />
        <PawPrint className="absolute top-36   right-2  w-16 h-16 text-emerald-500 opacity-[0.08] dark:opacity-[0.04] -rotate-20 pointer-events-none" />

        <div className="flex-1 flex items-start justify-center px-6 py-10">
          <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-5">

            <div className="text-center space-y-2 lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-1 lg:hidden">
                <img src={logo} alt="Logo" className="w-12 h-12 object-contain" />
              </div>
              <h1 className="text-3xl font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight">Create Account</h1>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
                Join Pet Wellness Animal Clinic — enter your accurate details 🐾
              </p>
            </div>

            {/* Google Sign-up */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => googleSignup()}
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
                Sign up with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-200 dark:bg-dark-border" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">or fill in manually</span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-dark-border" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Full Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400"><FiUser className="h-4 w-4" /></div>
                  <input type="text" required className="input-field pl-10" placeholder="Juan Dela Cruz" value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Real Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400"><FiMail className="h-4 w-4" /></div>
                  <input type="email" autoComplete="off" name="no-autofill-email" required className="input-field pl-10" placeholder="must be a real email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Contact Number</label>
                <PhoneInput value={phone} onChange={setPhone} placeholder="09123456789" />
              </div>

              {/* Street Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Street Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400"><FiMapPin className="h-4 w-4" /></div>
                  <input type="text" required className="input-field pl-10" placeholder="Unit #, Street Name" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
              </div>

              {/* Province */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Province</label>
                <div className="relative">
                  <select required className="input-field appearance-none pr-10" value={province} onChange={e => setProvince(e.target.value)}>
                    <option value="">Select Province...</option>
                    {PH_LOCATION_DATA.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                  <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                </div>
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">City / Municipality</label>
                <div className="relative">
                  <select required disabled={!province} className="input-field appearance-none pr-10 disabled:opacity-50" value={city} onChange={e => setCity(e.target.value)}>
                    <option value="">Select City...</option>
                    {availableCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                </div>
              </div>

              {/* Zip (auto) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-emerald-600 mb-1.5">Zip Code (Auto)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-500"><FiMap className="h-4 w-4" /></div>
                  <input type="text" readOnly className="input-field pl-10 bg-emerald-50/50 border-emerald-100 text-emerald-700 font-bold dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400 cursor-not-allowed" placeholder="Select city..." value={zip} />
                </div>
              </div>

              <div className="md:col-span-1 hidden md:block" />

              {/* Password */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400"><FiLock className="h-4 w-4" /></div>
                  <input type={showPassword ? "text" : "password"} required className="input-field pl-10 pr-10" placeholder="Min. 8 chars" value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-brand-500 transition-colors">
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400"><FiLock className="h-4 w-4" /></div>
                  <input type={showConfirmPassword ? "text" : "password"} required className="input-field pl-10 pr-10" placeholder="Repeat password" value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-brand-500 transition-colors">
                    {showConfirmPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm font-bold text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400">
                {error}
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-dark-border">
              <button type="submit" disabled={loading || googleLoading}
                className={clsx(
                  "w-full h-14 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-black text-lg transition-all hover:scale-[1.01] shadow-xl shadow-brand-500/20 active:scale-[0.98] flex items-center justify-center gap-2",
                  (loading || googleLoading) && "opacity-60 cursor-not-allowed"
                )}>
                {loading ? "Creating Account…" : <>Create My Account <span className="text-base">🐾</span></>}
              </button>
              <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
                By registering, you agree to our{" "}
                <Link to="/terms" className="font-bold text-brand-600 hover:text-brand-700">Terms of Service</Link>
                {" "}and{" "}
                <Link to="/privacy-policy" className="font-bold text-brand-600 hover:text-brand-700">Privacy Policy</Link>.
              </p>
              <p className="text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Already have an account?{" "}
                <Link to="/login" className="font-black text-brand-600 hover:text-brand-700">Log in here</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
