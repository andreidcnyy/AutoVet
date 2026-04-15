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
  FiX,
  FiSave
} from 'react-icons/fi';
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditProfileModal({ isOpen, onClose, onSuccess }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema)
  });

  const selectedProvince = watch("province");

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setIsSuccess(false);
      setError(null);
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
    }
  }, [isOpen, reset]);

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

      if (onSuccess) onSuccess();
      setTimeout(onClose, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to update profile.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-dark-card rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-zinc-100 dark:border-dark-border flex justify-between items-center bg-zinc-50/50 dark:bg-dark-surface/30">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
              <FiUser className="text-brand-500" /> Edit Profile
            </h2>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Keep your information up to date</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto max-h-[70vh]">
          {isLoading ? (
            <div className="py-12 text-center text-zinc-400 font-bold uppercase tracking-widest animate-pulse">
              Fetching Profile...
            </div>
          ) : (
            <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-6">
              {isSuccess && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-sm font-bold animate-in slide-in-from-top-2">
                  <FiCheckCircle className="w-5 h-5 shrink-0" />
                  Profile updated successfully!
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-bold animate-in slide-in-from-top-2">
                  <FiAlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

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

                <div className="space-y-2 text-zinc-400">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input 
                      {...register("email")}
                      className="input-field pl-12 font-bold bg-zinc-100 dark:bg-dark-surface/50 text-zinc-500 cursor-not-allowed border-zinc-200 dark:border-dark-border"
                      readOnly
                      disabled
                    />
                  </div>
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

              <div className="pt-4">
                <button 
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full h-16 rounded-2xl bg-brand-500 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-500/20 hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <FiSave className="w-5 h-5" />
                  {isSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
