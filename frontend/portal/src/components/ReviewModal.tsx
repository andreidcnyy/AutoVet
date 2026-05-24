import { useState } from "react";
import { FiX, FiSend } from "react-icons/fi";
import clsx from "clsx";
import { submitReview } from "../api";

interface Props {
  invoice: {
    id: number;
    invoice_number?: string;
    pet?: { name?: string; species?: { name?: string } };
  };
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function ReviewModal({ invoice, onClose, onSubmitted }: Props) {
  const [rating, setRating]         = useState(0);
  const [hovered, setHovered]       = useState(0);
  const [lastClicked, setLastClicked] = useState(0);
  const [title, setTitle]           = useState("");
  const [body, setBody]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [errorKey, setErrorKey]     = useState(0);

  const petName    = invoice.pet?.name ?? "your pet";
  const petSpecies = invoice.pet?.species?.name;

  const handleSubmit = async () => {
    if (rating === 0) { setError("Please select a star rating."); setErrorKey(k => k + 1); return; }
    if (body.trim().length < 10) { setError("Please write at least 10 characters."); setErrorKey(k => k + 1); return; }
    setError(null);
    setSubmitting(true);
    try {
      await submitReview({ invoice_id: invoice.id, rating, title: title.trim() || undefined, body: body.trim() });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Something went wrong. Please try again.");
      setErrorKey(k => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStarClick = (star: number) => {
    setRating(star);
    setLastClicked(star);
    setTimeout(() => setLastClicked(0), 400);
  };

  const handleClose = () => {
    if (submitted) onSubmitted?.();
    onClose();
  };

  const bodyLen = body.length;
  const bodyNearLimit = bodyLen >= 900;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      <div className={clsx(
        "relative w-full max-w-md bg-white dark:bg-dark-card rounded-3xl shadow-2xl flex flex-col overflow-hidden",
        "animate-in fade-in zoom-in-95 duration-300"
      )}>
        {/* Animated green top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface hover:text-zinc-600 transition-all duration-150 active:scale-90"
        >
          <FiX className="h-4 w-4" />
        </button>

        {submitted ? (
          /* ── Thank-you state ── */
          <div className="flex flex-col items-center text-center px-8 py-12 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 text-4xl animate-bounce">
              ★
            </div>
            <h3 className="text-xl font-black text-zinc-800 dark:text-zinc-100 animate-in fade-in slide-in-from-bottom-1 duration-300 delay-75">
              Thank you!
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed animate-in fade-in duration-300 delay-150">
              Your feedback has been submitted and will be reviewed by our team. We appreciate your trust!
            </p>
            <button
              onClick={handleClose}
              className="mt-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all duration-150 active:scale-95 animate-in fade-in duration-300 delay-200"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-7 pt-7 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">
                Share Your Experience
              </p>
              <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 leading-snug">
                How was {petName}'s visit?
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Invoice #{invoice.invoice_number ?? invoice.id}
                </p>
                {petSpecies && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wide">
                    {petSpecies}
                  </span>
                )}
              </div>
            </div>

            {/* Star rating */}
            <div className="px-7 pb-4 animate-in fade-in slide-in-from-bottom-1 duration-300 delay-75">
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Rating *</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= (hovered || rating);
                  const bouncing = star === lastClicked;
                  return (
                    <button
                      key={star}
                      onClick={() => handleStarClick(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      className={clsx(
                        "transition-all duration-150 active:scale-75",
                        hovered >= star ? "scale-125" : "scale-100",
                        bouncing && "animate-bounce"
                      )}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className={clsx(
                          "h-9 w-9 transition-all duration-150",
                          filled
                            ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                            : "text-zinc-300 dark:text-zinc-600"
                        )}
                        fill={filled ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth={filled ? 0 : 1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                      </svg>
                    </button>
                  );
                })}
              </div>
              {rating > 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5 animate-in fade-in duration-200">
                  {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
                </p>
              )}
            </div>

            {/* Form */}
            <div className="px-7 pb-2 space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-300 delay-150">
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
                  className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow duration-150"
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
                  className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow duration-150 resize-none"
                />
                <p className={clsx(
                  "text-[10px] mt-0.5 text-right transition-colors duration-150",
                  bodyNearLimit ? "text-amber-500 dark:text-amber-400 font-bold" : "text-zinc-400"
                )}>
                  {bodyLen}/1000
                </p>
              </div>

              {error && (
                <div
                  key={errorKey}
                  className="rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-7 py-4 border-t border-zinc-100 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/30 mt-2 animate-in fade-in duration-300 delay-200">
              <button
                onClick={handleClose}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                Maybe later
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all duration-150 active:scale-95",
                  submitting
                    ? "bg-emerald-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
                )}
              >
                {submitting ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Submitting…
                  </>
                ) : (
                  <>
                    <FiSend className="h-3.5 w-3.5" />
                    Submit Review
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
