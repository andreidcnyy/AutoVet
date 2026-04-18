import { useEffect, useState } from "react";
import InventoryForecastInsights from "../components/dashboard/InventoryForecastInsights";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import AiSalesForecastCard from "../components/dashboard/AiSalesForecastCard";
import AiInsightPanels from "../components/dashboard/AiInsightPanels";
import InventoryChartCard from "../components/dashboard/InventoryChartCard";
import ErrorBoundary from "../components/ErrorBoundary";
import * as Icons from "react-icons/fi";
import * as LuIcons from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { ROLES } from "../constants/roles";

function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const isStaff = user?.role === ROLES.STAFF;

  useEffect(() => {
    if (!user?.token) return;
    setIsLoading(true);
    
    fetch("/api/dashboard/overview", {
      headers: { 
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setDashboardData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard Overview Fetch Error:", err);
        setIsLoading(false);
      });
  }, [user?.token]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400 font-medium animate-pulse">Loading Optimized Dashboard...</div>
      </div>
    );
  }

  const { status, stats, salesForecast, inventoryConsumption, notifications } = dashboardData || {};

  // Map icon names to components for metrics
  const mappedMetrics = (stats || [])
    .filter(stat => !(isStaff && stat.title === "Monthly Revenue"))
    .map(stat => ({
      ...stat,
      icon: Icons[stat.iconName] || LuIcons[stat.iconName] || Icons.FiActivity
    }));

  // Map icon components for notifications
  const mappedNotifications = (notifications || []).map(notif => ({
    ...notif,
    icon: Icons[notif.iconName] || LuIcons[notif.iconName] || Icons.FiBell
  }));

  return (
    <div className="space-y-6">
      {status && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900" />
          {status.message}
        </div>
      )}
      
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        {mappedMetrics.map((card) => (
          <MetricCard key={card.id || card.title} card={card} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {!isStaff && (
            <ErrorBoundary label="Sales Forecast">
              <AiSalesForecastCard initialData={salesForecast} />
            </ErrorBoundary>
          )}
          <ErrorBoundary label="Inventory Consumption">
            <InventoryChartCard initialData={inventoryConsumption} />
          </ErrorBoundary>
        </div>
        <div className="space-y-6">
          <RecentNotificationsCard 
            items={mappedNotifications} 
            // Note: We still use the hook's actions for markRead/dismiss
            // but we could also pass them if we wanted to unify more.
          />
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
