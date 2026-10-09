import { createPortal } from 'react-dom';
import { FiClock, FiCalendar } from 'react-icons/fi';
import logo from '../assets/logo.png';
import { PawPrint } from '../pages/Landing';

/** Must match Appointment::SLOT_CAPACITY on the server. */
export const SLOT_CAPACITY = 2;

interface Props {
  open: boolean;
  /** The slot the client tried to book, already formatted (e.g. "9:30 AM"). */
  timeLabel?: string;
  onClose: () => void;
}

/**
 * Explains the per-slot limit when a client picks, or loses the race for, a
 * time that already holds SLOT_CAPACITY approved appointments.
 */
export default function SlotFullModal({ open, timeLabel, onClose }: Props) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="slot-full-title">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white dark:bg-dark-card rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Brand header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-emerald-600 to-emerald-700 px-6 pt-6 pb-10 text-center text-white">
          <PawPrint className="absolute -top-3 -right-3 w-24 h-24 text-white opacity-20 rotate-12 pointer-events-none" />
          <PawPrint className="absolute bottom-1 left-3 w-10 h-10 text-white opacity-20 -rotate-12 pointer-events-none" />
          <div className="relative mx-auto w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center">
            <img src={logo} alt="Pet Wellness Animal Clinic" className="w-10 h-10 object-contain" />
          </div>
          <p className="relative mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
            Pet Wellness Animal Clinic
          </p>
        </div>

        {/* Clock badge overlapping the header */}
        <div className="relative -mt-7 flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-500 border-4 border-white dark:border-dark-card flex items-center justify-center shadow-md">
            <FiClock className="w-6 h-6" />
          </div>
        </div>

        <div className="px-6 pt-3 pb-6 text-center space-y-3">
          <h3 id="slot-full-title" className="text-lg font-black uppercase italic tracking-tight text-zinc-800 dark:text-zinc-100">
            {timeLabel ? `${timeLabel} is fully booked` : 'This time is fully booked'}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            To give every pet enough time and care, we accept only{' '}
            <span className="font-black text-brand-600 dark:text-brand-400">{SLOT_CAPACITY} appointments per time slot</span>.
            Please choose another time.
          </p>

          <div className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-50 dark:bg-dark-surface px-4 py-3">
            {Array.from({ length: SLOT_CAPACITY }).map((_, i) => (
              <PawPrint key={i} className="w-5 h-5 text-brand-500" />
            ))}
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              {SLOT_CAPACITY} of {SLOT_CAPACITY} places taken
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-black text-sm uppercase tracking-wide shadow-lg shadow-brand-500/20 transition-all active:scale-95"
          >
            <FiCalendar className="w-4 h-4" /> Choose another time
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
