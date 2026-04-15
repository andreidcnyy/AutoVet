import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getProfile, updateProfile } from '../api';
import { 
  FiUser, 
  FiMail, 
  FiPhone, 
  FiMapPin, 
  FiCheckCircle, 
  FiAlertCircle,
  FiArrowLeft,
  FiSave
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { PH_LOCATION_DATA } from '../utils/phLocationData';
import clsx from 'clsx';

const profileSchema = z.object({
  name: z.string().min(1, "Full name is required").max(255),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().min(1, "Phone number is required").length(11, "Must be 11 digits"),
  address: z.string().min(1, "Street address is required").max(255),
  city: z.string().min(1, "City is required"),
  province: z.string().min(1, "Province is required"),
  zip: z.string().optional()
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function Profile() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<any[]>([]);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema)
  });

  const selectedProvince = watch("province");

  useEffect(() => {
    getProfile()
      .then(res => {
        const data = res.data;
        reset({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          city: data.city || "",
          province: data.province || "",
          zip: data.zip || ""
        });
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Failed to load profile data.");
        setIsLoading(false);
      });
  }, [reset]);

  useEffect(() => {
    const provinceData = PH_LOCATION_DATA.find(p => p.name === selectedProvince);
    if (provinceData) {
      setAvailableCities(provinceData.cities);
    } else {
      setAvailableCities([]);
    }
  }, [selectedProvince]);

  const onProfileSubmit = async (data: ProfileForm) => {
    setError(null);
    setIsSuccess(false);
    try {
      await updateProfile(data);
      setIsSuccess(true);
      // Update local storage user name if changed
      const localUser = localStorage.getItem('user');
      if (localUser) {
        const parsed = JSON.parse(localUser);
        parsed.name = data.name;
        localStorage.setItem('user', JSON.stringify(parsed));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to update profile.");
    }
  };

  if (isLoading) return <div className="p-8 text-center text-zinc-500 font-bold uppercase tracking-widest animate-pulse">Synchronizing Profile...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-500 hover:text-zinc-800 transition-all">
          <FiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
            <FiUser className="text-brand-500" /> Account Profile
          </h1>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Manage your personal information</p>
        </div>
      </div>

      {isSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-sm font-bold animate-in zoom-in-95">
          <FiCheckCircle className="w-5 h-5 shrink-0" />
          Profile updated successfully!
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-bold animate-in zoom-in-95">
          <FiAlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-6">
        <div className="card-shell p-8 bg-white dark:bg-dark-card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  {...register("name")}
                  className={clsx("input-field pl-12 font-bold", errors.name && "border-rose-500")}
                  placeholder="Juan Dela Cruz"
                />
              </div>
              {errors.name && <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Email Address</label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  {...register("email")}
                  className={clsx("input-field pl-12 font-bold bg-zinc-100 dark:bg-dark-surface/50 text-zinc-500 cursor-not-allowed opacity-75", errors.email && "border-rose-500")}
                  placeholder="juan@example.com"
                  readOnly
                  disabled
                />
              </div>
              <p className="text-[9px] text-zinc-400 font-bold uppercase ml-1 italic">* Contact admin to change email</p>
              {errors.email && <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Contact Number</label>
              <div className="relative">
                <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  {...register("phone")}
                  className={clsx("input-field pl-12 font-bold", errors.phone && "border-rose-500")}
                  placeholder="09123456789"
                  maxLength={11}
                />
              </div>
              {errors.phone && <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="h-px bg-zinc-100 dark:bg-dark-border" />

          <div className="space-y-4">
             <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Street Address</label>
                <div className="relative">
                  <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    {...register("address")}
                    className={clsx("input-field pl-12 font-bold", errors.address && "border-rose-500")}
                    placeholder="123 Mabini St."
                  />
                </div>
                {errors.address && <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{errors.address.message}</p>}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Province</label>
                  <select 
                    {...register("province")}
                    className={clsx("input-field font-bold", errors.province && "border-rose-500")}
                  >
                    <option value="">Select Province</option>
                    {PH_LOCATION_DATA.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">City / Municipality</label>
                  <select 
                    {...register("city")}
                    className={clsx("input-field font-bold", errors.city && "border-rose-500")}
                    disabled={!selectedProvince}
                  >
                    <option value="">Select City</option>
                    {availableCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
             </div>
          </div>
        </div>

        <button 
          disabled={isSubmitting}
          type="submit"
          className="w-full h-16 rounded-2xl bg-brand-500 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-500/20 hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          <FiSave className="w-5 h-5" />
          {isSubmitting ? "Updating..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
