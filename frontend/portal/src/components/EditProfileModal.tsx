import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getProfile, updateProfile, forgotPassword, deleteAccount, changePassword } from '../api';
import PhoneInput from './PhoneInput';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FiUser,
  FiMail,
  FiMapPin,
  FiCheckCircle,
  FiAlertCircle,
  FiX,
  FiSave,
  FiLock,
  FiTrash2,
  FiAlertTriangle
} from 'react-icons/fi';
import { PH_LOCATION_DATA } from '../utils/phLocationData';
import clsx from 'clsx';
import { readCache, writeCache } from '../utils/swrCache';

const profileSchema = z.object({
  name: z.string().min(1, "Full name is required").max(255),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().min(1, "Phone number is required"),
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
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
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
          setHasPassword(!!data.has_password);
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      logout();
      navigate('/login');
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Set / change password (Google accounts start with no password)
  const [hasPassword, setHasPassword] = useState(true);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [isSavingPw, setIsSavingPw] = useState(false);

  const handleSetPassword = async () => {
    setPwError(null);
    setPwMessage(null);
    if (pwNew.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (pwNew !== pwConfirm) { setPwError('Passwords do not match.'); return; }
    setIsSavingPw(true);
    try {
      const res = await changePassword({
        current_password: pwCurrent,
        password: pwNew,
        password_confirmation: pwConfirm,
      });
      setPwMessage(res.data?.message || 'Password saved.');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      setHasPassword(true);
    } catch (err: any) {
      setPwError(err.response?.data?.message || 'Failed to save password.');
    } finally {
      setIsSavingPw(false);
    }
  };

  const handleResetPassword = async () => {
    const email = watch("email");
    if (!email) {
      setError("Email is required for password reset.");
      return;
    }
    
    setIsResetting(true);
    setResetMessage(null);
    setError(null);
    try {
      await forgotPassword(email);
      setResetMessage("A password reset link has been sent to your email.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send reset link.");
    } finally {
      setIsResetting(false);
    }
  };

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
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <PhoneInput 
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.phone}
                        placeholder="09123456789"
                      />
                    )}
                  />
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

              <div className="h-px bg-zinc-100 dark:bg-dark-border" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                      <FiLock className="text-brand-500" /> Account Security
                    </h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Manage your password and security</p>
                  </div>
                </div>

                {resetMessage && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 text-sm font-bold animate-in slide-in-from-top-2">
                    <FiCheckCircle className="w-5 h-5 shrink-0" />
                    {resetMessage}
                  </div>
                )}

                {/* Set / change password — Google accounts start with no password */}
                <div className="rounded-2xl border-2 border-zinc-100 dark:border-dark-border p-4 space-y-3">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
                    {hasPassword ? 'Change Password' : 'Set a Password'}
                  </p>
                  {!hasPassword && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Your account uses Google Sign-In. Set a password to also log in with your email.
                    </p>
                  )}

                  {pwMessage && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      <FiCheckCircle className="w-4 h-4 shrink-0" /> {pwMessage}
                    </div>
                  )}
                  {pwError && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold">
                      <FiAlertCircle className="w-4 h-4 shrink-0" /> {pwError}
                    </div>
                  )}

                  {hasPassword && (
                    <input
                      type="password"
                      placeholder="Current password"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border-2 border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm focus:border-brand-400 focus:outline-none"
                    />
                  )}
                  <input
                    type="password"
                    placeholder="New password (min 8 characters)"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border-2 border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm focus:border-brand-400 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border-2 border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm focus:border-brand-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSetPassword}
                    disabled={isSavingPw}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-xs hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <FiLock className="w-4 h-4" />
                    {isSavingPw ? 'Saving...' : (hasPassword ? 'Update Password' : 'Set Password')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isResetting}
                  className="flex items-center gap-3 px-6 py-3 rounded-xl border-2 border-zinc-200 dark:border-dark-border text-zinc-600 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-dark-surface transition-all active:scale-95 disabled:opacity-50"
                >
                  <FiMail className="w-4 h-4" />
                  {isResetting ? "Sending Request..." : "Send Password Reset Email"}
                </button>
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

              {/* ── Danger Zone ── */}
              <div className="mt-2 rounded-2xl border-2 border-rose-200 dark:border-rose-900/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setShowDeleteZone(v => !v); setDeleteConfirmText(''); setDeleteError(null); }}
                  className="w-full flex items-center justify-between px-5 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-colors"
                >
                  <div className="flex items-center gap-2 font-black uppercase tracking-widest text-xs">
                    <FiTrash2 className="w-4 h-4" />
                    Danger Zone — Delete Account
                  </div>
                  <span className="text-xs font-bold opacity-60">{showDeleteZone ? '▲ Hide' : '▼ Show'}</span>
                </button>

                {showDeleteZone && (
                  <div className="p-5 space-y-4 bg-white dark:bg-dark-card">
                    {/* What gets deleted */}
                    <div className="flex gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30">
                      <FiAlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-black text-rose-700 dark:text-rose-400">This action is permanent and cannot be undone.</p>
                        <p className="text-xs text-rose-600/80 dark:text-rose-400/70 font-medium">Deleting your account will permanently remove:</p>
                        <ul className="text-xs text-rose-600/80 dark:text-rose-400/70 font-medium space-y-0.5 mt-1 ml-2 list-disc list-inside">
                          <li>Your profile and personal information</li>
                          <li>All registered pets and their profiles</li>
                          <li>Your appointment history and booking records</li>
                          <li>All notifications and messages</li>
                          <li>Access to medical records linked to your account</li>
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Type <span className="text-rose-500 font-black">DELETE MY ACCOUNT</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={e => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE MY ACCOUNT"
                        className="input-field font-bold border-rose-200 dark:border-rose-900/50 focus:border-rose-500 text-rose-700 dark:text-rose-400 placeholder:text-rose-300 dark:placeholder:text-rose-900"
                      />
                    </div>

                    {deleteError && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 text-xs text-rose-600 dark:text-rose-400 font-bold">
                        <FiAlertCircle className="w-4 h-4 shrink-0" />
                        {deleteError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE MY ACCOUNT' || isDeleting}
                      className="w-full h-12 rounded-xl bg-rose-500 text-white font-black uppercase tracking-widest text-xs hover:bg-rose-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      {isDeleting ? "Deleting Account..." : "Permanently Delete My Account"}
                    </button>
                  </div>
                )}
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
