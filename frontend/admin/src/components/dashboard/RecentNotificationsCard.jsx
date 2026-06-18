import { FiBell, FiX } from "react-icons/fi";
import clsx from "clsx";
import { useToast } from "../../context/ToastContext";
import { useNavigate } from "react-router-dom";

const iconToneStyles = {
  danger: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  info: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-dark-surface dark:text-zinc-400",
};

function RecentNotificationsCard({ items, loading, onMarkAllRead, onClearAll, onDismiss }) {
  const toast = useToast();
  const navigate = useNavigate();

  const unreadCount = items?.filter(item => !item.read_at).length || 0;

  return (
    <aside className="card-shell overflow-hidden flex flex-col h-full bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5 dark:border-dark-border bg-zinc-50/30 dark:bg-dark-surface/10">
        <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2 uppercase">
          <FiBell className="text-brand-500" />
          Recent Alerts
          {unreadCount > 0 && (
            <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-lg shadow-rose-500/30">
              {unreadCount}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
            {items?.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300"
              >
                Clear
              </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto slim-scroll max-h-[450px]">
        {loading ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 space-y-4">
             <div className="h-8 w-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
             <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Updating alerts...</p>
          </div>
        ) : (!items || items.length === 0) ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 rounded-full bg-zinc-100 p-4 dark:bg-dark-surface">
              <FiBell className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            </div>
            <p className="text-lg font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">You're all caught up!</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No new notifications to show.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-dark-border">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.id} className="group relative flex gap-3 px-6 py-4 hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30 transition-colors">
                  <span
                    className={clsx(
                      "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      iconToneStyles[item.tone] || iconToneStyles.neutral
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight truncate leading-tight">{item.title}</h4>
                    <p className="mt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug">{item.message}</p>
                    <p className="mt-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{item.time}</p>
                  </div>
                  
                  <button
                    onClick={() => onDismiss && onDismiss(item.id)}
                    className="absolute right-3 top-4 p-1.5 text-zinc-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all dark:text-zinc-600 dark:hover:text-rose-400"
                    title="Dismiss"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate("/notifications")}
        className="w-full border-t border-zinc-100 dark:border-dark-border px-6 py-3 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-dark-surface transition-colors"
      >
        View all history
      </button>
    </aside>
  );
}

export default RecentNotificationsCard;
