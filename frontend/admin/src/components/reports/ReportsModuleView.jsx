import { useMemo, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  FiChevronDown, FiChevronLeft, FiChevronRight, FiClipboard,
  FiFileText, FiPackage, FiSearch, FiSend, FiDownload, FiRefreshCw,
  FiPlusCircle, FiX, FiCalendar, FiEye,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    let d = new Date(dateStr);
    if (typeof dateStr === "string" && !dateStr.includes("T") && !dateStr.includes("Z") && !dateStr.includes("+")) {
      d = new Date(dateStr.replace(" ", "T") + "Z");
    }
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return "N/A"; }
};

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPeso = (n) => `₱${fmt(n)}`;

const getShortType = (item) => {
  const cat = (item.category || item.inventory_category?.name || "").toLowerCase();
  const nm  = (item.name || item.item_name || "").toLowerCase();
  if (/vac/i.test(cat) || /vaccine/i.test(nm)) return "Vac";
  if (/med|drug|pharma|antibiotic/i.test(cat))  return "Med";
  if (/food|feed/i.test(cat))                    return "Food";
  return "Sup";
};

function CatBadge({ type, size = "sm" }) {
  const base = size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";
  const map = {
    Med:  "bg-blue-950/80 text-blue-400",
    Vac:  "bg-purple-950/80 text-purple-400",
    Sup:  "bg-emerald-950/80 text-emerald-400",
    Food: "bg-amber-950/80 text-amber-400",
  };
  return (
    <span className={clsx("rounded font-bold uppercase tracking-wide shrink-0", base, map[type] ?? map.Sup)}>
      {type}
    </span>
  );
}

function StockPill({ status }) {
  const map = { OK: "bg-emerald-950/80 text-emerald-400", Low: "bg-amber-950/80 text-amber-400", Out: "bg-rose-950/80 text-rose-400" };
  return <span className={clsx("rounded px-2 py-0.5 text-[10px] font-bold", map[status] ?? map.OK)}>{status}</span>;
}

const getCatName = (item) => item.inventory_category?.name || item.category || "Uncategorized";

// ─── Transaction: Sales Income Report (view/filter) ───────────────────────────

