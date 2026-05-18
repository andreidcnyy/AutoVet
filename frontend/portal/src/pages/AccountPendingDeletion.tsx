import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiRefreshCcw, FiLogOut, FiClock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { recoverAccount } from '../api';
import { PawPrint } from './Landing';
import logo from '../assets/logo.png';
import clsx from 'clsx';

export default function AccountPendingDeletion() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState('');

  const daysRemaining = user?.days_remaining ?? 30;
  const deletionDate = user?.deletion_requested_at
    ? new Date(new Date(user.deletion_requested_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';

  const handleRecover = async () => {
    setRecovering(true);
    setError('');
    try {
      await recoverAccount();
      // Clear the pending deletion flag from the user object
      updateUser({ ...user, account_pending_deletion: false, days_remaining: undefined, deletion_requested_at: undefined });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to recover account. Please try again.');
      setRecovering(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg flex items-center justify-center p-6 relative overflow-hidden">
      <PawPrint className="absolute top-8 right-8 w-40 h-40 text-rose-400 opacity-10 rotate-12 pointer-events-none" />
      <PawPrint className="absolute bottom-8 left-8 w-32 h-32 text-rose-400 opacity-10 -rotate-15 pointer-events-none" />
      <PawPrint className="absolute top-1/2 left-4 w-20 h-20 text-rose-400 opacity-10 rotate-45 pointer-events-none" />

      <div className="w-full max-w-lg space-y-6 animate-in fade-in zoom-in-95 duration-500">

        {/* Header */}
        <div className="text-center space-y-3">
          <img src={logo} alt="Logo" className="w-14 h-14 object-contain mx-auto" />
          <span className="block text-sm font-black uppercase tracking-widest text-zinc-400">Pet Wellness Animal Clinic</span>
        </div>

        {/* Main card */}
        <div className="bg-white dark:bg-dark-card rounded-3xl shadow-2xl overflow-hidden border border-rose-100 dark:border-rose-900/30">

          {/* Red top band */}
          <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-8 py-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <FiAlertTriangle className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-black">Account Scheduled for Deletion</h1>
            </div>
            <p className="text-rose-100 text-sm font-medium">
              Your account is in a 30-day grace period before permanent deletion.
            </p>
          </div>

          <div className="p-8 space-y-6">

            {/* Countdown */}
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30">
              <div className="w-16 h-16 rounded-2xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30">
                <span className="text-2xl font-black text-white">{daysRemaining}</span>
              </div>
              <div>
                <p className="text-sm font-black text-rose-700 dark:text-rose-400">
                  {daysRemaining === 1 ? '1 day remaining' : `${daysRemaining} days remaining`}
                </p>
                <p className="text-xs text-rose-600/70 dark:text-rose-400/60 font-medium mt-0.5 flex items-center gap-1">
                  <FiClock className="w-3 h-3" />
                  Scheduled for permanent deletion on {deletionDate}
                </p>
              </div>
            </div>

            {/* What happens */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">What happens if not recovered</p>
              <ul className="space-y-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                {[
                  'Your profile and personal information will be permanently erased',
                  'All registered pets and their profiles will be removed',
                  'Your full appointment history will be deleted',
                  'Access to all medical records linked to your account will be lost',
                  'This action cannot be undone after the grace period expires',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 text-sm text-rose-600 dark:text-rose-400 font-bold">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleRecover}
                disabled={recovering}
                className={clsx(
                  "w-full h-14 rounded-2xl bg-brand-500 text-white font-black uppercase tracking-widest text-sm hover:bg-brand-600 transition-all active:scale-95 shadow-xl shadow-brand-500/20 flex items-center justify-center gap-3",
                  recovering && "opacity-60 cursor-not-allowed"
                )}
              >
                <FiRefreshCcw className={clsx("w-5 h-5", recovering && "animate-spin")} />
                {recovering ? "Recovering Account..." : "Recover My Account"}
              </button>

              <button
                onClick={handleLogout}
                disabled={recovering}
                className="w-full h-12 rounded-2xl border-2 border-zinc-200 dark:border-dark-border text-zinc-500 dark:text-zinc-400 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-dark-surface transition-all flex items-center justify-center gap-2"
              >
                <FiLogOut className="w-4 h-4" />
                Sign Out — I still want to delete my account
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 font-medium">
          Logged in as <span className="font-bold text-zinc-600 dark:text-zinc-300">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
