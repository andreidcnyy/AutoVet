import { useEffect } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from "recharts";
import { FiUsers, FiPackage, FiRefreshCw, FiActivity } from "react-icons/fi";
import clsx from "clsx";
import { useApi, useQueryClient } from "../../hooks/useApi";
import echo from "../../utils/echo";

// One hue per measure, not one per bar. Bar length already encodes the value,
// so colouring each category differently added a second, meaningless encoding
// that also re-coloured every bar whenever the category order changed.
// Both steps clear the lightness-band and 3:1 contrast checks in light and dark.
const PRODUCT_HUE = "#6366f1";
const SERVICE_HUE = "#f43f5e";

function ChartTooltip({ active, payload, label, total }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xl dark:border-dark-border dark:bg-dark-card">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      {payload.map((p, i) => (
        // Values stay in ink, not the series colour; the bar carries identity.
        <p key={i} className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {p.value.toLocaleString()}
          {total > 0 && (
            <span className="ml-1.5 text-[11px] font-bold text-zinc-400">
              {Math.round((p.value / total) * 100)}% of total
            </span>
          )}
        </p>
      ))}
    </div>
  );
}

/**
 * Ranked category breakdown.
 *
 * Was a vertical bar chart: long category names collided along the x-axis and
 * were dropped or truncated, so the reader could not tell which bar was which
 * and the numbers had to be inferred from gridlines. Horizontal bars give each
 * name a full line of its own, the rows are sorted so rank is obvious, and each
 * value is written at the end of its bar so nothing has to be read off an axis.
 */
function CategoryBreakdown({ data, hue, unitLabel }) {
  const rows = [...data]
    .map((d) => ({ ...d, total_qty: Number(d.total_qty) || 0 }))
    .sort((a, b) => b.total_qty - a.total_qty);

  const total = rows.reduce((sum, r) => sum + r.total_qty, 0);
  // Give every row a constant slice of height so 3 categories and 12 categories
  // both stay legible instead of being squeezed into a fixed box.
  const height = Math.max(180, rows.length * 34 + 24);

  return (
    <>
      <p className="-mt-2 mb-3 text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
        {total.toLocaleString()} {unitLabel} across {rows.length} {rows.length === 1 ? "category" : "categories"}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="category"
            width={124}
            tick={{ fontSize: 11, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip total={total} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          {/* Animation off: the dashboard is exported to PDF via html2canvas, and an
              animated bar is still growing from zero when the canvas is captured,
              so the exported chart came out empty. */}
          <Bar isAnimationActive={false} dataKey="total_qty" fill={hue} radius={[0, 4, 4, 0]} maxBarSize={22} >
            {/* Labelled directly, so the value never has to be estimated. */}
            <LabelList
              dataKey="total_qty"
              position="right"
              className="fill-zinc-500 dark:fill-zinc-400"
              style={{ fontSize: 11, fontWeight: 800 }}
              formatter={(v) => Number(v).toLocaleString()}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
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

const asArray = (v) => (Array.isArray(v) ? v : []);

export default function AnalyticsChartsCard() {
  const queryClient = useQueryClient();

  /**
   * The three dashboard series, each cached under its own key.
   *
   * This was two effects that both listed the same three endpoints — one for
   * the initial load, one for refreshing — plus a 15-second interval that
   * re-fetched all three whether or not anything had changed. On the landing
   * page that meant a steady four requests a minute per series against a
   * backend that answers in 1-3s, and returning to the dashboard always
   * started from an empty state because nothing was cached.
   */
  const clientsQuery = useApi(["dashboard", "monthly-clients"], "/dashboard/analytics/monthly-clients");
  const categoriesQuery = useApi(["dashboard", "items-by-category"], "/dashboard/analytics/items-by-category");
  const serviceCategoriesQuery = useApi(["dashboard", "services-by-category"], "/dashboard/analytics/services-by-category");

  const clients = asArray(clientsQuery.data);
  const categories = asArray(categoriesQuery.data);
  const serviceCategories = asArray(serviceCategoriesQuery.data);

  // Only the first load shows the spinner; refreshes keep the charts on screen.
  const loading = clientsQuery.isLoading || categoriesQuery.isLoading || serviceCategoriesQuery.isLoading;
  const error = clientsQuery.error || categoriesQuery.error || serviceCategoriesQuery.error;

  useEffect(() => {
    const refreshAll = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    const refreshCategories = () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", "items-by-category"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "services-by-category"] });
    };

    // The websocket already pushes the events that actually change these
    // numbers, so the poll is a slow backstop rather than the primary path.
    const poll = setInterval(refreshAll, 120000);

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
  }, [queryClient]);

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
  const noSvcCategoryData = serviceCategories.length === 0;

  return (
    <div className="col-span-full grid grid-cols-1 gap-6 2xl:grid-cols-3">

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
              <Area isAnimationActive={false}
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

      {/* Product categories */}
      <div className="card-shell p-6">
        <SectionHeader
          icon={FiPackage}
          title="Products Sold per Category"
          color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        />
        {noCategoryData ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
            No product data available
          </div>
        ) : (
          <CategoryBreakdown data={categories} hue={PRODUCT_HUE} unitLabel="items sold" />
        )}
      </div>

      {/* Service categories */}
      <div className="card-shell p-6">
        <SectionHeader
          icon={FiActivity}
          title="Services Rendered per Category"
          color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
        />
        {noSvcCategoryData ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
            No service data available
          </div>
        ) : (
          <CategoryBreakdown data={serviceCategories} hue={SERVICE_HUE} unitLabel="services rendered" />
        )}
      </div>

    </div>
  );
}
