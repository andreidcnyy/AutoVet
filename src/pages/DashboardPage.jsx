import { useEffect, useState } from "react";
import InventoryChartCard from "../components/dashboard/InventoryChartCard";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import AiSalesForecastCard from "../components/dashboard/AiSalesForecastCard";
import * as Icons from "react-icons/fi";

function DashboardPage() {
  const [apiStatus, setApiStatus] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetch("/api/status").then(res => res.json()),
      fetch("/api/dashboard/stats").then(res => res.json()),
      fetch("/api/dashboard/notifications").then(res => res.json())
    ])
      .then(([status, statsData, notifData]) => {
        setApiStatus(status);
        
        const safeStats = Array.isArray(statsData) ? statsData : [];
        // Map icon names to components for metrics
        const mappedMetrics = safeStats.map(stat => ({
          ...stat,
          icon: Icons[stat.iconName] || Icons.FiActivity
        }));
        setMetrics(mappedMetrics);

        const safeNotifs = Array.isArray(notifData) ? notifData : [];
        // Map icon names to components for notifications
        const mappedNotifs = safeNotifs.map(notif => ({
          ...notif,
          icon: Icons[notif.iconName] || Icons.FiBell
        }));
        setNotifications(mappedNotifs);
        
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard Fetch Error:", err);
        setIsLoading(false);
      });
  }, []);

  const handleMarkAllRead = () => {
    setNotifications([]);
  };

  const handleDismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-500 dark:text-zinc-400 font-medium">Loading Dashboard Data...</div>
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
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {metrics.map((card) => (
          <MetricCard key={card.id} card={card} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <AiSalesForecastCard />
          <InventoryChartCard />
        </div>
        <RecentNotificationsCard 
          items={notifications} 
          onMarkAllRead={handleMarkAllRead}
          onDismiss={handleDismissNotification}
        />
      </section>
    </div>
  );
}

export default DashboardPage;
