import { FiTool, FiLogOut } from 'react-icons/fi';
import logo from '../assets/logo.png';
import { PawPrint } from './Landing';
import { useAuth } from '../context/AuthContext';
import { formatCountdown } from '../hooks/useMaintenanceWindow';

interface Props {
  /** Seconds until the window closes, or null when no end time was set. */
  secondsRemaining?: number | null;
  message?: string | null;
}

export default function MaintenancePage({ secondsRemaining = null, message = null }: Props) {
  const { logout } = useAuth();

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-zinc-50 dark:bg-dark-bg overflow-hidden">
      <PawPrint className="absolute -top-10 -right-10 w-72 h-72 text-brand-400 opacity-10 rotate-12 pointer-events-none" />
      <PawPrint className="absolute -bottom-10 -left-10 w-56 h-56 text-emerald-400 opacity-10 -rotate-12 pointer-events-none" />
      <PawPrint className="absolute top-1/3 left-8 w-24 h-24 text-brand-300 opacity-10 rotate-45 pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg mx-auto px-6 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">

        <div className="flex justify-center">
          <img src={logo} alt="Pet Wellness" className="w-16 h-16 object-contain" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Pet Wellness Animal Clinic</p>
          <h1 className="text-3xl font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100">
            We'll Be Right Back
          </h1>
        </div>

        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center shadow-xl shadow-amber-500/10">
            <FiTool className="w-10 h-10 text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card rounded-3xl border border-zinc-100 dark:border-dark-border shadow-xl p-8 space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">
            System Under Maintenance
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
            {message?.trim() ||
              'Our team is currently performing scheduled maintenance to improve your experience. We apologize for any inconvenience.'}
          </p>

          {secondsRemaining !== null && secondsRemaining > 0 && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                Back online in
              </p>
              <p
                className="mt-1 text-4xl font-black tabular-nums text-zinc-800 dark:text-zinc-100"
                role="timer"
                aria-live="off"
              >
                {formatCountdown(secondsRemaining)}
              </p>
            </div>
          )}

          {secondsRemaining === null && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              The portal will be back online shortly.
            </p>
          )}
          <div className="pt-2 border-t border-zinc-100 dark:border-dark-border">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              For urgent concerns, please contact us directly
            </p>
            <p className="text-sm font-bold text-brand-600 dark:text-brand-400 mt-1">
              badetvelasquez@gmail.com &nbsp;·&nbsp; +63 933 461 7957
            </p>
          </div>
        </div>

        <p className="text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">
          This page will refresh automatically when the system is back online.
        </p>

        <button
          onClick={logout}
          className="flex items-center gap-2 mx-auto px-6 py-3 rounded-2xl border-2 border-zinc-200 dark:border-dark-border text-zinc-500 dark:text-zinc-400 font-bold text-sm hover:bg-zinc-100 dark:hover:bg-dark-surface transition-all"
        >
          <FiLogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