function TransactionViewPane({ inventory, services, owners, reportRows, setReportRows, generated, setGenerated, user }) {
  const toast = useToast();
  const today      = new Date().toISOString().split("T")[0];
  const monthStart = (() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; })();

  const [dateFrom, setDateFrom]                       = useState(monthStart);
  const [dateTo, setDateTo]                           = useState(today);
  const [selectedOwnerId, setSelectedOwnerId]         = useState("");
  const [itemTypeFilter, setItemTypeFilter]           = useState("all");
  const [selectedServiceId, setSelectedServiceId]     = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [loading, setLoading]                         = useState(false);
  // allRows holds the raw fetched data; displayRows is derived reactively from filters
  const [allRows, setAllRows]                         = useState([]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: 500, with_items: 1, only_transactions: 1, date_from: dateFrom, date_to: dateTo });
      if (selectedOwnerId) params.set("owner_id", selectedOwnerId);

      const res = await fetch(`/api/reports?${params}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${user?.token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const invoices = Array.isArray(data) ? data : (data.data || []);

      const rows = [];
      invoices.forEach((inv) => {
        (inv.items || []).filter((i) => !i.is_hidden).forEach((item) => {
          const invRecord    = inventory.find((i) => i.id === item.inventory_id);
          const buyingPrice  = Number(invRecord?.price) || 0;
          const sellingPrice = Number(item.unit_price) || 0;
          const qty          = Number(item.qty) || 1;
          const grossSales   = sellingPrice * qty;
          rows.push({
            date: inv.created_at,
            client: inv.pet?.owner?.name || "—",
            itemName: item.name,
            itemType: item.item_type,
            service_id: item.service_id,
            inventory_id: item.inventory_id,
            qty, buyingPrice, sellingPrice, grossSales, netSales: grossSales,
            invoiceDiscount: Number(inv.discount_value) || 0,
            invoiceId: inv.id,
          });
        });
      });
      setAllRows(rows);
      setGenerated(true);
      if (rows.length === 0) toast.warning("No transactions found for the selected filters.");
    } catch { toast.error("Failed to generate report."); }
    finally { setLoading(false); }
  };

  // Reactive filter — no re-fetch needed when filter dropdowns change
  const displayRows = useMemo(() => {
    if (!generated) return [];
    return allRows.filter((row) => {
      if (itemTypeFilter !== "all" && row.itemType !== itemTypeFilter) return false;
      if (selectedServiceId && row.service_id?.toString() !== selectedServiceId) return false;
      if (selectedInventoryId && row.inventory_id?.toString() !== selectedInventoryId) return false;
      return true;
    });
  }, [allRows, generated, itemTypeFilter, selectedServiceId, selectedInventoryId]);

  // Keep parent in sync for PDF export
  useEffect(() => { setReportRows(displayRows); }, [displayRows]);

  const handleReset = () => {
    setGenerated(false); setAllRows([]); setReportRows([]);
    setSelectedOwnerId(""); setItemTypeFilter("all");
    setSelectedServiceId(""); setSelectedInventoryId("");
    setDateFrom(monthStart); setDateTo(today);
  };

  const summary = useMemo(() => {
    const seen = new Set(); let totalDiscount = 0;
    displayRows.forEach((r) => { if (!seen.has(r.invoiceId)) { seen.add(r.invoiceId); totalDiscount += r.invoiceDiscount; } });
    const totalGross = displayRows.reduce((s, r) => s + r.grossSales, 0);
    return { totalGross, totalDiscount, totalNet: totalGross - totalDiscount };
  }, [displayRows]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "200px minmax(0,1fr)" }}>
      {/* Filter panel */}
      <div className="card-shell p-4 space-y-3 h-fit sticky top-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Filter</p>
        {[
          { label: "Date Start", el: <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" /> },
          { label: "Date End",   el: <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" /> },
        ].map(({ label, el }) => (
          <div key={label} className="space-y-1"><label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{label}</label>{el}</div>
        ))}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Client</label>
          <div className="relative">
            <select value={selectedOwnerId} onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="h-8 w-full appearance-none rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-2 pr-6 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none">
              <option value="">All clients</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <FiChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Item Type</label>
          <div className="relative">
            <select value={itemTypeFilter} onChange={(e) => { setItemTypeFilter(e.target.value); setSelectedServiceId(""); setSelectedInventoryId(""); }}
              className="h-8 w-full appearance-none rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-2 pr-6 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none">
              <option value="all">All</option>
              <option value="service">Services only</option>
              <option value="inventory">Inventory only</option>
            </select>
            <FiChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
          </div>
        </div>
        {(itemTypeFilter === "all" || itemTypeFilter === "service") && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Service</label>
            <div className="relative">
              <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}
                className="h-8 w-full appearance-none rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-2 pr-6 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none">
                <option value="">All services</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
            </div>
          </div>
        )}
        {(itemTypeFilter === "all" || itemTypeFilter === "inventory") && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Inventory Item</label>
            <div className="relative">
              <select value={selectedInventoryId} onChange={(e) => setSelectedInventoryId(e.target.value)}
                className="h-8 w-full appearance-none rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-2 pr-6 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none">
                <option value="">All items</option>
                {inventory.map((i) => <option key={i.id} value={i.id}>{i.item_name}</option>)}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
            </div>
          </div>
        )}
        <div className="flex gap-1.5 pt-1">
          <button onClick={handleReset} className="flex-1 h-8 rounded border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">Clear</button>
          <button onClick={handleGenerate} disabled={loading}
            className="flex-1 h-8 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
            {loading ? <FiRefreshCw className="h-3 w-3 animate-spin" /> : null} Search
          </button>
        </div>
        {generated && (
          <p className="text-[9px] text-zinc-400 italic text-center pt-1">
            Filters apply instantly — no need to re-search.
          </p>
        )}
      </div>

      {/* Report document */}
      <div className="card-shell p-5">
        <div className="mb-4 text-right">
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">Sales Income Report</h2>
          {generated && <p className="text-xs text-zinc-500 mt-0.5">Bill Date From {formatDate(dateFrom)} To {formatDate(dateTo)}</p>}
        </div>

        {!generated ? (
          <div className="flex h-48 items-center justify-center border border-dashed border-zinc-200 dark:border-dark-border rounded-lg">
            <div className="text-center">
              <FiFileText className="mx-auto h-10 w-10 text-zinc-200 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Set filters and click Search</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-dark-border mb-4">
              <table className="w-full text-xs" style={{ minWidth: 680 }}>
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface">
                    {["Date","Client","Item / Service","Quantity","Buying Price","Selling Price","Gross Sales","Net Sales"].map((h, i) => (
                      <th key={h} className={clsx("px-3 py-2.5 font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border last:border-r-0", i < 3 ? "text-left" : "text-right")}
                        style={{ width: ["11%","13%","20%","8%","11%","11%","13%","13%"][i] }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-400 italic">No transactions match the current filters.</td></tr>
                  ) : displayRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-zinc-100 dark:border-dark-border hover:bg-zinc-50/50 dark:hover:bg-dark-surface/20">
                      <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-r border-zinc-100 dark:border-dark-border">{formatDate(row.date)}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 truncate border-r border-zinc-100 dark:border-dark-border">{row.client}</td>
                      <td className="px-3 py-2 border-r border-zinc-100 dark:border-dark-border">
                        <div className="flex items-center gap-1.5"><CatBadge type={getShortType({ name: row.itemName })} size="xs" /><span className="text-zinc-700 dark:text-zinc-300 truncate">{row.itemName}</span></div>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400 border-r border-zinc-100 dark:border-dark-border">{row.qty}</td>
                      <td className="px-3 py-2 text-right border-r border-zinc-100 dark:border-dark-border tabular-nums">
                        {row.buyingPrice > 0 ? <span className="text-zinc-600 dark:text-zinc-400">{fmt(row.buyingPrice)}</span> : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300 border-r border-zinc-100 dark:border-dark-border tabular-nums">{fmt(row.sellingPrice)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-800 dark:text-zinc-200 border-r border-zinc-100 dark:border-dark-border tabular-nums">{fmt(row.grossSales)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(row.netSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mb-4">
              <div className="w-72 space-y-1">
                {[
                  { label: "Total Gross Sales",    val: summary.totalGross, cls: "" },
                  { label: "Total Net Sales",      val: summary.totalNet,   cls: "" },
                  { label: "Total Discount Amount",val: summary.totalDiscount, cls: "text-rose-500", wrap: true },
                  { label: "Total Sales Income",   val: summary.totalNet,   cls: "font-black text-emerald-600 dark:text-emerald-400 border-t border-zinc-200 dark:border-dark-border pt-1 mt-1" },
                ].map(({ label, val, cls, wrap }) => (
                  <div key={label} className={clsx("flex justify-between items-center", cls)}>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
                    <span className="text-xs font-bold tabular-nums">{wrap ? `(${fmt(val)})` : fmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 italic text-center border-t border-zinc-100 dark:border-dark-border pt-3">
              These results are based from bill date of Billing Invoice records. (Pending, Partially and Fully Paid).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Inventory Report Pane (read-only snapshot view) ─────────────────────────

function InventoryReportPane({ inventory, reportData, setReportData, generated, setGenerated }) {
  const [reportType, setReportType]             = useState("stock_level");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateFrom, setDateFrom]                 = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo]                     = useState(() => new Date().toISOString().split("T")[0]);

  const categories = useMemo(() => {
    const map = new Map();
    inventory.forEach((i) => { const id = i.inventory_category_id?.toString() || "0"; map.set(id, getCatName(i)); });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [inventory]);

  const handleGenerate = useCallback(() => {
    let src = inventory;
    if (reportType === "low_stock") src = src.filter((i) => Number(i.stock_level) <= Number(i.min_stock_level || 0));
    if (selectedCategory !== "all") src = src.filter((i) => (i.inventory_category_id?.toString() || "0") === selectedCategory);
    const mapped = src.map((i) => ({
      id: i.id, name: i.item_name || i.name, category: getCatName(i),
      shortType: getShortType({ ...i, name: i.item_name }),
      stock: Number(i.stock_level) || 0, buyingPrice: Number(i.price) || 0, sellingPrice: Number(i.selling_price) || 0,
      totalValue: (Number(i.stock_level) || 0) * (Number(i.selling_price) || 0),
      status: Number(i.stock_level) <= 0 ? "Out" : Number(i.stock_level) <= Number(i.min_stock_level || 0) ? "Low" : "OK",
    }));
    mapped.sort((a, b) => { const o = { Out: 0, Low: 1, OK: 2 }; return o[a.status] !== o[b.status] ? o[a.status] - o[b.status] : a.name.localeCompare(b.name); });
    setReportData(mapped); setGenerated(true);
  }, [inventory, reportType, selectedCategory, setReportData, setGenerated]);

  const handleReset = () => { setGenerated(false); setReportData([]); setSelectedCategory("all"); };
  const summary = useMemo(() => ({
    total: reportData.length, low: reportData.filter((i) => i.status === "Low").length,
    out: reportData.filter((i) => i.status === "Out").length,
    value: reportData.reduce((s, i) => s + i.totalValue, 0),
  }), [reportData]);

  const reportMonthLabel = useMemo(() =>
    new Date((dateFrom || new Date().toISOString().split("T")[0]) + "T00:00:00")
      .toLocaleDateString("en-US", { month: "long", year: "numeric" }), [dateFrom]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "200px minmax(0,1fr)" }}>
      <div className="flex flex-col gap-4">
        <div className="card-shell p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Filter</p>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Report type</label>
            <div className="relative">
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                className="h-8 w-full appearance-none rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-2 pr-6 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none">
                <option value="stock_level">Stock level</option>
                <option value="low_stock">Low stock alerts</option>
                <option value="valuation">Stock valuation</option>
                <option value="category">Category breakdown</option>
              </select>
              <FiChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Category</label>
            <div className="relative">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 w-full appearance-none rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-2 pr-6 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none">
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Date range</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
              <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-1.5 pt-1">
            <button onClick={handleReset} className="flex-1 h-8 rounded border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">Clear</button>
            <button onClick={handleGenerate} className="flex-1 h-8 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">Search</button>
          </div>
        </div>
        {generated && (
          <div className="card-shell p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Summary</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: summary.total, label: "Total items",  cls: "text-emerald-500" },
                { val: summary.low,   label: "Low stock",    cls: "text-amber-500"   },
                { val: summary.out,   label: "Out of stock", cls: "text-rose-500"    },
                { val: summary.value >= 1000 ? `₱${Math.round(summary.value / 1000)}k` : fmtPeso(summary.value), label: "Total value", cls: "text-blue-400" },
              ].map(({ val, label, cls }) => (
                <div key={label} className="rounded border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-2.5">
                  <p className={clsx("text-base font-black", cls)}>{val}</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card-shell p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Inventory Stock Report — {reportMonthLabel}</p>
          {generated && <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Generated</span>}
        </div>
        {!generated ? (
          <div className="flex h-48 items-center justify-center border border-dashed border-zinc-200 dark:border-dark-border rounded-lg">
            <div className="text-center"><FiPackage className="mx-auto h-10 w-10 text-zinc-200 dark:text-zinc-700 mb-2" /><p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Set filters and click Search</p></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-dark-border">
              <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                <thead className="bg-zinc-50 dark:bg-dark-surface border-b border-zinc-200 dark:border-dark-border">
                  <tr>
                    {[["Item","28%","left"],["Category","14%","left"],["Stock","10%","right"],["Buy Price","16%","right"],["Sell Price","16%","right"],["Status","16%","center"]].map(([h, w, a]) => (
                      <th key={h} className={clsx("px-3 py-2.5 font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border last:border-r-0", `text-${a}`)} style={{ width: w }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                  {reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30">
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 truncate border-r border-zinc-100 dark:border-dark-border">{item.name}</td>
                      <td className="px-3 py-2 border-r border-zinc-100 dark:border-dark-border"><CatBadge type={item.shortType} size="xs" /></td>
                      <td className={clsx("px-3 py-2 text-right font-bold border-r border-zinc-100 dark:border-dark-border", item.status === "Out" ? "text-rose-500" : item.status === "Low" ? "text-amber-500" : "text-emerald-500")}>{item.stock}</td>
                      <td className="px-3 py-2 text-right text-zinc-500 dark:text-zinc-400 border-r border-zinc-100 dark:border-dark-border tabular-nums">{item.buyingPrice > 0 ? fmt(item.buyingPrice) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}</td>
                      <td className="px-3 py-2 text-right font-semibold border-r border-zinc-100 dark:border-dark-border tabular-nums">{item.sellingPrice > 0 ? <span className="text-emerald-600 dark:text-emerald-400">{fmt(item.sellingPrice)}</span> : <span className="text-rose-400 text-[10px] font-black">No price</span>}</td>
                      <td className="px-3 py-2 text-center"><StockPill status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-6 mt-3 pt-3 border-t border-zinc-100 dark:border-dark-border text-xs">
              <span className="text-zinc-400">Total stock value</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtPeso(summary.value)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function ReportsModuleView() {
  const toast    = useToast();
  const { user } = useAuth();

  // Tab & section state
  const [mainTab, setMainTab]             = useState("new");
  const [reportSection, setReportSection] = useState("transaction");
  const [txSubTab, setTxSubTab]           = useState("create"); // "create" | "view"
  const [invSubTab, setInvSubTab]         = useState("create"); // "create" | "view"

  // Shared data
  const [inventory, setInventory] = useState([]);
  const [services, setServices]   = useState([]);
  const [owners, setOwners]       = useState([]);
  const [pets, setPets]           = useState([]);

  // ── Transaction CREATE form state ──────────────────────────────────────────
  const [items, setItems]                               = useState([]);
  const [selectedOwnerId, setSelectedOwnerId]           = useState("");
  const [selectedPatientId, setSelectedPatientId]       = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [patientDetails, setPatientDetails]             = useState(null);
  const [appointments, setAppointments]                 = useState([]);
  const [appointmentSearch, setAppointmentSearch]       = useState("");
  const [notes, setNotes]                               = useState("");
  const [status, setStatus]                             = useState("Draft");
  const [reportId, setReportId]                         = useState(null);
  const [reportDate, setReportDate]                     = useState(new Date().toISOString().split("T")[0]);
  const [serviceInput, setServiceInput]                 = useState("");
  const [qtyInput, setQtyInput]                         = useState(1);
  const [isDropdownOpen, setIsDropdownOpen]             = useState(false);
  const [isApptDropdownOpen, setIsApptDropdownOpen]     = useState(false);
  const [selectedService, setSelectedService]           = useState(null);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.qty * (i.unit_price || 0), 0), [items]);

  // ── Inventory CREATE form state ────────────────────────────────────────────
  const [invItems, setInvItems]                   = useState([]);
  const [invNotes, setInvNotes]                   = useState("");
  const [invItemInput, setInvItemInput]           = useState("");
  const [invQtyInput, setInvQtyInput]             = useState(1);
  const [invIsDropdownOpen, setInvIsDropdownOpen] = useState(false);
  const [invSelectedItem, setInvSelectedItem]     = useState(null);

  // ── Lifted report state ────────────────────────────────────────────────────
  const [txReportRows, setTxReportRows] = useState([]);
  const [txGenerated, setTxGenerated]   = useState(false);
  const [invReportData, setInvReportData] = useState([]);
  const [invGenerated, setInvGenerated]   = useState(false);

  // ── History state ──────────────────────────────────────────────────────────
  const [reports, setReports]             = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [pagination, setPagination]       = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 10 });
  const [expandedReportId, setExpandedReportId] = useState(null);

  const REPORTS_CACHE_KEY = "reports_history_cache";
  const CACHE_TTL         = 5 * 60 * 1000;

  // Load shared data
  useEffect(() => {
    if (!user?.token) return;
    Promise.all([
      api.get("/api/inventory").catch(() => []),
      api.get("/api/services").catch(() => []),
      api.get("/api/owners",   { params: { minimal: 1, per_page: 1000 } }).catch(() => []),
      api.get("/api/pets",     { params: { minimal: 1, per_page: 1000 } }).catch(() => []),
    ]).then(([inv, svc, ownrs, ps]) => {
      setInventory(Array.isArray(inv)   ? inv   : (inv?.data   || []));
      setServices( Array.isArray(svc)   ? svc   : (svc?.data   || svc || []));
      setOwners(   Array.isArray(ownrs) ? ownrs : (ownrs?.data || []));
      setPets(     Array.isArray(ps)    ? ps    : (ps?.data    || []));
    });
  }, [user?.token]);

  // ── Transaction form handlers ──────────────────────────────────────────────

  const filteredAppts = useMemo(() => {
    const active = appointments.filter((a) => !["cancelled", "declined", "Cancelled", "Declined"].includes(a.status));
    if (!appointmentSearch) return active;
    const term = appointmentSearch.toLowerCase();
    return active.filter((a) =>
      formatDate(a.date).toLowerCase().includes(term) || a.date.toLowerCase().includes(term) ||
      (a.title || "").toLowerCase().includes(term) || (a.service?.name || "").toLowerCase().includes(term)
    );
  }, [appointments, appointmentSearch]);

  const handlePatientSelect = (e) => {
    const pId = e.target.value;
    setSelectedPatientId(pId); setSelectedAppointmentId("");
    if (!pId) { setPatientDetails(null); setAppointments([]); return; }
    api.get(`/api/pets/${pId}`).then(setPatientDetails).catch(() => toast.error("Failed to load patient details."));
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
    const svcs = services.filter((s) => s.name.toLowerCase().includes(term) || (s.category || "").toLowerCase().includes(term)).map((s) => ({ ...s, type: "service" }));
    const invs = inventory.filter((i) => (i.item_name || "").toLowerCase().includes(term) || (i.sku || "").toLowerCase().includes(term)).map((i) => ({ ...i, name: i.item_name, sku: i.sku || i.code || "N/A", stock: i.stock_level || 0, type: "inventory" }));
    return [...svcs, ...invs].reduce((acc, item) => {
      const cat = item.type === "service" ? (item.category || "Services") : (getCatName(item) || "Inventory Products");
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [services, inventory, serviceInput]);

  const selectItem = (item) => { setServiceInput(item.name); setSelectedService(item); setIsDropdownOpen(false); };

  const handleServiceChange = (e) => {
    setServiceInput(e.target.value); setIsDropdownOpen(true);
    const ms = services.find((s) => s.name.toLowerCase() === e.target.value.toLowerCase());
    if (ms) { setSelectedService({ ...ms, type: "service" }); return; }
    const mi = inventory.find((i) => (i.item_name || "").toLowerCase() === e.target.value.toLowerCase());
    if (mi) { setSelectedService({ ...mi, name: mi.item_name, type: "inventory" }); return; }
    setSelectedService(null);
  };

  const addItem = () => {
    if (!serviceInput) return;
    const qty       = Number(qtyInput) || 1;
    const itemType  = selectedService?.type || "service";
    const unitPrice = itemType === "service"
      ? (selectedService?.price || selectedService?.unit_price || 0)
      : (selectedService?.selling_price || selectedService?.price || 0);
    if (itemType === "inventory" && selectedService) {
      const stock = selectedService.stock_level || selectedService.stock || 0;
      if (qty > stock) toast.warning(`${qty} units of '${serviceInput}' requested but only ${stock} in stock.`);
    }
    setItems((prev) => [...prev, {
      id: `li-${Date.now()}`, name: serviceInput, sku: selectedService?.sku || selectedService?.code || "",
      item_type: itemType, service_id: itemType === "service" ? selectedService?.id : null,
      inventory_id: itemType === "inventory" ? selectedService?.id : null,
      notes: itemType === "inventory" ? "Inventory Item" : "Clinical Service",
      category: selectedService?.category || getCatName(selectedService || {}),
      inventory_category: selectedService?.inventory_category, qty, unit_price: unitPrice,
    }]);
    setServiceInput(""); setQtyInput(1); setSelectedService(null);
  };

  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const resetForm = () => {
    setItems([]); setNotes(""); setSelectedOwnerId(""); setSelectedPatientId("");
    setSelectedAppointmentId(""); setPatientDetails(null); setStatus("Draft");
    setReportId(null); setReportDate(new Date().toISOString().split("T")[0]);
  };

  const submitReport = async (finalStatus) => {
    if (items.length === 0)     { toast.error("Cannot save a report without items."); return; }
    if (!selectedPatientId)     { toast.error("Please select a patient."); return; }
    if (!selectedAppointmentId) { toast.error("Please select an appointment."); return; }

    const isUpdate = !!reportId;
    const url    = isUpdate ? `/api/reports/${reportId}` : "/api/reports";
    const method = isUpdate ? "PUT" : "POST";

    const payload = {
      pet_id: selectedPatientId, appointment_id: selectedAppointmentId,
      status: finalStatus, subtotal, discount_type: "fixed", discount_value: 0,
      tax_rate: 0, total: subtotal, amount_paid: 0, notes_to_client: notes,
      items: items.map((item) => ({
        ...(item.id && !String(item.id).startsWith("li-") ? { id: item.id } : {}),
        item_type: item.item_type || "service",
        service_id: item.service_id, inventory_id: item.inventory_id,
        name: item.name, notes: item.notes, qty: item.qty,
        unit_price: item.unit_price || 0, amount: item.qty * (item.unit_price || 0), is_hidden: false,
      })),
    };

    try {
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 422) {
          const firstMsg = err.errors ? Object.values(err.errors)[0]?.[0] : (err.message || "Validation error.");
          toast.error(firstMsg);
        } else {
          toast.error(err.error || err.message || "Failed to save report");
        }
        return;
      }
      const data = await res.json();
      localStorage.removeItem(REPORTS_CACHE_KEY);
      window.dispatchEvent(new CustomEvent("inventory-forecast-refresh"));
      if (finalStatus === "Draft") {
        setReportId(data.id); setStatus(data.status || "Draft");
        toast.success("Report saved as draft.");
      } else {
        toast.success("Report completed. Stock deducted and AI data updated.");
        resetForm(); setMainTab("history"); fetchReports(1, "", null, true);
      }
    } catch (err) { toast.error(err.message || "Failed to save report"); }
  };

  // ── Inventory CREATE form handlers ─────────────────────────────────────────

  const invGroupedItems = useMemo(() => {
    const term = invItemInput.toLowerCase();
    return inventory
      .filter((i) => (i.item_name || "").toLowerCase().includes(term) || (i.sku || "").toLowerCase().includes(term))
      .reduce((acc, i) => {
        const cat = getCatName(i) || "Inventory";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push({ ...i, name: i.item_name, stock: i.stock_level || 0 });
        return acc;
      }, {});
  }, [inventory, invItemInput]);

  const addInvItem = () => {
    if (!invSelectedItem) return;
    const qty = Number(invQtyInput) || 1;
    setInvItems((prev) => [...prev, {
      id: `inv-${Date.now()}`,
      inventory_id: invSelectedItem.id,
      name: invSelectedItem.name || invSelectedItem.item_name,
      category: getCatName(invSelectedItem),
      shortType: getShortType({ ...invSelectedItem, name: invSelectedItem.item_name }),
      stock: invSelectedItem.stock_level || 0,
      sellingPrice: Number(invSelectedItem.selling_price) || 0,
      qty,
    }]);
    setInvItemInput(""); setInvQtyInput(1); setInvSelectedItem(null); setInvIsDropdownOpen(false);
  };

  const removeInvItem = (id) => setInvItems((prev) => prev.filter((i) => i.id !== id));

  const resetInvForm = () => { setInvItems([]); setInvNotes(""); setInvItemInput(""); setInvQtyInput(1); setInvSelectedItem(null); };

  const submitInventoryEntry = async () => {
    if (invItems.length === 0) { toast.error("Add at least one inventory item."); return; }
    const payload = {
      report_type: "inventory", status: "Finalized",
      subtotal: 0, discount_type: "fixed", discount_value: 0, tax_rate: 0, total: 0, amount_paid: 0,
      notes_to_client: invNotes,
      items: invItems.map((item) => ({
        item_type: "inventory",
        inventory_id: item.inventory_id,
        name: item.name,
        notes: `${item.category} | Recorded stock: ${item.qty}`,
        qty: item.qty,
        unit_price: item.sellingPrice || 0,
        amount: item.qty * (item.sellingPrice || 0),
        is_hidden: false,
      })),
    };
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.message || "Failed to save."); return; }
      window.dispatchEvent(new CustomEvent("inventory-forecast-refresh"));
      localStorage.removeItem(REPORTS_CACHE_KEY);
      toast.success("Inventory entry recorded and saved.");
      resetInvForm(); setMainTab("history"); fetchReports(1, "", null, true);
    } catch (err) { toast.error(err.message || "Failed to save."); }
  };

  // ── History fetch ──────────────────────────────────────────────────────────

  const fetchReports = useCallback(async (page = 1, search = searchQuery, signal = null, force = false) => {
    if (!user?.token) return;
    setHistoryLoading(true);
    if (page === 1 && !search && !force) {
      try {
        const cached = JSON.parse(localStorage.getItem(REPORTS_CACHE_KEY) || "null");
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setReports(cached.reports); setPagination(cached.pagination);
          setHistoryLoading(false); return;
        }
      } catch (_) { localStorage.removeItem(REPORTS_CACHE_KEY); }
    }
    try {
      const params = new URLSearchParams({ per_page: "10", page: page.toString(), search });
      const res = await fetch(`/api/reports?${params}`, {
        signal, headers: { Accept: "application/json", Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.data) {
        setReports(data.data);
        const pag = { currentPage: data.current_page, lastPage: data.last_page, total: data.total, perPage: data.per_page };
        setPagination(pag);
        if (page === 1 && !search) try { localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify({ reports: data.data, pagination: pag, ts: Date.now() })); } catch (_) {}
      }
    } catch (err) { if (err.name !== "AbortError") toast.error("Could not load report history."); }
    finally { setHistoryLoading(false); }
  }, [user?.token, searchQuery, toast]);

  useEffect(() => { if (mainTab === "history") fetchReports(1, searchQuery, null, true); }, [mainTab]);
  useEffect(() => {
    if (mainTab !== "history") return;
    const ctrl = new AbortController();
    const t = setTimeout(() => fetchReports(1, searchQuery, ctrl.signal), 500);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [searchQuery]);

  // ── Complete inventory snapshot report (view sub-tab) ─────────────────────

  const completeInventoryReport = useCallback(async () => {
    if (!invGenerated || invReportData.length === 0) { toast.error("Generate the report first."); return; }
    const payload = {
      report_type: "inventory", status: "Finalized",
      subtotal: 0, discount_type: "fixed", discount_value: 0, tax_rate: 0, total: 0, amount_paid: 0,
      items: invReportData.map((item) => ({
        item_type: "inventory", inventory_id: item.id, name: item.name,
        notes: `${item.category} | Stock: ${item.stock} | Buy: ${item.buyingPrice} | Sell: ${item.sellingPrice}`,
        qty: item.stock || 1, unit_price: item.sellingPrice || 0,
        amount: (item.stock || 1) * (item.sellingPrice || 0),
      })),
    };
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.message || "Failed."); return; }
      window.dispatchEvent(new CustomEvent("inventory-forecast-refresh"));
      localStorage.removeItem(REPORTS_CACHE_KEY);
      toast.success("Inventory report completed. Stock snapshot saved.");
      setMainTab("history"); fetchReports(1, "", null, true);
    } catch (err) { toast.error(err.message || "Failed to save."); }
  }, [invGenerated, invReportData, user?.token, toast, fetchReports]);

  const Pagination = () => {
    if (pagination.lastPage <= 1) return null;
    return (
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 py-4 mb-6 dark:border-dark-border dark:bg-dark-card shadow-sm">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Showing <span className="text-zinc-900 dark:text-zinc-50">{Math.min((pagination.currentPage - 1) * pagination.perPage + 1, pagination.total)}–{Math.min(pagination.currentPage * pagination.perPage, pagination.total)}</span> of <span className="text-zinc-900 dark:text-zinc-50">{pagination.total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchReports(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card text-zinc-400 hover:bg-zinc-50 disabled:opacity-50">
            <FiChevronLeft className="h-4 w-4" />
          </button>
          {[...Array(pagination.lastPage)].map((_, i) => {
            const p = i + 1;
            if (pagination.lastPage > 7 && p !== 1 && p !== pagination.lastPage && (p < pagination.currentPage - 1 || p > pagination.currentPage + 1)) {
              if (p === pagination.currentPage - 2 || p === pagination.currentPage + 2) return <span key={p} className="px-1 text-zinc-400 text-xs">…</span>;
              return null;
            }
            return (
              <button key={p} onClick={() => fetchReports(p)}
                className={clsx("flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black",
                  pagination.currentPage === p ? "bg-emerald-600 text-white shadow-md" : "border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card text-zinc-500 hover:bg-zinc-50")}>
                {p}
              </button>
            );
          })}
          <button onClick={() => fetchReports(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.lastPage}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card text-zinc-400 hover:bg-zinc-50 disabled:opacity-50">
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-dark-border">

      {/* Main tabs */}
      <div className="shrink-0 flex items-center gap-0 border-b border-zinc-200 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/30">
        {[{ id: "new", label: "New report", Icon: FiFileText }, { id: "history", label: "Report history", Icon: FiClipboard }].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={clsx("flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors",
              mainTab === id ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-dark-card" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ──── NEW REPORT ──── */}
      {mainTab === "new" && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Section header */}
          <div className="shrink-0 px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-dark-border">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Reports › New report</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50">New report</h1>
              <div className="flex items-center gap-2">
                {/* Transaction create sub-tab buttons */}
                {reportSection === "transaction" && txSubTab === "create" && (
                  <>
                    <span className={clsx("rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border",
                      status === "Finalized" ? "bg-emerald-950/60 text-emerald-400 border-emerald-800" : "bg-amber-950/60 text-amber-400 border-amber-800")}>
                      {status}
                    </span>
                    <button onClick={() => submitReport("Draft")} disabled={status !== "Draft"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface disabled:opacity-50 transition-colors">
                      Save draft
                    </button>
                    <button onClick={() => submitReport("Finalized")} disabled={status === "Finalized"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      <FiSend className="h-3.5 w-3.5" /> Complete report
                    </button>
                  </>
                )}
                {/* Inventory create sub-tab button */}
                {reportSection === "inventory" && invSubTab === "create" && (
                  <button onClick={submitInventoryEntry}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                    <FiSend className="h-3.5 w-3.5" /> Complete entry
                  </button>
                )}
                {/* Inventory view sub-tab button */}
                {reportSection === "inventory" && invSubTab === "view" && (
                  <button onClick={completeInventoryReport} disabled={!invGenerated}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    <FiSend className="h-3.5 w-3.5" /> Complete report
                  </button>
                )}
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                  <FiDownload className="h-3.5 w-3.5" /> Export PDF
                </button>
              </div>
            </div>

            {/* Section toggles */}
            <div className="flex items-center gap-2 mt-3">
              {[{ id: "transaction", label: "Transaction report", Icon: FiFileText }, { id: "inventory", label: "Inventory report", Icon: FiPackage }].map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setReportSection(id)}
                  className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                    reportSection === id ? "bg-emerald-950/60 text-emerald-400 border-emerald-700" : "bg-transparent text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-dark-border hover:text-zinc-700 dark:hover:text-zinc-300")}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {/* Transaction sub-tabs */}
            {reportSection === "transaction" && (
              <div className="flex items-center gap-1 mt-2 border-b border-zinc-100 dark:border-dark-border -mb-3 pb-0">
                {[{ id: "create", label: "New transaction" }, { id: "view", label: "Sales Income Report" }].map(({ id, label }) => (
                  <button key={id} onClick={() => setTxSubTab(id)}
                    className={clsx("px-4 py-2 text-xs font-semibold border-b-2 transition-colors",
                      txSubTab === id ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Inventory sub-tabs */}
            {reportSection === "inventory" && (
              <div className="flex items-center gap-1 mt-2 border-b border-zinc-100 dark:border-dark-border -mb-3 pb-0">
                {[{ id: "create", label: "New inventory entry" }, { id: "view", label: "Inventory Stock Report" }].map(({ id, label }) => (
                  <button key={id} onClick={() => setInvSubTab(id)}
                    className={clsx("px-4 py-2 text-xs font-semibold border-b-2 transition-colors",
                      invSubTab === id ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable pane */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* Transaction — New transaction (input form) */}
            {reportSection === "transaction" && txSubTab === "create" && (
              <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>

                {/* Left: form panels */}
                <div className="flex flex-col gap-4">

                  {/* Patient details */}
                  <div className="card-shell p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Patient details</p>
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Owner</p>
                        <div className="relative">
                          <select value={selectedOwnerId} onChange={(e) => {
                            const oId = e.target.value;
                            setSelectedOwnerId(oId); setSelectedPatientId(""); setPatientDetails(null); setAppointments([]);
                            if (oId) {
                              const op = pets.filter((p) => p.owner_id?.toString() === oId);
                              if (op.length === 1) handlePatientSelect({ target: { value: op[0].id.toString() } });
                            }
                          }} disabled={status === "Finalized"}
                            className="h-9 w-full appearance-none rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-8 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none disabled:opacity-50">
                            <option value="">Select an owner...</option>
                            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                          <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Pet</p>
                        <div className="relative">
                          <select value={selectedPatientId} onChange={handlePatientSelect}
                            disabled={!selectedOwnerId || status === "Finalized"}
                            className="h-9 w-full appearance-none rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-8 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none disabled:opacity-50">
                            <option value="">Select a pet...</option>
                            {pets.filter((p) => p.owner_id?.toString() === selectedOwnerId?.toString()).map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.species?.name || "Unknown"}, {p.breed?.name || "—"})</option>
                            ))}
                          </select>
                          <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Appointment</p>
                        <div className="relative">
                          <button type="button" onClick={() => setIsApptDropdownOpen(!isApptDropdownOpen)}
                            disabled={!selectedPatientId || status === "Finalized"}
                            className={clsx("flex h-9 w-full items-center justify-between rounded-lg border px-3 text-xs disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                              isApptDropdownOpen ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-zinc-200 dark:border-dark-border bg-zinc-50")}>
                            <div className="flex items-center gap-2 truncate">
                              <FiCalendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                              <span className={clsx("truncate", !selectedAppointmentId && "text-zinc-400")}>
                                {selectedAppointmentId
                                  ? (() => { const a = appointments.find((x) => x.id.toString() === selectedAppointmentId); return a ? `${formatDate(a.date)} — ${a.title || a.service?.name}` : "Selected"; })()
                                  : "Choose an appointment..."}
                              </span>
                            </div>
                            <FiChevronDown className={clsx("h-3.5 w-3.5 text-zinc-400 transition-transform shrink-0", isApptDropdownOpen && "rotate-180")} />
                          </button>
                          {isApptDropdownOpen && (
                            <div className="absolute left-0 top-full z-[60] mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-dark-border dark:bg-dark-card">
                              <div className="p-2 border-b border-zinc-100 dark:border-dark-border">
                                <div className="relative">
                                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                  <input type="text" placeholder="Search..." value={appointmentSearch}
                                    onChange={(e) => setAppointmentSearch(e.target.value)} autoFocus
                                    className="h-8 w-full rounded-lg border border-zinc-100 bg-zinc-50 pl-8 pr-3 text-xs text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300" />
                                </div>
                              </div>
                              <div className="max-h-44 overflow-y-auto divide-y divide-zinc-50 dark:divide-dark-surface">
                                {filteredAppts.length > 0 ? filteredAppts.slice(0, 50).map((appt) => (
                                  <button key={appt.id} type="button"
                                    onClick={() => { setSelectedAppointmentId(appt.id.toString()); setIsApptDropdownOpen(false); setAppointmentSearch(""); }}
                                    className={clsx("w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 dark:hover:bg-dark-surface",
                                      selectedAppointmentId === appt.id.toString() ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 font-bold" : "text-zinc-600 dark:text-zinc-400")}>
                                    <div className="flex justify-between"><span>{formatDate(appt.date)}</span><span className="opacity-60">{appt.time?.substring(0, 5)}</span></div>
                                    <div className="truncate opacity-80">{appt.title || appt.service?.name}</div>
                                  </button>
                                )) : <div className="px-3 py-6 text-center text-[10px] text-zinc-400 uppercase font-bold">No appointments found</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Services & items */}
                  <div className="card-shell p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Services & items rendered</p>
                    <div className="flex gap-2 mb-3">
                      <div className="relative flex-1">
                        <input type="text" placeholder="Search services or inventory..." value={serviceInput}
                          onChange={handleServiceChange} onFocus={() => setIsDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); setIsDropdownOpen(false); } }}
                          disabled={status === "Finalized"}
                          className="h-9 w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-7 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 disabled:opacity-50 focus:outline-none" />
                        {serviceInput && (
                          <button onClick={() => { setServiceInput(""); setSelectedService(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><FiX className="h-3.5 w-3.5" /></button>
                        )}
                        {isDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1 max-h-72 w-[460px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-2.5 shadow-2xl z-[100]">
                            {Object.keys(groupedItems).length > 0 ? Object.entries(groupedItems).map(([cat, svcs]) => (
                              <div key={cat} className="mb-3 last:mb-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-1.5">{cat}</p>
                                {svcs.map((item) => (
                                  <button key={`${item.type}-${item.id}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectItem(item)}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-dark-surface">
                                    <div className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-black uppercase", item.type === "inventory" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                                      {item.type === "inventory" ? "ITEM" : "SVC"}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {item.sku && item.sku !== "N/A" && <span className="text-[9px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{item.sku}</span>}
                                        {item.type === "inventory" && <span className={clsx("text-[9px] font-bold", item.stock > 5 ? "text-emerald-500" : "text-rose-500")}>Stock: {item.stock}</span>}
                                        {(item.price || item.selling_price) > 0 && <span className="text-[9px] text-zinc-400">{fmtPeso(item.price || item.selling_price)}</span>}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )) : <div className="py-8 text-center text-xs text-zinc-400">No matching items</div>}
                          </div>
                        )}
                      </div>
                      <input type="number" min="1" value={qtyInput} onChange={(e) => setQtyInput(e.target.value)}
                        disabled={status === "Finalized"}
                        className="h-9 w-11 rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface text-center text-xs text-zinc-700 dark:text-zinc-300 disabled:opacity-50 focus:outline-none" />
                      <button type="button" onClick={() => { addItem(); setIsDropdownOpen(false); }}
                        disabled={!serviceInput || status === "Finalized"}
                        className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        Add
                      </button>
                    </div>

                    {items.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center opacity-40">
                        <LuPawPrint className="h-7 w-7 text-zinc-300 mb-1.5" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">No items added yet</p>
                      </div>
                    ) : (
                      <>
                        {items.map((item) => (
                          <div key={item.id} className="group flex items-center gap-2 py-2 border-b border-zinc-100 dark:border-dark-border last:border-0">
                            <CatBadge type={getShortType(item)} size="xs" />
                            <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300 truncate">{item.name}</span>
                            <span className="text-[11px] text-zinc-400 shrink-0">x{item.qty}</span>
                            {item.unit_price > 0 && <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 w-16 text-right shrink-0">{fmtPeso(item.qty * item.unit_price)}</span>}
                            {status === "Draft" && (
                              <button onClick={() => removeItem(item.id)} className="p-0.5 text-zinc-300 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"><FiX className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                        ))}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-200 dark:border-dark-border">
                          <span className="text-[11px] text-zinc-400">Subtotal</span>
                          <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">{fmtPeso(subtotal)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Clinical notes */}
                  <div className="card-shell p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">Clinical notes</p>
                    <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                      disabled={status === "Finalized"} placeholder="Clinical notes or observations..."
                      className="w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 disabled:opacity-50 focus:outline-none resize-none" />
                    <button onClick={resetForm} className="mt-2 w-full h-9 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                      Reset form
                    </button>
                  </div>
                </div>

                {/* Right: live preview */}
                <div className="card-shell p-5 h-fit sticky top-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0"><LuPawPrint className="h-4 w-4" /></div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Clinical report</p>
                        <p className="text-[10px] text-zinc-400">AutoVet Systems</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-light text-zinc-300 dark:text-zinc-600">REPORT</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Date: {reportDate}</p>
                      <span className={clsx("mt-1 inline-block rounded px-2 py-0.5 text-[9px] font-black uppercase border",
                        status === "Finalized" ? "bg-emerald-950/60 text-emerald-400 border-emerald-800" : "bg-amber-950/60 text-amber-400 border-amber-800")}>
                        {status}
                      </span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Owner</p>
                    {patientDetails ? (
                      <><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{patientDetails?.owner?.name || "—"}</p><p className="text-[11px] text-zinc-500">{patientDetails?.owner?.phone || "—"}</p></>
                    ) : <p className="text-xs text-zinc-400 italic">No patient selected</p>}
                  </div>
                  <div className="rounded-lg bg-zinc-50 dark:bg-dark-surface p-3 mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Patient</p>
                    {patientDetails ? (
                      <><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{patientDetails.name}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-zinc-500"><span>{patientDetails?.species?.name || "—"} — {patientDetails?.breed?.name || "—"}</span></div></>
                    ) : <p className="text-xs text-zinc-400 italic">No patient selected</p>}
                  </div>
                  <div className="mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Services & items</p>
                    {items.filter((i) => !i.is_hidden).length > 0 ? (
                      <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-dark-border">
                            {[["Item","40%"],["Cat","20%"],["Qty","15%"],["Amount","25%"]].map(([h, w]) => (
                              <th key={h} className="pb-1.5 text-left text-[9px] font-semibold text-zinc-400" style={{ width: w }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.filter((i) => !i.is_hidden).map((item, idx) => (
                            <tr key={idx} className="border-b border-zinc-100 dark:border-dark-border/50">
                              <td className="py-1.5 text-zinc-700 dark:text-zinc-300 truncate pr-2">{item.name}</td>
                              <td className="py-1.5"><CatBadge type={getShortType(item)} size="xs" /></td>
                              <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-400">{item.qty}</td>
                              <td className="py-1.5 text-right font-semibold text-zinc-800 dark:text-zinc-200">{item.unit_price > 0 ? fmtPeso(item.qty * item.unit_price) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-xs text-zinc-400 italic">No items added.</p>}
                  </div>
                  {items.length > 0 && (
                    <div className="flex justify-end gap-6 pt-2 border-t border-zinc-200 dark:border-dark-border text-xs">
                      <span className="text-zinc-400">Total</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">{fmtPeso(subtotal)}</span>
                    </div>
                  )}
                  {notes && <><div className="border-t border-zinc-100 dark:border-dark-border my-3" /><p className="text-[10px] text-zinc-400">Notes: {notes}</p></>}
                </div>
              </div>
            )}

            {/* Transaction — Sales Income Report (view) */}
            {reportSection === "transaction" && txSubTab === "view" && (
              <TransactionViewPane
                inventory={inventory} services={services} owners={owners}
                reportRows={txReportRows} setReportRows={setTxReportRows}
                generated={txGenerated} setGenerated={setTxGenerated}
                user={user}
              />
            )}

            {/* Inventory — New inventory entry (create form) */}
            {reportSection === "inventory" && invSubTab === "create" && (
              <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>
                <div className="flex flex-col gap-4">

                  {/* Item search */}
                  <div className="card-shell p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Record inventory items</p>
                    <p className="text-[11px] text-zinc-400 mb-3">Search and add inventory items to record a stock count or adjustment entry.</p>
                    <div className="flex gap-2 mb-3">
                      <div className="relative flex-1">
                        <input type="text" placeholder="Search inventory items..." value={invItemInput}
                          onChange={(e) => { setInvItemInput(e.target.value); setInvIsDropdownOpen(true); setInvSelectedItem(null); }}
                          onFocus={() => setInvIsDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setInvIsDropdownOpen(false), 200)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvItem(); } }}
                          className="h-9 w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-7 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 focus:outline-none" />
                        {invItemInput && (
                          <button onClick={() => { setInvItemInput(""); setInvSelectedItem(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><FiX className="h-3.5 w-3.5" /></button>
                        )}
                        {invIsDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1 max-h-72 w-[420px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-2.5 shadow-2xl z-[100]">
                            {Object.keys(invGroupedItems).length > 0 ? Object.entries(invGroupedItems).map(([cat, items_]) => (
                              <div key={cat} className="mb-3 last:mb-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-1.5">{cat}</p>
                                {items_.map((item) => (
                                  <button key={item.id} type="button" onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => { setInvItemInput(item.name); setInvSelectedItem(item); setInvIsDropdownOpen(false); }}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-dark-surface">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase">ITEM</div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={clsx("text-[9px] font-bold", item.stock > 5 ? "text-emerald-500" : "text-rose-500")}>Stock: {item.stock}</span>
                                        {item.selling_price > 0 && <span className="text-[9px] text-zinc-400">{fmtPeso(item.selling_price)}</span>}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )) : <div className="py-8 text-center text-xs text-zinc-400">No matching inventory items</div>}
                          </div>
                        )}
                      </div>
                      <input type="number" min="1" value={invQtyInput} onChange={(e) => setInvQtyInput(e.target.value)}
                        className="h-9 w-11 rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface text-center text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
                      <button type="button" onClick={addInvItem} disabled={!invSelectedItem}
                        className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        Add
                      </button>
                    </div>

                    {invItems.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center opacity-40">
                        <FiPackage className="h-7 w-7 text-zinc-300 mb-1.5" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">No items added yet</p>
                      </div>
                    ) : (
                      <>
                        {invItems.map((item) => (
                          <div key={item.id} className="group flex items-center gap-2 py-2 border-b border-zinc-100 dark:border-dark-border last:border-0">
                            <CatBadge type={item.shortType} size="xs" />
                            <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300 truncate">{item.name}</span>
                            <span className="text-[11px] text-zinc-400 shrink-0">x{item.qty}</span>
                            {item.sellingPrice > 0 && <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 w-16 text-right shrink-0">{fmtPeso(item.qty * item.sellingPrice)}</span>}
                            <button onClick={() => removeInvItem(item.id)} className="p-0.5 text-zinc-300 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"><FiX className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="card-shell p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">Notes</p>
                    <textarea rows={3} value={invNotes} onChange={(e) => setInvNotes(e.target.value)}
                      placeholder="Reason for entry, supplier name, batch number..."
                      className="w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 focus:outline-none resize-none" />
                    <button onClick={resetInvForm} className="mt-2 w-full h-9 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                      Reset form
                    </button>
                  </div>
                </div>

                {/* Right: preview */}
                <div className="card-shell p-5 h-fit sticky top-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shrink-0"><FiPackage className="h-4 w-4" /></div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Inventory entry</p>
                        <p className="text-[10px] text-zinc-400">AutoVet Systems</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-light text-zinc-300 dark:text-zinc-600">INVENTORY</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Date: {new Date().toISOString().split("T")[0]}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Items recorded</p>
                    {invItems.length > 0 ? (
                      <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-dark-border">
                            {[["Item","42%"],["Cat","20%"],["Qty","13%"],["Value","25%"]].map(([h, w]) => (
                              <th key={h} className="pb-1.5 text-left text-[9px] font-semibold text-zinc-400" style={{ width: w }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {invItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-zinc-100 dark:border-dark-border/50">
                              <td className="py-1.5 text-zinc-700 dark:text-zinc-300 truncate pr-2">{item.name}</td>
                              <td className="py-1.5"><CatBadge type={item.shortType} size="xs" /></td>
                              <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-400">{item.qty}</td>
                              <td className="py-1.5 text-right font-semibold text-zinc-800 dark:text-zinc-200">{item.sellingPrice > 0 ? fmtPeso(item.qty * item.sellingPrice) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-xs text-zinc-400 italic">No items added.</p>}
                  </div>

                  {invItems.length > 0 && (
                    <div className="flex justify-end gap-6 pt-2 border-t border-zinc-200 dark:border-dark-border text-xs">
                      <span className="text-zinc-400">Total value</span>
                      <span className="font-black text-amber-500 tabular-nums">
                        {fmtPeso(invItems.reduce((s, i) => s + i.qty * i.sellingPrice, 0))}
                      </span>
                    </div>
                  )}

                  {invNotes && (
                    <><div className="border-t border-zinc-100 dark:border-dark-border my-3" /><p className="text-[10px] text-zinc-400">Notes: {invNotes}</p></>
                  )}

                  <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-3">
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      This entry records inventory items for reporting and AI forecasting. Click "Complete entry" to save.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory — Stock Report (view) */}
            {reportSection === "inventory" && invSubTab === "view" && (
              <InventoryReportPane
                inventory={inventory}
                reportData={invReportData} setReportData={setInvReportData}
                generated={invGenerated} setGenerated={setInvGenerated}
              />
            )}
          </div>
        </div>
      )}

      {/* ──── HISTORY ──── */}
      {mainTab === "history" && (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patient or report..."
                className="h-10 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-10 pr-4 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none" />
            </div>
          </div>
          <Pagination />
          {historyLoading ? (
            <div className="py-16 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs animate-pulse">Loading reports...</div>
          ) : reports.length > 0 ? (
            <div className="space-y-2.5">
              {reports.map((rep) => (
                <div key={rep.id} className="rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-dark-surface/40 transition-colors"
                    onClick={() => setExpandedReportId(expandedReportId === rep.id ? null : rep.id)}>
                    <div className="flex items-center gap-3">
                      <div className={clsx("flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                        rep.report_type === "inventory" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600")}>
                        {rep.report_type === "inventory" ? <FiPackage className="h-4 w-4" /> : <FiClipboard className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {rep.report_type === "inventory" ? "Inventory Report" : (rep.pet?.name || "—")}
                          </p>
                          {rep.report_type === "inventory" && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Stock snapshot</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">
                          {formatDate(rep.created_at)} · {rep.report_type === "inventory" ? `${rep.items_count ?? 0} items tracked` : (rep.appointment ? (rep.appointment.title || rep.appointment.service?.name || "Appointment") : "No appointment")}
                        </p>
                      </div>
                    </div>
                    <span className={clsx("text-[10px] font-black uppercase px-2 py-0.5 rounded",
                      rep.status === "Finalized" || rep.status === "Paid" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400")}>
                      {rep.status}
                    </span>
                  </div>
                  {expandedReportId === rep.id && (
                    <div className="border-t border-zinc-100 dark:border-dark-border px-5 py-3.5 bg-zinc-50/50 dark:bg-dark-surface/20">
                      {rep.items && rep.items.filter((i) => !i.is_hidden).length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">{rep.report_type === "inventory" ? "Items Tracked" : "Items Rendered"}</p>
                          {rep.items.filter((i) => !i.is_hidden).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2"><CatBadge type={getShortType(item)} size="xs" /><span className="text-zinc-600 dark:text-zinc-300">{item.name}</span></div>
                              <span className="text-zinc-400 font-semibold">Qty: {item.qty}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-zinc-400 italic">No items on this report.</p>}
                      {rep.notes_to_client && <p className="mt-2.5 text-xs text-zinc-400 italic border-t border-zinc-100 dark:border-dark-border pt-2.5">"{rep.notes_to_client}"</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <FiClipboard className="mx-auto h-10 w-10 text-zinc-200 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No reports found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportsModuleView;
