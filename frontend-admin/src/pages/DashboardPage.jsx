import { useEffect, useState } from "react";
import InventoryAiStatusCard from "../components/dashboard/InventoryAiStatusCard";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import AiSalesForecastCard from "../components/dashboard/AiSalesForecastCard";
import * as Icons from "react-icons/fi";
import * as LuIcons from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { ROLES } from "../constants/roles";

function DashboardPage() {
  const [apiStatus, setApiStatus] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { notifications, markAllAsRead, dismissNotification } = useNotifications();
  const isStaff = user?.role === ROLES.STAFF;

  useEffect(() => {
    if (!user?.token) return;
    setIsLoading(true);
    const headers = { 
      "Accept": "application/json",
      "Authorization": `Bearer ${user.token}`
    };
    Promise.all([
      fetch("/api/status", { headers }).then(res => res.json()),
      fetch("/api/dashboard/stats", { headers }).then(res => res.json())
    ])
      .then(([status, statsData]) => {
        setApiStatus(status);
        
        const safeStats = Array.isArray(statsData) ? statsData : [];
        // Map icon names to components for metrics
        const mappedMetrics = safeStats
          .filter(stat => !(isStaff && stat.title === "Monthly Revenue"))
          .map(stat => ({
            ...stat,
            icon: Icons[stat.iconName] || LuIcons[stat.iconName] || Icons.FiActivity
          }));
        setMetrics(mappedMetrics);
        
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard Fetch Error:", err);
        setIsLoading(false);
      });
  }, [user?.token]);

  // Map icon components for the child card component
  const mappedNotifications = notifications.map(notif => ({
    ...notif,
    icon: Icons[notif.iconName] || LuIcons[notif.iconName] || Icons.FiBell
  }));

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400 font-medium">Loading Dashboard Data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {apiStatus && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900" />
          {apiStatus.message}
        </div>
      )}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        {metrics.map((card) => (
          <MetricCard key={card.id} card={card} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {!isStaff && <AiSalesForecastCard />}
          <InventoryAiStatusCard />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <RecentNotificationsCard 
            items={mappedNotifications} 
            onMarkAllRead={markAllAsRead}
            onDismiss={dismissNotification}
          />
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
