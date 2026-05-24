import { useState } from "react";
import { FiStar, FiX, FiSend } from "react-icons/fi";
import clsx from "clsx";
import { submitReview } from "../api";

interface Props {
  invoice: { id: number; invoice_number?: string; pet?: { name?: string } };
  onClose: () => void;
}

export default function ReviewModal({ invoice, onClose }: Props) {
  const [rating, setRating]       = useState(0);
  const [hovered, setHovered]     = useState(0);
  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const petName = invoice.pet?.name ?? "your pet";

  const handleSubmit = async () => {
    if (rating === 0) { setError("Please select a star rating."); return; }
    if (body.trim().length < 10) { setError("Please write at least 10 characters."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await submitReview({ invoice_id: invoice.id, rating, title: title.trim() || undefined, body: body.trim() });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className={clsx(
        "relative w-full max-w-md bg-white dark:bg-dark-card rounded-3xl shadow-2xl flex flex-col overflow-hidden",
        "animate-in fade-in zoom-in-95 duration-300"
      )}>
        {/* Green top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors"
        >
          <FiX className="h-4 w-4" />
        </button>

        {submitted ? (
          /* ── Thank-you state ── */
          <div className="flex flex-col items-center text-center px-8 py-12 gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 text-3xl">
              ★
            </div>
            <h3 className="text-xl font-black text-zinc-800 dark:text-zinc-100">Thank you!</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Your feedback has been submitted and will be reviewed by our team. We appreciate your trust!
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-7 pt-7 pb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">
                Share Your Experience
              </p>
              <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 leading-snug">
                How was {petName}'s visit?
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Invoice #{invoice.invoice_number ?? invoice.id}
              </p>
            </div>

            {/* Star rating */}
            <div className="px-7 pb-4">
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Rating *</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <FiStar
                      className={clsx(
                        "h-8 w-8 transition-colors duration-100",
                        star <= (hovered || rating)
                          ? "text-amber-400 fill-amber-400"
                          : "text-zinc-300 dark:text-zinc-600"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <div className="px-7 pb-2 space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  Title <span className="font-normal opacity-60">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Excellent service!"
                  className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  Review *
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Tell us about your experience with our clinic…"
                  className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                />
                <p className="text-[10px] text-zinc-400 mt-0.5 text-right">{body.length}/1000</p>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-7 py-4 border-t border-zinc-100 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/30 mt-2">
              <button
                onClick={onClose}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                Maybe later
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all active:scale-95",
                  submitting
                    ? "bg-emerald-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
                )}
              >
                <FiSend className="h-3.5 w-3.5" />
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
