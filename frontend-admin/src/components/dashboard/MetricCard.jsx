import clsx from "clsx";

const badgeStyles = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

function MetricCard({ card }) {
  const Icon = card.icon;

  return (
    <article className={clsx("card-shell p-5", card.accentBorder)}>
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

      <p className="text-5xl font-bold leading-tight text-slate-900 dark:text-zinc-50">{card.value}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-700 dark:text-zinc-200">{card.title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{card.detail}</p>
    </article>
  );
}

export default MetricCard;
