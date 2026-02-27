import { useEffect, useState } from "react";
import DashboardActions from "../components/dashboard/DashboardActions";
import InventoryChartCard from "../components/dashboard/InventoryChartCard";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import { dashboardActions } from "../data/dashboardData";

function DashboardPage() {
  const [apiStatus, setApiStatus] = useState(null);

  // These states are ready to be populated from your Laravel API
  const [metrics, setMetrics] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setApiStatus(data))
      .catch((err) => console.error("API Fetch Error:", err));
  }, []);

  return (
    <div className="space-y-6">
      {apiStatus && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900" />
          {apiStatus.message}
        </div>
      )}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {metrics.map((card) => (
          <MetricCard key={card.id} card={card} />
        ))}
        {metrics.length === 0 && (
          <div className="col-span-1 md:col-span-2 2xl:col-span-4 flex min-h-[140px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 dark:border-gray-700 dark:text-gray-500">
            No metrics loaded yet...
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[2fr_1fr]">
        <InventoryChartCard data={inventory} />
        <RecentNotificationsCard items={notifications} />
      </section>

      <DashboardActions actions={dashboardActions} />
    </div>
  );
}

export default DashboardPage;
