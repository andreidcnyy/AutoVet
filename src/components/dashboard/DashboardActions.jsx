import { useNavigate } from "react-router-dom";

const actionRoutes = {
  "new-appointment": "/appointments",
  "register-patient": "/patients",
  "order-stock": "/inventory",
  "export-summary": "/billing",
  "manage-inventory": "/inventory",
  "follow-up-queue": "/patients",
};

function DashboardActions({ actions }) {
  const navigate = useNavigate();

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => navigate(actionRoutes[action.id] || "/")}
            className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 shadow-soft transition-colors duration-150 hover:border-blue-300 hover:text-blue-600 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:border-blue-500 dark:hover:bg-dark-surface dark:hover:text-blue-400"
          >
            <Icon className="h-5 w-5" />
            {action.label}
          </button>
        );
      })}
    </section>
  );
}

export default DashboardActions;
