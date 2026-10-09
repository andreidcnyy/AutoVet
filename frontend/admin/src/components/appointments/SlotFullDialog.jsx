import { createPortal } from "react-dom";
import { LuClock, LuX } from "react-icons/lu";
import digivetLogo from "../../assets/autovet-logo.png";

/** Must match Appointment::SLOT_CAPACITY on the server. */
export const SLOT_CAPACITY = 2;

/**
 * Shown when staff try to approve or book into a time slot that already
 * holds SLOT_CAPACITY approved appointments.
 */
export default function SlotFullDialog({ open, timeLabel, dateLabel, onClose, onDecline }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="slot-full-title">
      <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-dark-card animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-xl p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LuX className="h-5 w-5" />
        </button>

        {/* DigiVet brand header */}
        <div className="relative flex items-center gap-4 bg-gradient-to-br from-[#0b2a4a] via-[#0f4c75] to-[#14b8a6] px-6 py-5">
          <img src={digivetLogo} alt="DigiVet" className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-lg ring-2 ring-white/20" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-200">DigiVet · Scheduling</p>
            <h3 id="slot-full-title" className="text-lg font-black leading-tight text-white">Time slot is full</h3>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30">
              <LuClock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                {[dateLabel, timeLabel].filter(Boolean).join(" · ") || "This time"}
              </p>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {SLOT_CAPACITY} of {SLOT_CAPACITY} places already approved
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Each time slot can hold only <span className="font-black text-[#0f4c75] dark:text-teal-300">{SLOT_CAPACITY} approved appointments</span>.
            To keep this request, move it to another time, or decline it so the client can rebook.
          </p>

          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
            {onDecline && (
              <button
                type="button"
                onClick={onDecline}
                className="h-11 rounded-xl border border-rose-200 bg-white text-sm font-black uppercase text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/50 dark:bg-transparent dark:hover:bg-rose-900/20"
              >
                Decline request
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className={`h-11 rounded-xl bg-[#0f4c75] text-sm font-black uppercase text-white shadow-lg shadow-[#0f4c75]/20 transition-colors hover:bg-[#0b2a4a] ${onDecline ? "" : "sm:col-span-2"}`}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
