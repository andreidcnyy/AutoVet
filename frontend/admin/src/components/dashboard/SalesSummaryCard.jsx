import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiTrendingUp, FiShoppingBag, FiClock, FiRefreshCw } from "react-icons/fi";
import clsx from "clsx";
import api from "../../api";
import echo from "../../utils/echo";

const peso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    let d = new Date(dateStr);
    if (typeof dateStr === "string" && !dateStr.includes("T") && !dateStr.includes("Z") && !dateStr.includes("+")) {
      d = new Date(dateStr.replace(" ", "T") + "Z");
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return "—"; }
};


export default function SalesSummaryCard() {
  const navigate = useNavigate();
  const [revenue, setRevenue]     = useState([]);
  const [topItems, setTopItems]   = useState([]);
  const [recent, setRecent]       = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    Promise.all([
      api.get("/api/reports/sales/revenue-summary?days=30").catch(() => []),
      api.get("/api/reports/sales/top-services?limit=5").catch(() => []),
      api.get("/api/invoices?per_page=7&page=1&search=").catch(() => null),
    ]).then(([rev, top, inv]) => {
      setRevenue(Array.isArray(rev) ? rev : []);
      setTopItems(Array.isArray(top) ? top : []);
      const list = inv?.data || [];
      setRecent(Array.isArray(list) ? list : []);
    }).finally(() => { if (showSpinner) setLoading(false); });
  };

  useEffect(() => {
    load(true);
    const onVisible = () => { if (document.visibilityState === 'visible') load(false); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('inventory-forecast-refresh', () => load(false));
    const ch = echo.private('admin.invoices');
    ch.listen('.invoice.updated', () => load(false));
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('inventory-forecast-refresh', load);
      ch.stopListening('.invoice.updated');
    };
  }, []);

  // Today / this week / this month from daily revenue data
  const { today, week, month } = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6); weekAgo.setHours(0, 0, 0, 0);

    let todayTotal = 0, weekTotal = 0, monthTotal = 0;
    revenue.forEach((row) => {
      const d = new Date(row.date + "T00:00:00");
      const v = Number(row.total) || 0;
      monthTotal += v;
      if (d >= weekAgo) weekTotal += v;
      if (row.date === todayStr) todayTotal += v;
    });
    return { today: todayTotal, week: weekTotal, month: monthTotal };
  }, [revenue]);

  const maxRevenue = useMemo(
    () => Math.max(...topItems.map((i) => Number(i.total_revenue) || 0), 1),
    [topItems]
  );

  if (loading) {
    return (
      <div className="card-shell flex items-center justify-center gap-3 py-14 text-zinc-400">
        <FiRefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-sm font-semibold">Loading sales summary…</span>
      </div>
    );
  }

  return (
    <div className="card-shell p-6 space-y-8">

      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <FiTrendingUp className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Sales Summary
          </h3>
        </div>
        <button
          onClick={() => load(true)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-dark-border px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors"
        >
          <FiRefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* â”€â”€ Earnings tiles â”€â”€ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Earned Today", value: today, note: "from today's invoices", highlight: true },
          { label: "Earned This Week", value: week, note: "last 7 days" },
          { label: "Earned This Month", value: month, note: "last 30 days" },
        ].map(({ label, value, note, highlight }) => (
          <div
            key={label}
            className={clsx(
              "rounded-2xl p-5 border",
              highlight
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/40"
                : "bg-zinc-50 border-zinc-200 dark:bg-dark-surface dark:border-dark-border"
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              {label}
            </p>
            <p className={clsx(
              "text-2xl font-black tabular-nums",
              highlight ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-50"
            )}>
              {peso(value)}
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">{note}</p>
          </div>
        ))}
      </div>

      {/* ── Top Services ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <FiShoppingBag className="h-3.5 w-3.5" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Top Revenue Sources
          </p>
        </div>

        {topItems.length === 0 ? (
          <p className="text-sm text-zinc-400 italic py-4 text-center">No sales data yet.</p>
        ) : (
          <div className="space-y-3">
            {topItems.map((item, idx) => {
              const pct = Math.round((Number(item.total_revenue) / maxRevenue) * 100);
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="w-5 text-[11px] font-black text-zinc-400 text-right shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {item.name}
                      </span>
                      <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 tabular-nums ml-3 shrink-0">
                        {peso(item.total_revenue)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Used {item.total_count} time{item.total_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* â”€â”€ Recent Transactions â”€â”€ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <FiClock className="h-3.5 w-3.5" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Recent Transactions
          </p>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-zinc-400 italic py-4 text-center">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-dark-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Pet</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Owner</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                {recent.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate("/invoices", { state: { viewInvoiceId: inv.id } })}
                    className="cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10 transition-colors"
                    title="Click to view invoice details"
                  >
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(inv.created_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                      {inv.pet?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {inv.pet?.owner?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-black tabular-nums text-zinc-900 dark:text-zinc-50">
                      {peso(inv.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Paid
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
