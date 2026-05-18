import { useState, useEffect } from "react";
import clsx from "clsx";
import { FiMapPin, FiChevronDown, FiMap, FiX } from "react-icons/fi";
import { PH_LOCATION_DATA, City } from "../utils/phLocationData";
import PhoneInput from "./PhoneInput";
import { useAuth } from "../context/AuthContext";

interface Props {
  token: string;
  onComplete: (user: any) => void;
}

export default function CompleteProfileModal({ token, onComplete }: Props) {
  const [phone, setPhone]                           = useState("");
  const [address, setAddress]                       = useState("");
  const [province, setProvince]                     = useState("");
  const [city, setCity]                             = useState("");
  const [zip, setZip]                               = useState("");
  const [availableCities, setAvailableCities]       = useState<City[]>([]);
  const [loading, setLoading]                       = useState(false);
  const [error, setError]                           = useState("");
  const { updateUser } = useAuth();

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
    if (normalizedPhone.length !== 11) {
      setError("Please enter a valid 11-digit contact number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/profile/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: normalizedPhone, address, province, city, zip }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        const updated = { ...data.user, token };
        updateUser(updated);
        onComplete(updated);
      } else {
        if (data.errors) {
          const first = Object.values(data.errors)[0] as string[];
          setError(first[0] || "Please check your details.");
        } else {
          setError(data.message || "Something went wrong.");
        }
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-dark-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-500 to-emerald-600 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Complete Your Profile 🐾</h2>
              <p className="text-emerald-100 text-sm mt-1 font-medium">
                Just a few more details so we can serve you better.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Phone */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">
              Contact Number
            </label>
            <PhoneInput value={phone} onChange={setPhone} placeholder="09123456789" />
          </div>

          {/* Street Address */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">
              Street Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <FiMapPin className="h-4 w-4" />
              </div>
              <input
                type="text" required
                className="input-field pl-10"
                placeholder="Unit #, Street Name"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Province */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">
                Province
              </label>
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
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-1.5">
                City / Municipality
              </label>
              <div className="relative">
                <select required disabled={!province} className="input-field appearance-none pr-10 disabled:opacity-50" value={city} onChange={e => setCity(e.target.value)}>
                  <option value="">Select City...</option>
                  {availableCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
              </div>
            </div>
          </div>

          {/* Zip (auto) */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-emerald-600 mb-1.5">
              Zip Code (Auto-filled)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-500">
                <FiMap className="h-4 w-4" />
              </div>
              <input
                type="text" readOnly
                className="input-field pl-10 bg-emerald-50/50 border-emerald-100 text-emerald-700 font-bold dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400 cursor-not-allowed"
                placeholder="Select city..."
                value={zip}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-sm text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className={clsx(
                "w-full h-12 rounded-xl bg-brand-500 text-white font-black text-base transition-all hover:bg-brand-600 shadow-lg shadow-brand-500/20 active:scale-[0.98] flex items-center justify-center gap-2",
                loading && "opacity-60 cursor-not-allowed"
              )}
            >
              {loading ? "Saving…" : "Save & Continue 🐾"}
            </button>
            <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 font-medium">
              You can update this anytime from your profile settings.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
