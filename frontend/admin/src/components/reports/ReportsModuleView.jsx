import { useMemo, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  FiAlertTriangle,
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiClipboard,
  FiEye,
  FiPackage,
  FiPlusCircle,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiX,
} from "react-icons/fi";
import { LuPawPrint, LuSparkles } from "react-icons/lu";
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useFormErrors } from "../../hooks/useFormErrors";
import api from "../../api";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    let d = new Date(dateStr);
    if (typeof dateStr === "string" && !dateStr.includes("T") && !dateStr.includes("Z") && !dateStr.includes("+")) {
      d = new Date(dateStr.replace(" ", "T") + "Z");
    }
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "N/A";
  }
};

const CHART_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xl dark:border-dark-border dark:bg-dark-card text-xs">
      <p className="mb-1 font-black uppercase tracking-widest text-zinc-400">{label}</p>
      {payload.map((p, i) => (
        p.value !== null && p.value !== undefined && (
          <p key={i} className="font-bold" style={{ color: p.color ?? p.fill }}>
            {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </p>
        )
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color = "zinc" }) {
  const bg = { emerald: "bg-emerald-50 dark:bg-emerald-900/20", amber: "bg-amber-50 dark:bg-amber-900/20", rose: "bg-rose-50 dark:bg-rose-900/20", indigo: "bg-indigo-50 dark:bg-indigo-900/20", zinc: "bg-zinc-50 dark:bg-dark-surface" };
  const txt = { emerald: "text-emerald-700 dark:text-emerald-400", amber: "text-amber-700 dark:text-amber-400", rose: "text-rose-700 dark:text-rose-400", indigo: "text-indigo-700 dark:text-indigo-400", zinc: "text-zinc-700 dark:text-zinc-300" };
  return (
    <div className={clsx("rounded-2xl p-5 border border-zinc-100 dark:border-dark-border", bg[color] ?? bg.zinc)}>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</p>
      <p className={clsx("text-3xl font-black", txt[color] ?? txt.zinc)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function ModelBadge({ r2, slope }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-dark-surface border border-zinc-200 dark:border-dark-border px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
      <LuSparkles className="h-3 w-3 text-emerald-500" />
      LR · R²={r2} · slope={slope > 0 ? "+" : ""}{slope}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Report Tab
// ─────────────────────────────────────────────────────────────────────────────

function TransactionReportTab({ user }) {
  const [months, setMonths] = useState(12);
  const [trends, setTrends] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m) => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        api.get(`/api/reports/analytics/transaction-trends?months=${m}`),
        api.get(`/api/reports/analytics/transaction-stats?days=${m === 12 ? 365 : m === 6 ? 180 : 90}`),
      ]);
      setTrends(t);
      setStats(s);
    } catch {
      // silent — charts just won't render
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { load(months); }, [months, load]);

  const periodOptions = [
    { label: "3 Months", value: 3 },
    { label: "6 Months", value: 6 },
    { label: "1 Year", value: 12 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-zinc-400">
        <FiRefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-sm font-semibold">Loading analytics…</span>
      </div>
    );
  }

  const summary = trends?.summary ?? {};
  const model   = trends?.model?.count ?? {};
  const series  = trends?.series ?? [];
  const byStatus = stats?.by_status ?? [];
  const topItems = stats?.top_items ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">Transaction Report</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Invoice volume &amp; trends · Linear Regression forecast</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-zinc-100 dark:bg-dark-surface p-1">
          {periodOptions.map((o) => (
            <button key={o.value} onClick={() => setMonths(o.value)}
              className={clsx("rounded-lg px-4 py-1.5 text-xs font-bold transition-colors",
                months === o.value ? "bg-white dark:bg-dark-card text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Reports" value={summary.total_invoices?.toLocaleString() ?? "—"} sub={`Last ${months} months`} color="indigo" />
        <StatCard label="Total Revenue" value={summary.total_revenue > 0 ? `₱${Number(summary.total_revenue).toLocaleString()}` : "—"} color="emerald" />
        <StatCard label="Avg Per Report" value={summary.avg_per_invoice > 0 ? `₱${Number(summary.avg_per_invoice).toLocaleString()}` : "—"} color="zinc" />
      </div>

      {/* Monthly volume chart with LR trend */}
      <div className="card-shell p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Monthly Report Volume</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Bars = actual · Line = LR trend · Dotted = forecast</p>
          </div>
          {model.r2 !== undefined && <ModelBadge r2={model.r2} slope={model.slope} />}
        </div>
        {series.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">No invoice data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="actual_count" name="Reports" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Line dataKey="trend_count" name="LR Trend" stroke="#10b981" strokeWidth={2}
                dot={false} strokeDasharray={(d) => d?.actual_count === null ? "5 4" : "0"}
                connectNulls={true} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Status breakdown + top items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Invoice status breakdown */}
        <div className="card-shell p-5">
          <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Status Breakdown</h3>
          {byStatus.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">No data</p>
          ) : (
            <div className="space-y-3">
              {byStatus.map((s, i) => {
                const total = byStatus.reduce((sum, r) => sum + Number(r.count), 0);
                const pct   = total > 0 ? Math.round((Number(s.count) / total) * 100) : 0;
                const color = s.status === "Finalized" || s.status === "Paid" ? "bg-emerald-500" : s.status === "Draft" ? "bg-amber-400" : s.status === "Cancelled" ? "bg-rose-400" : "bg-zinc-400";
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-zinc-700 dark:text-zinc-300">{s.status}</span>
                      <span className="text-zinc-400">{Number(s.count).toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-dark-surface overflow-hidden">
                      <div className={clsx("h-2 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top items */}
        <div className="card-shell p-5">
          <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Top Items Used</h3>
          {topItems.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">No finalized reports yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topItems.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v.length > 14 ? v.substring(0, 14) + "…" : v} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="times_used" name="Used" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {topItems.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Report Tab
// ─────────────────────────────────────────────────────────────────────────────

function InventoryReportTab({ user }) {
  const [months, setMonths] = useState(12);
  const [consumption, setConsumption] = useState([]);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);

  const load = useCallback(async (m) => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api.get(`/api/reports/analytics/inventory-consumption?months=${m}`),
        api.get(`/api/reports/analytics/inventory-stock`),
      ]);
      setConsumption(Array.isArray(c) ? c : []);
      setStockData(s);
      setActiveCategory(Array.isArray(c) && c.length > 0 ? c[0].category : null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { load(months); }, [months, load]);

  const periodOptions = [
    { label: "3 Months", value: 3 },
    { label: "6 Months", value: 6 },
    { label: "1 Year", value: 12 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-zinc-400">
        <FiRefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-sm font-semibold">Loading analytics…</span>
      </div>
    );
  }

  const summary  = stockData?.summary ?? {};
  const alerts   = stockData?.alert_items ?? [];
  const activeCat = consumption.find((c) => c.category === activeCategory) ?? consumption[0];

  const trendIcon = (dir) =>
    dir === "up"   ? <FiTrendingUp className="h-3.5 w-3.5 text-emerald-500" /> :
    dir === "down" ? <FiTrendingDown className="h-3.5 w-3.5 text-rose-500" /> :
                    <FiMinus className="h-3.5 w-3.5 text-zinc-400" />;

  return (
    <div className="space-y-6 p-6">
      {/* Header + period */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">Inventory Report</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Consumption trends · LR forecast · Stock status</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-zinc-100 dark:bg-dark-surface p-1">
          {periodOptions.map((o) => (
            <button key={o.value} onClick={() => setMonths(o.value)}
              className={clsx("rounded-lg px-4 py-1.5 text-xs font-bold transition-colors",
                months === o.value ? "bg-white dark:bg-dark-card text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Items"   value={summary.total?.toLocaleString()       ?? "—"} color="zinc" />
        <StatCard label="In Stock"      value={summary.in_stock?.toLocaleString()    ?? "—"} color="emerald" />
        <StatCard label="Low Stock"     value={summary.low_stock?.toLocaleString()   ?? "—"} color="amber" />
        <StatCard label="Out of Stock"  value={summary.out_of_stock?.toLocaleString() ?? "—"} color="rose" />
      </div>

      {/* Consumption chart with LR */}
      <div className="card-shell p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Consumption by Category</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Bars = actual qty · Line = LR trend · Dotted = forecast</p>
          </div>
          {consumption.length > 0 && activeCat?.model && (
            <ModelBadge r2={activeCat.model.r2} slope={activeCat.model.slope} />
          )}
        </div>

        {/* Category tabs */}
        {consumption.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {consumption.map((cat) => (
              <button key={cat.category}
                onClick={() => setActiveCategory(cat.category)}
                className={clsx("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                  activeCategory === cat.category
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-dark-surface text-zinc-500 hover:text-zinc-700")}>
                {trendIcon(cat.trend_direction)}
                {cat.category}
                <span className="opacity-60">({cat.total.toLocaleString()})</span>
              </button>
            ))}
          </div>
        )}

        {!activeCat ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
            No consumption data for this period
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={activeCat.series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="actual" name="Qty Used" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line dataKey="trend" name="LR Trend" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls={true}
                  strokeDasharray="0" />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Category meta */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500 border-t border-zinc-100 dark:border-dark-border pt-3">
              <span>Total: <b className="text-zinc-700 dark:text-zinc-300">{activeCat.total.toLocaleString()} units</b></span>
              <span>Avg/Month: <b className="text-zinc-700 dark:text-zinc-300">{activeCat.avg_monthly}</b></span>
              <span className="flex items-center gap-1">Trend: {trendIcon(activeCat.trend_direction)} <b className="text-zinc-700 dark:text-zinc-300">{activeCat.trend_direction}</b></span>
            </div>
          </>
        )}
      </div>

      {/* Category summary grid */}
      {consumption.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {consumption.map((cat, i) => (
            <div key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={clsx("rounded-2xl border p-4 cursor-pointer transition-all",
                activeCategory === cat.category
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                  : "border-zinc-100 dark:border-dark-border bg-white dark:bg-dark-card hover:border-zinc-200")}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}20` }}>
                  <FiPackage className="h-4 w-4" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-400">
                  {trendIcon(cat.trend_direction)} {cat.trend_direction}
                </div>
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 truncate">{cat.category}</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{cat.total.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400">Avg {cat.avg_monthly}/month · R²={cat.model.r2}</p>
            </div>
          ))}
        </div>
      )}

      {/* Low / out-of-stock alert table */}
      {alerts.length > 0 && (
        <div className="card-shell overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-dark-border px-5 py-4 bg-amber-50/50 dark:bg-amber-900/10">
            <FiAlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Stock Alerts</h3>
            <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-400">
              {alerts.length} items
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-dark-surface/30">
                  {["Item", "Category", "Current", "Min", "Deficit", "Supplier"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                {alerts.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/20">
                    <td className="px-5 py-3 font-bold text-zinc-900 dark:text-zinc-100">{item.name}</td>
                    <td className="px-5 py-3 text-zinc-500">{item.category}</td>
                    <td className="px-5 py-3">
                      <span className={clsx("font-black", item.stock <= 0 ? "text-rose-600" : "text-amber-600")}>
                        {item.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{item.min_stock}</td>
                    <td className="px-5 py-3">
                      <span className={clsx("rounded-full px-2 py-0.5 font-black text-[10px]",
                        item.status === "out_of_stock" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                        {item.status === "out_of_stock" ? "OUT" : `+${item.deficit} needed`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{item.supplier ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

function ReportsModuleView() {
  const toast = useToast();
  const { user } = useAuth();
  const { setLaravelErrors, clearErrors, getError } = useFormErrors();

  const [activeTab, setActiveTab] = useState("transactions");
  const [reports, setReports] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 10 });

  const [items, setItems] = useState([]);
  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Draft");
  const [reportId, setReportId] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [services, setServices] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [serviceInput, setServiceInput] = useState("");
  const [qtyInput, setQtyInput] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isApptDropdownOpen, setIsApptDropdownOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [expandedReportId, setExpandedReportId] = useState(null);

  const REPORTS_CACHE_KEY = "reports_history_cache";
  const FORM_DATA_CACHE_KEY = "reports_form_data_cache";
  const CACHE_TTL = 5 * 60 * 1000;

  const fetchReports = useCallback(async (page = 1, search = searchQuery, signal = null, force = false) => {
    if (!user?.token) return;
    setHistoryLoading(true);
    if (page === 1 && !search && !force) {
      try {
        const cached = JSON.parse(localStorage.getItem(REPORTS_CACHE_KEY) || "null");
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setReports(cached.reports);
          setPagination(cached.pagination);
          setHistoryLoading(false);
          return;
        }
      } catch (_) { localStorage.removeItem(REPORTS_CACHE_KEY); }
    }
    try {
      const params = new URLSearchParams({ per_page: "10", page: page.toString(), search });
      const response = await fetch(`/api/invoices?${params}`, {
        signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      if (data.data) {
        setReports(data.data);
        const newPag = { currentPage: data.current_page, lastPage: data.last_page, total: data.total, perPage: data.per_page };
        setPagination(newPag);
        if (page === 1 && !search) {
          try { localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify({ reports: data.data, pagination: newPag, ts: Date.now() })); } catch (_) {}
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      toast.error("Could not load report history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.token, searchQuery, toast]);

  const handleViewReportDetails = useCallback(async (rep) => {
    if (!rep?.id) return;
    try {
      setHistoryLoading(true);
      const full = await api.get(`/api/invoices/${rep.id}`);
      const mappedItems = (full.items || []).map((i) => ({
        ...i,
        id: i.id,
        indicator: i.item_type === "inventory" ? "bg-amber-400" : "bg-emerald-400",
      }));
      setItems(mappedItems);
      setSelectedPatientId(full.pet_id?.toString());
      setSelectedOwnerId(full.pet?.owner_id?.toString() || "");
      setSelectedAppointmentId(full.appointment_id?.toString() || "");
      setPatientDetails(full.pet);
      setNotes(full.notes_to_client || "");
      setStatus(full.status);
      setReportId(full.id);
      if (full.created_at) {
        let ds = full.created_at;
        if (typeof ds === "string" && !ds.includes("Z") && !ds.includes("+")) ds += " UTC";
        setReportDate(new Date(ds).toLocaleDateString("en-CA"));
      }
      setActiveTab("new");
      setIsPreviewMode(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error("Failed to load report details.");
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === "history") fetchReports(1, searchQuery, null, true);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "history") return;
    const controller = new AbortController();
    const handler = setTimeout(() => fetchReports(1, searchQuery, controller.signal), 500);
    return () => { clearTimeout(handler); controller.abort(); };
  }, [searchQuery]);

  useEffect(() => {
    if (!user?.token) return;
    try {
      const cached = JSON.parse(localStorage.getItem(FORM_DATA_CACHE_KEY) || "null");
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        if (Array.isArray(cached.owners)) setOwners(cached.owners);
        if (Array.isArray(cached.pets)) setPets(cached.pets);
        if (Array.isArray(cached.services)) setServices(cached.services);
        if (Array.isArray(cached.inventory)) setInventory(cached.inventory);
      }
    } catch (_) {}

    const controller = new AbortController();
    Promise.all([
      api.get("/api/owners", { params: { minimal: 1, per_page: 1000 }, signal: controller.signal }).catch(() => ({})),
      api.get("/api/pets", { params: { minimal: 1, per_page: 1000 }, signal: controller.signal }).catch(() => ({})),
      api.get("/api/services", { signal: controller.signal }).catch(() => []),
      api.get("/api/inventory", { signal: controller.signal }).catch(() => []),
    ]).then(([ownersData, petsData, servicesData, inventoryData]) => {
      const o = Array.isArray(ownersData) ? ownersData : (ownersData?.data || []);
      const p = Array.isArray(petsData) ? petsData : (petsData?.data || []);
      const s = Array.isArray(servicesData) ? servicesData : (servicesData?.data || servicesData || []);
      const inv = Array.isArray(inventoryData) ? inventoryData : (inventoryData?.data || inventoryData || []);
      setOwners(o); setPets(p); setServices(s); setInventory(inv);
      try { localStorage.setItem(FORM_DATA_CACHE_KEY, JSON.stringify({ owners: o, pets: p, services: s, inventory: inv, ts: Date.now() })); } catch (_) {}
    }).catch((err) => {
      if (err.name === "AbortError" || err.name === "CanceledError") return;
      toast.error("Failed to load initial data.");
    });
    return () => controller.abort();
  }, [user?.token]);

  const filteredAppointments = useMemo(() => {
    const active = appointments.filter(
      (a) => !["cancelled", "declined", "Cancelled", "Declined"].includes(a.status)
    );
    if (!appointmentSearch) return active;
    const term = appointmentSearch.toLowerCase();
    return active.filter((a) =>
      formatDate(a.date).toLowerCase().includes(term) ||
      a.date.toLowerCase().includes(term) ||
      (a.title || "").toLowerCase().includes(term) ||
      (a.service?.name || "").toLowerCase().includes(term)
    );
  }, [appointments, appointmentSearch]);

  const handlePatientSelect = (e) => {
    const pId = e.target.value;
    setSelectedPatientId(pId);
    setSelectedAppointmentId("");
    if (!pId) { setPatientDetails(null); setAppointments([]); return; }
    api.get(`/api/pets/${pId}`).then((full) => {
      setPatientDetails(full);
    }).catch(() => toast.error("Failed to load patient details."));
    fetch(`/api/appointments?pet_id=${pId}&per_page=100`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${user?.token}` },
    }).then((r) => r.json()).then((data) => {
      const arr = Array.isArray(data) ? data : (data?.data || []);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      setAppointments([...arr].sort((a, b) => {
        const dA = new Date(a.date); const dB = new Date(b.date);
        dA.setHours(0,0,0,0); dB.setHours(0,0,0,0);
        const pA = dA < now; const pB = dB < now;
        if (pA && !pB) return 1; if (!pA && pB) return -1;
        return !pA && !pB ? dA - dB : dB - dA;
      }));
    }).catch(() => setAppointments([]));
  };

  const groupedItems = useMemo(() => {
    const term = serviceInput.toLowerCase();
    const filteredSvcs = (Array.isArray(services) ? services : [])
      .filter((s) => s.name.toLowerCase().includes(term) || (s.category && s.category.toLowerCase().includes(term)))
      .map((s) => ({ ...s, type: "service" }));
    const filteredInv = (Array.isArray(inventory) ? inventory : [])
      .filter((i) => i.item_name.toLowerCase().includes(term) || i.sku?.toLowerCase().includes(term) || i.code?.toLowerCase().includes(term))
      .map((i) => ({ ...i, name: i.item_name, sku: i.sku || i.code || "N/A", stock: i.stock_level || 0, type: "inventory" }));
    return [...filteredSvcs, ...filteredInv].reduce((acc, item) => {
      const cat = item.type === "service" ? (item.category || "Services") : (item.category || "Inventory Products");
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [services, inventory, serviceInput]);

  const selectItemFromDropdown = (item) => {
    setServiceInput(item.name);
    setSelectedService(item);
    setIsDropdownOpen(false);
  };

  const handleServiceChange = (e) => {
    setServiceInput(e.target.value);
    setIsDropdownOpen(true);
    const matchSvc = services.find((s) => s.name.toLowerCase() === e.target.value.toLowerCase());
    if (matchSvc) { setSelectedService({ ...matchSvc, type: "service" }); return; }
    const matchInv = inventory.find((i) => i.item_name.toLowerCase() === e.target.value.toLowerCase());
    if (matchInv) { setSelectedService({ ...matchInv, name: matchInv.item_name, type: "inventory" }); return; }
    setSelectedService(null);
  };

  const addItem = () => {
    if (!serviceInput) return;
    const qty = Number(qtyInput) || 1;
    const itemType = selectedService?.type || "service";
    const newItem = {
      id: `li-${Date.now()}`,
      name: serviceInput,
      sku: selectedService?.sku || selectedService?.code || "",
      item_type: itemType,
      service_id: itemType === "service" ? selectedService?.id : null,
      inventory_id: itemType === "inventory" ? selectedService?.id : null,
      notes: itemType === "inventory" ? "Inventory Item" : "Clinical Service",
      qty,
      indicator: itemType === "inventory" ? "bg-amber-400" : "bg-emerald-400",
    };
    if (itemType === "inventory" && selectedService) {
      const stock = selectedService.stock_level || selectedService.stock || 0;
      if (qty > stock) toast.warning(`${qty} units of '${serviceInput}' requested but only ${stock} in stock.`);
    }
    setItems((prev) => [...prev, newItem]);
    setServiceInput(""); setQtyInput(1); setSelectedService(null);
  };

  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const resetForm = () => {
    setItems([]); setNotes(""); setSelectedOwnerId(""); setSelectedPatientId("");
    setSelectedAppointmentId(""); setPatientDetails(null); setStatus("Draft");
    setReportId(null); setIsPreviewMode(false);
    setReportDate(new Date().toISOString().split("T")[0]);
  };

  const submitReport = async (finalStatus) => {
    if (items.length === 0) { toast.error("Cannot save a report without items."); return; }
    if (!selectedPatientId) { toast.error("Please select a patient."); return; }
    if (!selectedAppointmentId) { toast.error("Please select an appointment."); return; }

    const payload = {
      pet_id: selectedPatientId,
      appointment_id: selectedAppointmentId,
      status: finalStatus,
      subtotal: 0,
      discount_type: "fixed",
      discount_value: 0,
      tax_rate: 0,
      total: 0,
      amount_paid: 0,
      notes_to_client: notes,
      items: items.map((item) => ({
        item_type: item.item_type || "service",
        service_id: item.service_id,
        inventory_id: item.inventory_id,
        name: item.name,
        notes: item.notes,
        qty: item.qty,
        unit_price: 0,
        amount: 0,
        is_hidden: false,
      })),
    };

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      clearErrors();
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 422) { setLaravelErrors(errorData); toast.error("Validation error."); }
        else throw new Error(errorData.message || "Failed to save report");
        return;
      }
      toast.success(`Report ${finalStatus === "Draft" ? "saved as draft" : "completed"} successfully.`);
      localStorage.removeItem(REPORTS_CACHE_KEY);
      window.dispatchEvent(new CustomEvent("inventory-forecast-refresh"));
      resetForm();
    } catch (err) {
      toast.error(err.message || "Failed to save report");
    }
  };

  const Pagination = () => {
    if (pagination.lastPage <= 1) return null;
    return (
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 py-4 mb-6 dark:border-dark-border dark:bg-dark-card shadow-sm">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Showing <span className="text-zinc-900 dark:text-zinc-50">{Math.min((pagination.currentPage - 1) * pagination.perPage + 1, pagination.total)}–{Math.min(pagination.currentPage * pagination.perPage, pagination.total)}</span> of <span className="text-zinc-900 dark:text-zinc-50">{pagination.total}</span> reports
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchReports(pagination.currentPage - 1)} disabled={pagination.currentPage === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card shadow-sm">
            <FiChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            {[...Array(pagination.lastPage)].map((_, i) => {
              const p = i + 1;
              if (pagination.lastPage > 7 && p !== 1 && p !== pagination.lastPage && (p < pagination.currentPage - 1 || p > pagination.currentPage + 1)) {
                if (p === pagination.currentPage - 2 || p === pagination.currentPage + 2) return <span key={p} className="px-1 text-zinc-400">...</span>;
                return null;
              }
              return (
                <button key={p} onClick={() => fetchReports(p)} className={clsx("flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black transition-all", pagination.currentPage === p ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-110" : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card")}>
                  {p}
                </button>
              );
            })}
          </div>
          <button onClick={() => fetchReports(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.lastPage} className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card shadow-sm">
            <FiChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  const TABS = [
    { id: "transactions", label: "Transaction Report" },
    { id: "inventory",    label: "Inventory Report" },
    { id: "new",          label: "New Report" },
    { id: "history",      label: "Report History" },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-dark-border">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-dark-border px-6 py-4 bg-zinc-50/50 dark:bg-dark-surface/30 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx("shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100")}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Analytics tabs */}
      {activeTab === "transactions" && (
        <div className="flex-1 overflow-y-auto">
          <TransactionReportTab user={user} />
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="flex-1 overflow-y-auto">
          <InventoryReportTab user={user} />
        </div>
      )}

      {/* Existing: New Report */}
      {activeTab === "new" && (
        <div className={clsx("grid grid-cols-1 lg:h-[calc(100vh-16rem)]", isPreviewMode ? "lg:grid-cols-1" : "lg:grid-cols-[410px_1fr]")}>
          {!isPreviewMode && (
            <aside className="flex h-full flex-col overflow-hidden border-b border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card lg:border-b-0 lg:border-r">
              <div className="shrink-0 border-b border-zinc-200 dark:border-dark-border p-5">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Reports &gt; New Report</p>
                <div className="mt-2 flex items-center gap-3">
                  <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">New Report</h2>
                  <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", status === "Finalized" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700")}>
                    {status}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
                <section>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Patient Details</h3>
                  <div className="space-y-3">
                    <div className="relative">
                      <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <select value={selectedOwnerId} onChange={(e) => { const oId = e.target.value; setSelectedOwnerId(oId); setSelectedPatientId(""); setPatientDetails(null); setAppointments([]); if (oId) { const op = (Array.isArray(pets) ? pets : []).filter(p => p.owner_id?.toString() === oId); if (op.length === 1) handlePatientSelect({ target: { value: op[0].id.toString() } }); } }} className="h-11 w-full appearance-none rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-10 pr-8 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none" disabled={status === "Finalized"}>
                        <option value="">Select an owner...</option>
                        {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    </div>

                    <div className="relative">
                      <select value={selectedPatientId} onChange={handlePatientSelect} disabled={!selectedOwnerId || status === "Finalized"} className={clsx("h-11 w-full appearance-none rounded-xl border pl-4 pr-8 text-sm focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300", getError("pet_id") ? "border-rose-500 bg-rose-50/10" : "border-zinc-200 dark:border-dark-border bg-zinc-50")}>
                        <option value="">Select a pet...</option>
                        {(Array.isArray(pets) ? pets : []).filter(p => p.owner_id?.toString() === selectedOwnerId?.toString()).map(p => <option key={p.id} value={p.id}>{p.name} — {p.species?.name || "Unknown"}</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      {getError("pet_id") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("pet_id")}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Select Appointment</label>
                      <div className="relative">
                        <button type="button" onClick={() => setIsApptDropdownOpen(!isApptDropdownOpen)} disabled={!selectedPatientId || status === "Finalized"} className={clsx("flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm transition-all focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300", isApptDropdownOpen ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-zinc-200 dark:border-dark-border bg-zinc-50")}>
                          <div className="flex items-center gap-2 truncate">
                            <FiCalendar className="h-4 w-4 shrink-0 text-zinc-400" />
                            <span className={clsx("truncate", !selectedAppointmentId && "text-zinc-400")}>
                              {selectedAppointmentId ? (() => { const a = appointments.find(x => x.id.toString() === selectedAppointmentId); return a ? `${formatDate(a.date)} - ${a.title || a.service?.name}` : "Selected"; })() : "Choose an appointment..."}
                            </span>
                          </div>
                          <FiChevronDown className={clsx("h-4 w-4 text-zinc-400 transition-transform", isApptDropdownOpen && "rotate-180")} />
                        </button>
                        {isApptDropdownOpen && (
                          <div className="absolute left-0 top-full z-[60] mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-dark-border dark:bg-dark-card">
                            <div className="p-2 border-b border-zinc-100 dark:border-dark-border">
                              <div className="relative">
                                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <input type="text" placeholder="Search date or title..." value={appointmentSearch} onChange={(e) => setAppointmentSearch(e.target.value)} autoFocus className="h-9 w-full rounded-lg border border-zinc-100 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300" />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-50 dark:divide-dark-surface">
                              {filteredAppointments.length > 0 ? filteredAppointments.slice(0, 50).map(appt => (
                                <button key={appt.id} type="button" onClick={() => { setSelectedAppointmentId(appt.id.toString()); setIsApptDropdownOpen(false); setAppointmentSearch(""); }} className={clsx("w-full px-4 py-2.5 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-dark-surface", selectedAppointmentId === appt.id.toString() ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 font-bold" : "text-zinc-600 dark:text-zinc-400")}>
                                  <div className="flex justify-between"><span>{formatDate(appt.date)}</span><span className="opacity-60">{appt.time?.substring(0, 5)}</span></div>
                                  <div className="truncate opacity-80">{appt.title || appt.service?.name}</div>
                                </button>
                              )) : <div className="px-4 py-8 text-center text-[10px] text-zinc-400 uppercase font-bold">No appointments found</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {patientDetails && (
                      <div className="rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-3 text-sm space-y-1">
                        <p className="text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Owner:</strong> {patientDetails.owner?.name}</p>
                        <p className="text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Contact:</strong> {patientDetails.owner?.phone || "N/A"}</p>
                        <p className="text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-700 dark:text-zinc-300">Species/Breed:</strong> {patientDetails.species?.name} {patientDetails.breed?.name ? `• ${patientDetails.breed?.name}` : ""}</p>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Services &amp; Items</h3>
                  <div className="grid grid-cols-[1fr_54px_auto] gap-2 items-center">
                    <div className="relative">
                      <input type="text" placeholder="Search or type service..." value={serviceInput} onChange={handleServiceChange} onFocus={() => setIsDropdownOpen(true)} onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); setIsDropdownOpen(false); } }} disabled={status === "Finalized"} className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-8 text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 disabled:opacity-50" />
                      {serviceInput && <button onClick={() => { setServiceInput(""); setSelectedService(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:bg-zinc-100"><FiX className="h-4 w-4" /></button>}
                      {isDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 max-h-[360px] w-[500px] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-3 shadow-2xl z-[100]">
                          {Object.keys(groupedItems).length > 0 ? Object.entries(groupedItems).map(([cat, svcs]) => (
                            <div key={cat} className="mb-4 last:mb-0">
                              <div className="flex items-center gap-2 mb-2 px-2">
                                <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{cat}</span>
                              </div>
                              <ul className="space-y-1">
                                {svcs.map((item) => (
                                  <li key={`${item.type}-${item.id}`}>
                                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectItemFromDropdown(item)} className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-dark-surface border border-transparent hover:border-zinc-100">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs uppercase", item.type === "inventory" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                                          {item.type === "inventory" ? "ITEM" : "SRVC"}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate font-bold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            {item.sku && <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{item.sku}</span>}
                                            {item.type === "inventory" && <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded", item.stock > 10 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50")}>Stock: {item.stock}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )) : (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                              <FiSearch className="text-zinc-300 w-6 h-6 mb-3" />
                              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No matching items</p>
                            </div>
                          )}
                          {serviceInput && !services.find(s => s.name.toLowerCase() === serviceInput.toLowerCase()) && !inventory.find(i => i.item_name.toLowerCase() === serviceInput.toLowerCase()) && (
                            <div className="mt-3 border-t border-zinc-100 dark:border-dark-border pt-4">
                              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { addItem(); setIsDropdownOpen(false); }} className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:opacity-90">
                                <FiPlusCircle className="w-4 h-4" /> Add "{serviceInput}"
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <input type="number" min="1" value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} disabled={status === "Finalized"} placeholder="Qty" className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-center text-sm disabled:opacity-50" />
                    <button type="button" onClick={() => { addItem(); setIsDropdownOpen(false); }} disabled={!serviceInput || status === "Finalized"} className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
                      Add
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {items.length > 0 ? items.map((item) => (
                      <article key={item.id} className="group relative rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={clsx("text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border", item.item_type === "inventory" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-100")}>
                                {item.item_type === "inventory" ? "Inventory Item" : "Clinical Service"}
                              </span>
                              {item.sku && <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100">{item.sku}</span>}
                            </div>
                            <p className="text-base font-bold text-zinc-900 dark:text-zinc-50 truncate">{item.name}</p>
                            <p className="mt-1 text-xs font-semibold text-zinc-500">Qty: <b className="text-zinc-900 dark:text-zinc-200">{item.qty}</b></p>
                          </div>
                          {status === "Draft" && (
                            <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100">
                              <FiX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </article>
                    )) : (
                      <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
                        <LuPawPrint className="h-10 w-10 text-zinc-300 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No items added yet</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="shrink-0 space-y-4 border-t border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-300">Notes</label>
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={status === "Finalized"} placeholder="Clinical notes or observations..." className="w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 disabled:opacity-50 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={resetForm} className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-dark-card px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 transition-colors">Reset</button>
                  <button onClick={() => submitReport("Draft")} disabled={status !== "Draft"} className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-50 hover:bg-emerald-100 transition-colors">Save Draft</button>
                </div>
              </div>
            </aside>
          )}

          <section className="flex h-full flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card px-5 py-3 shrink-0">
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <button onClick={() => setIsPreviewMode(!isPreviewMode)} className={clsx("inline-flex items-center gap-2 font-semibold px-3 py-1.5 rounded-lg transition-colors", isPreviewMode ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:hover:bg-dark-surface")}>
                  <FiEye className="h-4 w-4" /> {isPreviewMode ? "Exit Preview" : "Preview Report"}
                </button>
                <span>Status: <b className="text-zinc-700 dark:text-zinc-300">{status}</b></span>
              </div>
              <button onClick={() => submitReport("Finalized")} disabled={status === "Finalized"} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-md active:scale-95 transition-all">
                <FiSend className="h-4 w-4" /> Complete Report
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <article className="mx-auto max-w-3xl rounded-2xl bg-white dark:bg-dark-card p-8 md:p-12 shadow-md border border-zinc-100 dark:border-dark-border">
                <header className="flex items-start justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white"><LuPawPrint className="h-4 w-4" /></span>
                      <span>Clinical Report</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400 uppercase tracking-widest">AutoVet Systems</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-light tracking-wide text-zinc-200 dark:text-zinc-700">REPORT</p>
                    <p className="mt-1 text-sm text-zinc-500">Date: {reportDate}</p>
                    <span className={clsx("mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase", status === "Finalized" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{status}</span>
                  </div>
                </header>

                <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Owner</p>
                    {patientDetails ? (
                      <>
                        <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">{patientDetails?.owner?.name || "—"}</p>
                        <div className="mt-1 space-y-0.5 text-sm text-zinc-500">
                          <p>{patientDetails?.owner?.phone || "—"}</p>
                          <p>{patientDetails?.owner?.email || "—"}</p>
                        </div>
                      </>
                    ) : <p className="mt-2 text-sm text-zinc-400 italic">No patient selected</p>}
                  </div>
                  <div className="rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Patient</p>
                    {patientDetails ? (
                      <div className="mt-2">
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{patientDetails.name}</p>
                        <p className="text-xs text-zinc-500">{patientDetails?.species?.name || "—"} • {patientDetails?.breed?.name || "—"}</p>
                      </div>
                    ) : <p className="mt-2 text-xs text-zinc-400 italic">No patient selected</p>}
                  </div>
                </section>

                <section className="mt-8">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Services &amp; Items Rendered</p>
                  {items.filter(i => !i.is_hidden).length > 0 ? (
                    <div className="rounded-xl border border-zinc-200 dark:border-dark-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-dark-surface border-b border-zinc-200 dark:border-dark-border">
                          <tr className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            <th className="px-4 py-3">Item / Service</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                          {items.filter(i => !i.is_hidden).map((item, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30">
                              <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</td>
                              <td className="px-4 py-3"><span className={clsx("text-[9px] font-black uppercase px-2 py-0.5 rounded-full", item.item_type === "inventory" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>{item.item_type === "inventory" ? "Item" : "Service"}</span></td>
                              <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">{item.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-sm text-zinc-400 italic">No items added.</p>}
                </section>

                {notes && (
                  <section className="mt-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Notes</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-dark-surface rounded-xl p-4 border border-zinc-200 dark:border-dark-border">{notes}</p>
                  </section>
                )}
              </article>
            </div>
          </section>
        </div>
      )}

      {/* Existing: Report History */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by patient or report..." className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-10 pr-4 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none" />
            </div>
          </div>
          <Pagination />
          {historyLoading ? (
            <div className="py-20 text-center text-zinc-400 font-bold uppercase tracking-widest animate-pulse">Loading reports...</div>
          ) : reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div key={rep.id} className="rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-dark-surface/40 transition-colors" onClick={() => setExpandedReportId(expandedReportId === rep.id ? null : rep.id)}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
                        <FiClipboard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{rep.pet?.name || "—"}</p>
                        <p className="text-xs text-zinc-500">{formatDate(rep.created_at)} • {rep.appointment ? (rep.appointment.title || rep.appointment.service?.name || "Appointment") : "No appointment"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={clsx("text-[10px] font-black uppercase px-2 py-1 rounded-full", rep.status === "Finalized" || rep.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{rep.status}</span>
                      <button onClick={(e) => { e.stopPropagation(); handleViewReportDetails(rep); }} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 underline underline-offset-4">Edit</button>
                    </div>
                  </div>
                  {expandedReportId === rep.id && (
                    <div className="border-t border-zinc-100 dark:border-dark-border px-5 py-4 bg-zinc-50/50 dark:bg-dark-surface/20">
                      {rep.items && rep.items.filter(i => !i.is_hidden).length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Items Rendered</p>
                          {rep.items.filter(i => !i.is_hidden).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className={clsx("text-[9px] font-black uppercase px-2 py-0.5 rounded-full", item.item_type === "inventory" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>{item.item_type === "inventory" ? "Item" : "Service"}</span>
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.name}</span>
                              </div>
                              <span className="font-bold text-zinc-500">Qty: {item.qty}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-zinc-400 italic">No items on this report.</p>}
                      {rep.notes_to_client && <p className="mt-3 text-xs text-zinc-500 italic border-t border-zinc-100 dark:border-dark-border pt-3">"{rep.notes_to_client}"</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <FiClipboard className="mx-auto h-12 w-12 text-zinc-200 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No reports found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportsModuleView;
