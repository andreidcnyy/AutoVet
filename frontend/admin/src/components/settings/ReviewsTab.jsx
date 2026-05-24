import { useState, useEffect, useCallback } from "react";
import { FiStar, FiCheck, FiTrash2, FiRefreshCw, FiEyeOff, FiEye, FiGlobe } from "react-icons/fi";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

function Stars({ rating, size = "sm" }) {
  const cls = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <FiStar key={s} className={clsx(cls, s <= rating ? "text-amber-400 fill-amber-400" : "text-zinc-300 dark:text-zinc-600")} />
      ))}
    </div>
  );
}

/* Card that mimics the landing page testimonial style */
function LandingCard({ review, busy, onRemove, onUnfeature, onFeature }) {
  return (
    <div className={clsx(
      "relative rounded-2xl border p-6 overflow-hidden transition-all duration-200",
      review.is_featured
        ? "border-amber-300 dark:border-amber-600/50 bg-amber-50/40 dark:bg-amber-900/10"
        : "border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface"
    )}>
      {review.is_featured && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
          <FiStar className="h-3 w-3 fill-current" /> Featured
        </span>
      )}
      <Stars rating={review.rating} size="lg" />
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed italic">"{review.body}"</p>
      <div className="mt-4">
        <div className="font-black text-zinc-800 dark:text-zinc-100 text-sm">{review.reviewer_name}</div>
        {review.pet_name && <div className="text-xs text-zinc-400 dark:text-zinc-500">Owner of {review.pet_name}</div>}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-dark-border">
        <button
          onClick={() => review.is_featured ? onUnfeature(review.id) : onFeature(review.id)}
          disabled={busy[review.id]}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
            review.is_featured
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600"
          )}
        >
          <FiStar className={clsx("h-3.5 w-3.5", review.is_featured && "fill-current")} />
          {review.is_featured ? "Unfeature" : "Feature"}
        </button>
        <button
          onClick={() => onRemove(review.id)}
          disabled={busy[review.id]}
          title="Remove from landing page"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-all active:scale-95 ml-auto"
        >
          <FiEyeOff className="h-3.5 w-3.5" /> Remove from page
        </button>
      </div>
    </div>
  );
}

/* Row for a pending review */
function PendingRow({ review, busy, onApprove, onDelete }) {
  return (
    <div className="card-shell p-4 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{review.reviewer_name}</span>
          {review.pet_name && <span className="text-xs text-zinc-400 dark:text-zinc-500">· {review.pet_name}</span>}
          <Stars rating={review.rating} />
        </div>
        {review.title && <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-0.5">{review.title}</p>}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{review.body}</p>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
          {review.created_at ? new Date(review.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onApprove(review.id)}
          disabled={busy[review.id]}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-95"
        >
          <FiEye className="h-3.5 w-3.5" /> Show on page
        </button>
        <button
          onClick={() => onDelete(review.id)}
          disabled={busy[review.id]}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-dark-surface text-zinc-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-all active:scale-95"
        >
          <FiTrash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ReviewsTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const authHeader = { Authorization: `Bearer ${user?.token}`, Accept: "application/json" };

  const fetchReviews = useCallback(() => {
    setLoading(true);
    fetch("/api/reviews", { headers: authHeader })
      .then((r) => r.json())
      .then((payload) => setReviews(payload.data ?? payload ?? []))
      .catch(() => toast.error("Could not load reviews."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const patch = async (id, endpoint) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/reviews/${id}/${endpoint}`, { method: "PATCH", headers: authHeader });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setReviews((prev) => prev.map((r) => (r.id === id ? updated.review ?? updated.data ?? updated : r)));
    } catch {
      toast.error("Action failed. Please try again.");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this review permanently? This cannot be undone.")) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE", headers: authHeader });
      if (!res.ok) throw new Error();
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success("Review deleted.");
    } catch {
      toast.error("Delete failed. Please try again.");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const live    = reviews.filter((r) => r.is_approved).sort((a, b) => b.is_featured - a.is_featured);
  const pending = reviews.filter((r) => !r.is_approved);

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card-shell p-5 animate-pulse">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-3" />
          <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-full mb-2" />
          <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">Reviews &amp; Feedback</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage what visitors see in the Testimonials section of the landing page.
          </p>
        </div>
        <button
          onClick={fetchReviews}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-dark-border text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors"
        >
          <FiRefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* ── Live on Landing Page ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FiGlobe className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Live on Landing Page
          </h3>
          <span className="ml-1 text-xs font-bold text-zinc-400 dark:text-zinc-500">({live.length})</span>
        </div>

        {live.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-dark-border p-10 text-center">
            <FiGlobe className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Nothing is displayed yet.</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Approve a review below to show it on the landing page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {live.map((r) => (
              <LandingCard
                key={r.id}
                review={r}
                busy={busy}
                onRemove={(id) => patch(id, "approve")}
                onFeature={(id) => patch(id, "feature")}
                onUnfeature={(id) => patch(id, "feature")}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Pending Reviews ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FiCheck className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Reviews
          </h3>
          <span className="ml-1 text-xs font-bold text-zinc-400 dark:text-zinc-500">({pending.length})</span>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-dark-border p-8 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">No pending reviews — all caught up.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <PendingRow
                key={r.id}
                review={r}
                busy={busy}
                onApprove={(id) => patch(id, "approve")}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
