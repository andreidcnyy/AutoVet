import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { FiUsers, FiPackage, FiRefreshCw } from "react-icons/fi";
import api from "../../api";
import clsx from "clsx";

const CATEGORY_COLORS = [
  "#10b981", "#6366f1", "#f59e0b", "#3b82f6",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

function CustomTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xl dark:border-dark-border dark:bg-dark-card">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.value.toLocaleString()}{unit}
        </p>
      ))}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{title}</h3>
    </div>
  );
}

export default function AnalyticsChartsCard() {
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/analytics/monthly-clients"),
      api.get("/dashboard/analytics/items-by-category"),
    ])
      .then(([clientRes, catRes]) => {
        setClients(clientRes.data);
        setCategories(catRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card-shell p-6 col-span-full flex items-center justify-center gap-3 py-16 text-zinc-400">
        <FiRefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-semibold">Loading analytics...</span>
      </div>
    );
  }

  const noClientData = clients.every(d => d.total === 0);
  const noCategoryData = categories.length === 0;

  return (
    <div className="col-span-full grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* ── Monthly Client Count ── */}
      <div className="card-shell p-6 bg-white dark:bg-dark-card">
        <SectionHeader
          icon={FiUsers}
          title="Monthly New Clients"
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />

        {noClientData ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 text-sm">No client registration data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={clients} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="clientGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-zinc-800" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v.split(" ")[0]}
              />
              <YAxis
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip unit=" clients" />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#clientGrad)"
                dot={{ r: 3.5, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Items Sold per Category ── */}
      <div className="card-shell p-6 bg-white dark:bg-dark-card">
        <SectionHeader
          icon={FiPackage}
          title="Items Used per Category"
          color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        />

        {noCategoryData ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 text-sm">No inventory usage data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={categories}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" className="dark:stroke-zinc-800" />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip unit=" units" />} />
              <Bar dataKey="total_qty" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {categories.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
