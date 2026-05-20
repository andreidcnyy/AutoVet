import { useEffect, useState } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import clsx from "clsx";

export default function WarningPopup() {
  const [warnings, setWarnings]   = useState<any[]>([]);
  const [current, setCurrent]     = useState<any | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/warnings/unread", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        Accept: "application/json",
      },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setWarnings(list);
        if (list.length > 0) setCurrent(list[0]);
      })
      .catch(() => {});
  }, []);

  const dismiss = async () => {
    if (!current) return;
    setDismissing(true);
    try {
      await fetch(`/api/notifications/${current.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      const remaining = warnings.filter((w) => w.id !== current.id);
      setWarnings(remaining);
      setCurrent(remaining.length > 0 ? remaining[0] : null);
    } catch {
      setCurrent(null);
    } finally {
      setDismissing(false);
    }
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
      <div className={clsx(
        "relative w-full max-w-md bg-white dark:bg-dark-card rounded-3xl shadow-2xl flex flex-col overflow-hidden",
        "animate-in fade-in zoom-in-95 duration-300"
      )}>

        {/* Amber top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />

        {/* Header */}
        <div className="flex items-start gap-4 px-7 pt-6 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-500">
            <FiAlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-0.5">
              Account Warning
            </p>
            <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100 leading-snug">
              {current.title}
            </h3>
          </div>
          {warnings.length > 1 && (
            <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              {warnings.length} warnings
            </span>
          )}
        </div>

        {/* Message */}
        <div className="px-7 pb-6">
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4 max-h-64 overflow-y-auto">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {current.message}
            </p>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3">
            Sent by Pet Wellness Animal Clinic · {new Date(current.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-zinc-100 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/30">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-[200px] leading-snug">
            Please address this issue to avoid service restrictions.
          </p>
          <button
            onClick={dismiss}
            disabled={dismissing}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all active:scale-95",
              dismissing
                ? "bg-amber-300 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
            )}
          >
            <FiX className="h-3.5 w-3.5" />
            {dismissing ? "Dismissing…" : "I Understand"}
          </button>
        </div>
      </div>
    </div>
  );
}
