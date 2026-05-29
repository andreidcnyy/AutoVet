import { useEffect, useState } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { FiUsers, FiPackage, FiRefreshCw } from "react-icons/fi";
import api from "../../api";
import clsx from "clsx";
import echo from "../../utils/echo";

const COLORS = [
  "#10b981", "#6366f1", "#f59e0b", "#3b82f6",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xl dark:border-dark-border dark:bg-dark-card">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color ?? p.fill }}>
          {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className={clsx("flex h-8 w-8 items-center justify-center rounded-xl", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
    </div>
  );
}

export default function AnalyticsChartsCard() {
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get("/dashboard/analytics/monthly-clients"),
      api.get("/dashboard/analytics/items-by-category"),
    ])
      .then(([clientRes, catRes]) => {
        if (cancelled) return;
        setClients(Array.isArray(clientRes) ? clientRes : []);
        setCategories(Array.isArray(catRes) ? catRes : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const refreshAll = () => {
      Promise.all([
        api.get("/dashboard/analytics/monthly-clients"),
        api.get("/dashboard/analytics/items-by-category"),
      ]).then(([clientRes, catRes]) => {
        setClients(Array.isArray(clientRes) ? clientRes : []);
        setCategories(Array.isArray(catRes) ? catRes : []);
      }).catch(() => {});
    };

    const refreshCategories = () => {
      api.get("/dashboard/analytics/items-by-category")
        .then((res) => { setCategories(Array.isArray(res) ? res : []); })
        .catch(() => {});
    };

    const poll = setInterval(refreshAll, 15000);

    const onVisible = () => { if (document.visibilityState === 'visible') refreshAll(); };
    document.addEventListener('visibilitychange', onVisible);

    let echoInstance = null;
    import("../../utils/echo").then((mod) => {
      echoInstance = mod.default;
      echoInstance.private('admin.inventory')
        .listen('.inventory.category.deleted', refreshCategories)
        .listen('.inventory.updated', refreshCategories)
        .listen('.invoice.finalized', refreshAll);
    }).catch(() => {});

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      if (echoInstance) echoInstance.leave('admin.inventory');
    };
  }, []);

  if (loading) {
    return (
      <div className="card-shell col-span-full flex items-center justify-center gap-3 py-16 text-zinc-400">
        <FiRefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-sm font-semibold">Loading analytics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-shell col-span-full flex items-center justify-center py-12 text-zinc-400">
        <p className="text-sm font-semibold">Analytics unavailable</p>
      </div>
    );
  }

  const noClientData = clients.length === 0 || clients.every((d) => d.total === 0);
  const noCategoryData = categories.length === 0;

  return (
    <div className="col-span-full grid grid-cols-1 gap-6 xl:grid-cols-2">

      {/* Monthly New Clients */}
      <div className="card-shell p-6">
        <SectionHeader
          icon={FiUsers}
          title="Monthly New Clients"
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        {noClientData ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
            No client data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={clients} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="clientGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#clientGradient)"
                dot={{ r: 3, fill: "#10b981" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Items Sold per Category */}
      <div className="card-shell p-6">
        <SectionHeader
          icon={FiPackage}
          title="Items Sold per Category"
          color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        />
        {noCategoryData ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
            No sales data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={categories}
              margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 10, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="total_qty" radius={[6, 6, 0, 0]}>
                {categories.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
