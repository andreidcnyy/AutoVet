import clsx from "clsx";

const badgeStyles = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  info: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

function MetricCard({ card }) {
  const Icon = card.icon;
  const isClickable = !!card.onClick;

  return (
    <article 
      className={clsx(
        "card-shell p-5 transition-all duration-300", 
        card.accentBorder,
        isClickable && "cursor-pointer hover:shadow-xl hover:-translate-y-1 active:scale-95 border-2 border-transparent hover:border-purple-500/20"
      )}
      onClick={card.onClick}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={clsx("flex h-11 w-11 items-center justify-center rounded-xl", card.iconBg)}>
          <Icon className={clsx("h-5 w-5", card.iconColor)} />
        </div>
        {card.badge ? (
          <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", badgeStyles[card.badgeTone])}>
            {card.badge}
          </span>
        ) : null}
      </div>

      <p className="text-5xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">{card.value}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-700 dark:text-zinc-200">{card.title}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{card.detail}</p>
      
      {isClickable && (
        <div className="mt-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-purple-500 dark:text-purple-400 opacity-0 transition-opacity group-hover:opacity-100">
          View Details
        </div>
      )}
    </article>
  );
}

export default MetricCard;
