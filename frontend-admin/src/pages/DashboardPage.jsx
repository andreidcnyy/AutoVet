import InventoryForecastInsights from "../components/dashboard/InventoryForecastInsights";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import AiSalesForecastCard from "../components/dashboard/AiSalesForecastCard";
import InventoryChartCard from "../components/dashboard/InventoryChartCard";
import ErrorBoundary from "../components/ErrorBoundary";
import * as Icons from "react-icons/fi";
import * as LuIcons from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import { useApi } from "../hooks/useApi";

function DashboardPage() {
  const { user } = useAuth();
  const isStaff = user?.role === ROLES.STAFF;
  const enabled = !!user?.token;

  const { data: stats, isLoading: statsLoading } = useApi(['dashboard-stats'], '/api/dashboard/stats', { enabled });
  const { data: notifications } = useApi(['dashboard-notifications'], '/api/dashboard/notifications', { enabled, staleTime: 60 * 1000 });
  const { data: salesForecast } = useApi(['dashboard-sales-forecast'], '/api/dashboard/sales-forecast', { enabled: enabled && !isStaff });
  const { data: inventoryConsumption } = useApi(['dashboard-inventory-consumption'], '/api/dashboard/inventory-consumption', { enabled });

  if (statsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400 font-medium animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  const mappedMetrics = (Array.isArray(stats) ? stats : [])
    .filter(stat => !(isStaff && stat.title === "Monthly Revenue"))
    .map(stat => ({
      ...stat,
      icon: Icons[stat.iconName] || LuIcons[stat.iconName] || Icons.FiActivity,
    }));

  const mappedNotifications = (notifications || []).map(notif => ({
    ...notif,
    icon: Icons[notif.iconName] || LuIcons[notif.iconName] || Icons.FiBell,
  }));

  return (
    <div className="space-y-6">
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
          <RecentNotificationsCard items={mappedNotifications} />
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
