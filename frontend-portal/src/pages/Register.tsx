import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import clsx from "clsx";
import { FiArrowLeft, FiEye, FiEyeOff, FiPhone, FiMail, FiUser, FiLock, FiMapPin, FiChevronDown, FiMap } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import DarkModeToggle from "../components/DarkModeToggle";
import { PH_LOCATION_DATA, Province, City } from "../utils/phLocationData";
import logo from "../assets/logo.png";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  
  // Location States
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [availableCities, setAvailableCities] = useState<City[]>([]);
  
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  // Auto-fill logic for Cities when Province changes
  useEffect(() => {
    const selectedProvince = PH_LOCATION_DATA.find(p => p.name === province);
    if (selectedProvince) {
      setAvailableCities(selectedProvince.cities);
      setCity(""); // Reset city when province changes
      setZip("");  // Reset zip when province changes
    } else {
      setAvailableCities([]);
    }
  }, [province]);

  // Auto-fill logic for Zip when City changes
  useEffect(() => {
    const selectedCity = availableCities.find(c => c.name === city);
    if (selectedCity) {
      setZip(selectedCity.zip);
    }
  }, [city, availableCities]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 11) {
      setPhone(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.length !== 11) {
      setError("Contact number must be exactly 11 digits.");
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ 
          name, 
          email, 
          phone,
          address,
          city,
          province,
          zip,
          password, 
          password_confirmation: passwordConfirmation 
        }),
      });

      const data = await res.json();

      if (res.ok && !data.error) {
        register(data);
        navigate("/");
      } else {
        if (data.errors) {
          const firstError = Object.values(data.errors)[0] as string[];
          setError(firstError[0] || "Registration failed. Ensure you used a real email.");
        } else {
          const errorMsg = typeof data.error === "string" 
            ? data.error 
            : (data.error?.message || data.message || "Registration failed.");
          setError(errorMsg);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-dark-bg transition-colors duration-300 relative py-12 px-4">
      <div className="absolute top-8 left-8">
        <Link 
          to="/" 
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-600 dark:text-zinc-400 font-bold hover:text-brand-500 transition-all shadow-sm active:scale-95"
        >
          <FiArrowLeft /> Back to Page
        </Link>
      </div>

      <div className="absolute top-8 right-8">
        <DarkModeToggle />
      </div>

      <form
        onSubmit={handleSubmit}
        className="card-shell w-full max-w-xl p-8 space-y-5 animate-in fade-in zoom-in-95 duration-500"
      >
        <div className="text-center space-y-2">
          <img src={logo} alt="Pet Wellness Animal Clinic Logo" className="mx-auto w-16 h-16 object-contain" />
          <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-tight">Create Account</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm text-balance">Join Pet Wellness Animal Clinic with your accurate details</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <FiUser className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                className="input-field pl-10"
                placeholder="Juan Dela Cruz"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Real Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <FiMail className="h-4 w-4" />
              </div>
              <input
                type="email"
                autoComplete="email"
                required
                className="input-field pl-10"
                placeholder="must be a real email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Contact Number */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Contact Number</label>
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <div className="flex h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold text-zinc-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300">
                  <span className="text-lg">🇵🇭</span>
                  <span className="opacity-50">+63</span>
                </div>
              </div>
              <div className="relative flex-1">
                <input
                  type="tel"
                  required
                  className="input-field"
                  placeholder="09123456789"
                  value={phone}
                  onChange={handlePhoneChange}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Street Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <FiMapPin className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                className="input-field pl-10"
                placeholder="Unit #, Street Name"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
          </div>

          {/* Province Dropdown */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Province</label>
            <div className="relative">
              <select
                required
                className="input-field appearance-none pr-10"
                value={province}
                onChange={e => setProvince(e.target.value)}
              >
                <option value="">Select Province...</option>
                {PH_LOCATION_DATA.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
            </div>
          </div>

          {/* City Dropdown */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">City / Municipality</label>
            <div className="relative">
              <select
                required
                disabled={!province}
                className="input-field appearance-none pr-10 disabled:opacity-50"
                value={city}
                onChange={e => setCity(e.target.value)}
              >
                <option value="">Select City...</option>
                {availableCities.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
            </div>
          </div>

          {/* Automatic Zip Code */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-emerald-600 mb-1.5">Zip Code (Auto)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-500">
                <FiMap className="h-4 w-4" />
              </div>
              <input
                type="text"
                readOnly
                className="input-field pl-10 bg-emerald-50/50 border-emerald-100 text-emerald-700 font-bold dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400 cursor-not-allowed"
                placeholder="Select city..."
                value={zip}
              />
            </div>
          </div>

          <div className="md:col-span-1 hidden md:block"></div>

          {/* Password */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <FiLock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="input-field pl-10 pr-10"
                placeholder="Min. 8 chars"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-brand-500 transition-colors"
              >
                {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Re-enter Password */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <FiLock className="h-4 w-4" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                className="input-field pl-10 pr-10"
                placeholder="Repeat password"
                value={passwordConfirmation}
                onChange={e => setPasswordConfirmation(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-brand-500 transition-colors"
              >
                {showConfirmPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm font-bold text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400 animate-shake">
            {error}
          </div>
        )}
        
        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-dark-border">
          <button
            type="submit"
            disabled={loading}
            className={clsx(
              "w-full h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 text-white font-black text-lg transition-all hover:scale-[1.01] shadow-xl shadow-zinc-900/20 active:scale-[0.98]",
              loading && "opacity-60 cursor-not-allowed"
            )}
          >
            {loading ? "Creating Account..." : "Create My Account"}
          </button>
          
          <p className="text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link to="/login" className="font-black text-brand-600 hover:text-brand-700">Log in here</Link>
          </p>
        </div>
      </form>
    </div>
  );
}
