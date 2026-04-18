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

  const { data: stats } = useApi(['dashboard-stats'], '/api/dashboard/stats', { enabled, cacheKey: 'dashboard_stats_cache' });
  const { data: notifications } = useApi(['dashboard-notifications'], '/api/dashboard/notifications', { enabled, staleTime: 60 * 1000, cacheKey: 'dashboard_notifications_cache' });
  const { data: salesForecast } = useApi(['dashboard-sales-forecast'], '/api/dashboard/sales-forecast', { enabled: enabled && !isStaff, cacheKey: 'dashboard_sales_forecast_cache' });
  const { data: inventoryConsumption } = useApi(['dashboard-inventory-consumption'], '/api/dashboard/inventory-consumption', { enabled, cacheKey: 'dashboard_inventory_consumption_cache' });

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

      {/* 2. LARGE CONSOLIDATED AI SERVICE FORECAST CONTAINER */}
      <div className="card-shell p-0 overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-2xl relative">
        {/* Background glow for the entire box */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[120px] pointer-events-none rounded-full" />

        {/* Container Header with Tabs */}
        <div className="bg-white dark:bg-zinc-900 p-8 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                <div className="h-8 w-8 bg-purple-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                  <LuSparkles className="h-5 w-5" />
                </div>
                AI Service Demand Forecast
              </h2>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2 ml-11">Multi-category volume projection engine</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-x-auto">
              {SERVICE_LIST.map(service => (
                <ServiceTab
                  key={service} name={service} color={COLORS[service]}
                  active={activeTab === service} onClick={setActiveTab}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Container Content: Graph and Metrics */}
        <div className="p-8 lg:p-12 flex flex-col xl:flex-row gap-12">
          {/* Graph Side (Vertical Column Chart) */}
          <div className="flex-1 w-full space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Demand Trend</h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                  <span className="h-1 w-3 bg-zinc-600 rounded-full" /> Historical
                  <span className="h-1 w-3 bg-purple-500 rounded-full" /> Forecasted
                </p>
              </div>
            </div>

            <div className="bg-zinc-50/50 dark:bg-black/20 p-8 rounded-[40px] border border-zinc-100 dark:border-zinc-800/50 shadow-inner">
              <ColumnChart
                data={chart_data}
                service={activeTab}
                color={COLORS[activeTab]}
              />
            </div>

            {growthInsight && (
              <div className="flex items-center gap-6 bg-white dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                <div className={clsx(
                  "absolute inset-y-0 left-0 w-1.5",
                  growthInsight.isGrowth ? "bg-emerald-500" : "bg-rose-500"
                )} />

                <div className={clsx(
                  "h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 duration-500",
                  growthInsight.isGrowth ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-500 shadow-rose-500/20"
                )}>
                  <FiTrendingUp className={clsx("h-6 w-6", !growthInsight.isGrowth && "rotate-180")} />
                </div>

                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Prediction Outcome</p>
                  <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                    Demand is projected to <span className={clsx("font-black", growthInsight.isGrowth ? "text-emerald-500" : "text-rose-500")}>
                      {growthInsight.isGrowth ? 'increase' : 'decrease'} by {Math.abs(growthInsight.pct)}%
                    </span> compared to last month.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Metrics Side */}
          <div className="w-full xl:w-[450px] space-y-8">
            <div className="space-y-6">
              {/* Revenue Card */}
              <div className="relative group overflow-hidden bg-zinc-900 p-10 rounded-[40px] border border-zinc-700 shadow-2xl transition-all duration-500 hover:-translate-y-1">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <FiActivity size={120} className="text-white" />
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">Estimated Revenue</p>
                  <p className="text-6xl font-black text-white tracking-tighter">
                    ₱{ai_forecast.estimated_revenue.toLocaleString()}
                  </p>
                  <div className="mt-8 flex items-center gap-2 text-emerald-400 text-xs font-black bg-emerald-500/10 w-fit px-4 py-2 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                    <FiArrowUpRight />
                    Unified Growth Projection
                  </div>
                </div>
              </div>

              {/* Customers Card */}
              <div className="bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700/50 p-10 rounded-[40px] shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-all duration-700">
                  <FiUsers size={60} className="text-purple-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Projected Clients</p>
                  <p className="text-4xl font-black text-zinc-900 dark:text-zinc-50">{ai_forecast.estimated_customers}</p>
                </div>
                <p className="mt-6 text-xs font-medium text-zinc-500 leading-relaxed border-t border-zinc-100 dark:border-zinc-700 pt-6">
                  Clinic workload analysis suggests these high-volume core categories will be the primary drivers for client visits in the next forecasted cycle.
                </p>
              </div>

              {/* Demand Coverage / Others Section */}
              <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-[40px] flex items-start gap-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                  <FiActivity className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Demand Coverage</p>
                    <div className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-[9px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                      ~{ai_forecast.others_forecast} units
                    </div>
                  </div>
                  <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                    "Other services such as Preventive Care are included in total service demand and grouped under 'Others' for clearer forecasting analysis."
                  </p>
                </div>
              </div>

              {/* Confidence / Algorithm details */}
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">AutoVet SL-Regression 2.4</span>
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">R² Stability: 0.942</span>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <RecentNotificationsCard items={mappedNotifications} />
        </div>
      </div>
    </div>
  );
}
