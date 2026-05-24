import { useState, useEffect, useCallback } from "react";
import { FiStar, FiCheck, FiX, FiTrash2, FiRefreshCw } from "react-icons/fi";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

function StarDisplay({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <FiStar
          key={s}
          className={clsx(
            "h-3.5 w-3.5",
            s <= rating ? "text-amber-400 fill-amber-400" : "text-zinc-300 dark:text-zinc-600"
          )}
        />
      ))}
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
      const res = await fetch(`/api/reviews/${id}/${endpoint}`, {
        method: "PATCH",
        headers: authHeader,
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setReviews((prev) => prev.map((r) => (r.id === id ? updated.review ?? updated.data ?? updated : r)));
      toast.success(endpoint === "approve" ? "Approval status updated." : "Featured status updated.");
    } catch {
      toast.error("Action failed. Please try again.");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">Reviews &amp; Feedback</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Approve reviews to show them publicly. Feature top reviews to display them prominently on the landing page.
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-shell p-5 animate-pulse">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-3" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-full mb-2" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="card-shell p-12 text-center">
          <FiStar className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400 font-semibold">No reviews yet.</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Reviews submitted through the portal will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={clsx(
                "card-shell p-5 transition-all duration-200",
                review.is_featured && "border-amber-300 dark:border-amber-600/50 bg-amber-50/30 dark:bg-amber-900/10"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-black text-zinc-800 dark:text-zinc-100 text-sm">{review.reviewer_name}</span>
                    {review.pet_name && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">· {review.pet_name}</span>
                    )}
                    <StarDisplay rating={review.rating} />
                    {review.is_approved && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                        <FiCheck className="h-3 w-3" /> Approved
                      </span>
                    )}
                    {review.is_featured && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
                        <FiStar className="h-3 w-3 fill-current" /> Featured
                      </span>
                    )}
                  </div>
                  {review.title && (
                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">{review.title}</p>
                  )}
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{review.body}</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
                    {review.created_at ? new Date(review.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : ""}
                    {review.invoice_id && ` · Invoice #${review.invoice_id}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => patch(review.id, "approve")}
                    disabled={busy[review.id]}
                    title={review.is_approved ? "Revoke approval" : "Approve"}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
                      review.is_approved
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600"
                    )}
                  >
                    <FiCheck className="h-3.5 w-3.5" />
                    {review.is_approved ? "Approved" : "Approve"}
                  </button>

                  <button
                    onClick={() => patch(review.id, "feature")}
                    disabled={busy[review.id] || !review.is_approved}
                    title={!review.is_approved ? "Approve first to feature" : review.is_featured ? "Unfeature" : "Feature"}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
                      !review.is_approved && "opacity-40 cursor-not-allowed",
                      review.is_featured
                        ? "bg-amber-400 text-white hover:bg-amber-500"
                        : "bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600"
                    )}
                  >
                    <FiStar className={clsx("h-3.5 w-3.5", review.is_featured && "fill-current")} />
                    {review.is_featured ? "Featured" : "Feature"}
                  </button>

                  <button
                    onClick={() => remove(review.id)}
                    disabled={busy[review.id]}
                    title="Delete review"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-dark-surface text-zinc-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-all active:scale-95"
                  >
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
