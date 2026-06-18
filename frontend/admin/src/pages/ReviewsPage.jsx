import { useState, useEffect, useCallback } from "react";
import { FiStar, FiCheck, FiX, FiTrash2, FiEye, FiActivity, FiRefreshCw } from "react-icons/fi";
import clsx from "clsx";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import echo from "../utils/echo";

/* ─── Rating stars indicator helper ─── */
function Stars({ rating, size = "sm" }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <FiStar
          key={s}
          className={clsx(
            s <= rating ? "text-amber-400 fill-current" : "text-zinc-200 dark:text-zinc-700",
            size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"
          )}
        />
      ))}
    </div>
  );
}

const RATING_LABELS = {
  5: "Excellent, highly recommended!",
  4: "Very good service",
  3: "Satisfactory experience",
  2: "Needs improvement",
  1: "Poor experience",
};

/* ─── Review single overlay details component ─── */
function ReviewDetailModal({ review, busy, onClose, onApprove, onFeature, onDelete }) {
  if (!review) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 dark:bg-dark-card dark:border-dark-border animate-in zoom-in-95 duration-150">
        
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <Stars rating={review.rating} size="lg" />
            <span className="text-sm font-bold text-amber-500 mt-1">{RATING_LABELS[review.rating]}</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 rounded-lg p-1">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100">{review.reviewer_name}</h3>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            {review.pet_name && (
              <span>
                Owner of <span className="font-bold text-zinc-500">{review.pet_name}</span>
              </span>
            )}
            {review.pet_species && (
              <>
                <span>·</span>
                <span>{review.pet_species}</span>
              </>
            )}
          </div>
          {review.created_at && (
            <p className="text-[10px] font-medium text-zinc-400 mt-1">
              Submitted on {new Date(review.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-zinc-100 dark:border-dark-border pt-4">
          {review.title && (
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">{review.title}</p>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
            "{review.body}"
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-dark-border pt-4">
          {review.is_approved ? (
            <button
              onClick={() => { onApprove(review.id); onClose(); }}
              disabled={busy[review.id]}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-100 dark:bg-dark-surface px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-all"
            >
              <FiX className="h-3.5 w-3.5" /> Unapprove
            </button>
          ) : (
            <button
              onClick={() => { onApprove(review.id); onClose(); }}
              disabled={busy[review.id]}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/10"
            >
              <FiCheck className="h-3.5 w-3.5" /> Approve
            </button>
          )}

          {review.is_approved && (
            <button
              onClick={() => { onFeature(review.id); onClose(); }}
              disabled={busy[review.id]}
              className={clsx(
                "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all",
                review.is_featured
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/10"
                  : "bg-zinc-100 text-zinc-600 hover:bg-amber-50 hover:text-amber-600 dark:bg-dark-surface dark:text-zinc-300"
              )}
            >
              <FiStar className={clsx("h-3.5 w-3.5", review.is_featured && "fill-current")} />
              {review.is_featured ? "Featured" : "Feature"}
            </button>
          )}

          <button
            onClick={() => { onDelete(review.id); onClose(); }}
            disabled={busy[review.id]}
            className="flex items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-900/10 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all"
          >
            <FiTrash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Featured testimonial view box ─── */
function LandingCard({ review, busy, onClick, onRemove, onFeature }) {
  return (
    <div 
      onClick={onClick}
      className={clsx(
        "card-shell p-6 relative overflow-hidden group border transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer flex flex-col justify-between min-h-[180px]",
        review.is_featured 
          ? "border-amber-200 bg-amber-50/20 dark:border-amber-500/20 dark:bg-amber-500/5" 
          : "border-zinc-100 bg-white dark:bg-dark-card"
      )}
    >
      {review.is_featured && (
        <span className="absolute top-0 right-0 bg-amber-500 text-white px-2 py-0.5 rounded-bl-lg text-[9px] font-black uppercase tracking-widest">
          Featured testimonial
        </span>
      )}
      
      <div>
        <Stars rating={review.rating} />
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed italic line-clamp-3">"{review.body}"</p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 dark:border-dark-border pt-4">
        <div>
          <div className="font-black text-zinc-800 dark:text-zinc-100 text-sm">{review.reviewer_name}</div>
          {review.pet_name && <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Owner of {review.pet_name}</span>}
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); onFeature(review.id); }}
            disabled={busy[review.id]}
            className={clsx(
              "p-2 rounded-xl border transition-all text-xs font-bold flex items-center gap-1",
              review.is_featured
                ? "border-amber-200 bg-amber-50 text-amber-600"
                : "border-zinc-200 text-zinc-400 hover:text-amber-500 hover:border-amber-200"
            )}
            title={review.is_featured ? "Unfeature" : "Feature on landing page"}
          >
            <FiStar className={clsx("h-3.5 w-3.5", review.is_featured && "fill-current")} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(review.id); }}
            disabled={busy[review.id]}
            className="p-2 rounded-xl border border-zinc-200 text-zinc-400 hover:text-rose-500 hover:border-rose-200 transition-all"
            title="Unapprove review"
          >
            <FiX className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Pending verification review cell ─── */
function ReviewRow({ review, busy, onClick, onApprove, onDelete }) {
  return (
    <div 
      onClick={onClick}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-zinc-100 bg-zinc-50/50 dark:border-dark-border dark:bg-dark-surface/20 transition-all hover:bg-zinc-50 dark:hover:bg-dark-surface/40 cursor-pointer"
    >
      <div className="space-y-1 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-zinc-800 dark:text-zinc-100 truncate">
            {review.reviewer_name}
          </span>
          {review.pet_name && <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">· {review.pet_name}</span>}
        </div>
        <div>
          <Stars rating={review.rating} />
        </div>
        <div className="pt-1">
          {review.title && <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-0.5">{review.title}</p>}
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">"{review.body}"</p>
        </div>
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider pt-1">
          Submitted {review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onApprove(review.id)}
          disabled={busy[review.id]}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/10"
        >
          <FiCheck className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          onClick={() => onDelete(review.id)}
          disabled={busy[review.id]}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-zinc-100 dark:bg-dark-surface text-zinc-500 hover:bg-rose-50 hover:text-rose-600 transition-all"
        >
          <FiTrash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [selected, setSelected] = useState(null);

  const authHeader = { Authorization: `Bearer ${user?.token}`, Accept: "application/json" };

  const fetchReviews = useCallback(() => {
    setLoading(true);
    fetch("/api/reviews", { headers: authHeader })
      .then((r) => r.json())
      .then((payload) => setReviews(payload.data ?? payload ?? []))
      .catch(() => toast.error("Could not load reviews."))
      .finally(() => setLoading(false));
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token) return;
    fetchReviews();

    const channel = echo.private('admin.inventory');
    channel.listen('.entity.created', fetchReviews);

    return () => {
      echo.leave('admin.inventory');
    };
  }, [user?.token, fetchReviews]);

  const toggleEndpoint = async (id, endpoint) => {
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/reviews/${id}/${endpoint}`, { method: "PATCH", headers: authHeader });
      const updated = await res.json();
      const fresh = updated.review ?? updated.data ?? updated;
      setReviews((prev) => prev.map((r) => (r.id === id ? fresh : r)));
      toast.success("Review status updated successfully.");
    } catch (_) {
      toast.error("Action failed.");
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleApprove = (id) => toggleEndpoint(id, "toggle-approve");
  const handleFeature = (id) => toggleEndpoint(id, "toggle-feature");

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this review permanently? This cannot be undone.")) return;
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE", headers: authHeader });
      if (!res.ok) throw new Error();
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success("Review deleted permanently.");
    } catch (_) {
      toast.error("Could not delete review.");
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  };

  const live = reviews.filter((r) => r.is_approved).sort((a, b) => b.is_featured - a.is_featured);
  const pending = reviews.filter((r) => !r.is_approved);

  return (
    <div className="space-y-6">
      
      {/* Detail overlay */}
      <ReviewDetailModal
        review={selected}
        busy={busy}
        onClose={() => setSelected(null)}
        onApprove={handleApprove}
        onFeature={handleFeature}
        onDelete={handleDelete}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Manage client testimonials and feedback published on the clinic website.
          </p>
        </div>
        <button
          onClick={fetchReviews}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-dark-border text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors"
        >
          <FiRefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center font-bold text-zinc-400 uppercase tracking-widest animate-pulse flex flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          Loading Patient Testimonials...
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* Pending Reviews Block */}
          <div className="card-shell p-6 bg-white dark:bg-dark-card border border-zinc-100 dark:border-dark-border">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" /> Pending Verification ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider py-6 italic text-center">No pending feedback rows for verification</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {pending.map((r) => (
                  <ReviewRow
                    key={r.id}
                    review={r}
                    busy={busy}
                    onClick={() => setSelected(r)}
                    onApprove={handleApprove}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Active Testimonials Grid */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 flex items-center gap-1.5">
              <FiActivity className="text-emerald-500" /> Published Testimonials ({live.length})
            </h3>
            {live.length === 0 ? (
              <div className="card-shell p-12 text-center border border-zinc-100 bg-white">
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider italic">No testimonials are currently visible on the landing website.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {live.map((r) => (
                  <LandingCard
                    key={r.id}
                    review={r}
                    busy={busy}
                    onClick={() => setSelected(r)}
                    onRemove={handleApprove}
                    onFeature={handleFeature}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
