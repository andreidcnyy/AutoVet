import clsx from "clsx";

const iconToneStyles = {
  danger: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  info: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  neutral: "bg-slate-100 text-slate-600 dark:bg-dark-surface dark:text-zinc-400",
};

function RecentNotificationsCard({ items }) {
  return (
    <aside className="card-shell overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-dark-border">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Recent Notifications</h3>
        <button
          type="button"
          onClick={() => alert("All notifications marked as read.")}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Mark all read
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[150px]">
        {(!items || items.length === 0) ? (
          <div className="flex h-full min-h-[250px] items-center justify-center p-6 text-slate-400 dark:text-zinc-500">
            No recent notifications...
          </div>
        ) : (
          items.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.id} className="flex gap-4 border-b border-slate-200 px-6 py-5 dark:border-dark-border">
                <span
                  className={clsx(
                    "mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    iconToneStyles[item.tone] || iconToneStyles.neutral
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-xl font-semibold leading-tight text-slate-900 dark:text-zinc-50">{item.title}</h4>
                  <p className="mt-1 text-base text-slate-500 dark:text-zinc-400">{item.message}</p>
                  <p className="mt-3 text-sm text-slate-400 dark:text-zinc-500">{item.time}</p>
                </div>
              </article>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => alert("Opening full notification history...")}
        className="w-full px-6 py-4 text-center text-lg font-semibold text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-dark-surface"
      >
        View all notifications
      </button>
    </aside>
  );
}

export default RecentNotificationsCard;
