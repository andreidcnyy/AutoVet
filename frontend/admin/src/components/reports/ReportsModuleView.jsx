import { useMemo, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  FiChevronDown, FiChevronLeft, FiChevronRight, FiClipboard,
  FiFileText, FiPackage, FiSearch, FiSend, FiDownload, FiRefreshCw, FiTag,
} from "react-icons/fi";
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

const formatDateTime = (d = new Date()) =>
  d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) +
  " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

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

// ─── Sales Income Report (Transaction) ───────────────────────────────────────

function TransactionReportPane({ inventory, services, owners, reportRows, setReportRows, generated, setGenerated, user }) {
  const toast = useToast();
  const today      = new Date().toISOString().split("T")[0];
  const monthStart = (() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; })();

  const [dateFrom, setDateFrom]               = useState(monthStart);
  const [dateTo, setDateTo]                   = useState(today);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [itemTypeFilter, setItemTypeFilter]   = useState("all");
  const [selectedServiceId, setSelectedServiceId]     = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [loading, setLoading]                 = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        per_page: 500, with_items: 1, only_transactions: 1,
        date_from: dateFrom, date_to: dateTo,
      });
      if (selectedOwnerId) params.set("owner_id", selectedOwnerId);

      const res = await fetch(`/api/reports?${params}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${user?.token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const invoices = Array.isArray(data) ? data : (data.data || []);

      const rows = [];
      invoices.forEach((inv) => {
        (inv.items || []).filter((i) => !i.is_hidden).forEach((item) => {
          if (itemTypeFilter !== "all" && item.item_type !== itemTypeFilter) return;
          if (selectedServiceId && item.service_id?.toString() !== selectedServiceId) return;
          if (selectedInventoryId && item.inventory_id?.toString() !== selectedInventoryId) return;
          const invRecord   = inventory.find((i) => i.id === item.inventory_id);
          const buyingPrice = Number(invRecord?.price) || 0;
          const sellingPrice = Number(item.unit_price) || 0;
          const qty          = Number(item.qty) || 1;
          const grossSales   = sellingPrice * qty;
          rows.push({
            date:            inv.created_at,
            client:          inv.pet?.owner?.name || "—",
            itemName:        item.name,
            itemType:        item.item_type,
            qty, buyingPrice, sellingPrice, grossSales,
            netSales:        grossSales,
            invoiceDiscount: Number(inv.discount_value) || 0,
            invoiceId:       inv.id,
          });
        });
      });

      setReportRows(rows);
      setGenerated(true);
      if (rows.length === 0) toast.warning("No transactions found for the selected filters.");
    } catch {
      toast.error("Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setGenerated(false); setReportRows([]);
    setSelectedOwnerId(""); setItemTypeFilter("all");
    setSelectedServiceId(""); setSelectedInventoryId("");
    setDateFrom(monthStart); setDateTo(today);
  };

  const summary = useMemo(() => {
    const seen = new Set();
    let totalDiscount = 0;
    reportRows.forEach((r) => {
      if (!seen.has(r.invoiceId)) { seen.add(r.invoiceId); totalDiscount += r.invoiceDiscount; }
    });
    const totalGross = reportRows.reduce((s, r) => s + r.grossSales, 0);
    const totalNet   = totalGross - totalDiscount;
    return { totalGross, totalDiscount, totalNet };
  }, [reportRows]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "200px minmax(0,1fr)" }}>

      {/* Left: filter panel */}
      <div className="card-shell p-4 space-y-3 h-fit sticky top-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Filter</p>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Date Start</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Date End</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
        </div>
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
              <option value="service">Services</option>
              <option value="inventory">Inventory</option>
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
          <button onClick={handleReset}
            className="flex-1 h-8 rounded border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
            Clear
          </button>
          <button onClick={handleGenerate} disabled={loading}
            className="flex-1 h-8 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
            {loading ? <FiRefreshCw className="h-3 w-3 animate-spin" /> : null}
            Search
          </button>
        </div>
      </div>

      {/* Right: report document */}
      <div className="card-shell p-5">

        {/* Report header */}
        <div className="mb-4">
          <div className="flex items-start justify-between">
            <div />
            <div className="text-right">
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Sales Income Report</h2>
              {generated && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  Bill Date From {formatDate(dateFrom)} To {formatDate(dateTo)}
                </p>
              )}
            </div>
          </div>
        </div>

        {!generated ? (
          <div className="flex h-48 items-center justify-center text-center border border-dashed border-zinc-200 dark:border-dark-border rounded-lg">
            <div>
              <FiFileText className="mx-auto h-10 w-10 text-zinc-200 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Set filters and click Search</p>
            </div>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-dark-border mb-4">
              <table className="w-full text-xs" style={{ minWidth: 680 }}>
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface">
                    {["Date","Client","Item / Service","Quantity","Buying Price","Selling Price","Gross Sales","Net Sales"].map((h, i) => (
                      <th key={h}
                        className={clsx("px-3 py-2.5 font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border last:border-r-0",
                          i < 3 ? "text-left" : "text-right")}
                        style={{ width: ["11%","13%","20%","8%","11%","11%","13%","13%"][i] }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-400 italic">
                        No transactions found for the selected period.
                      </td>
                    </tr>
                  ) : reportRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-zinc-100 dark:border-dark-border hover:bg-zinc-50/50 dark:hover:bg-dark-surface/20">
                      <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-r border-zinc-100 dark:border-dark-border">{formatDate(row.date)}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 truncate border-r border-zinc-100 dark:border-dark-border">{row.client}</td>
                      <td className="px-3 py-2 border-r border-zinc-100 dark:border-dark-border">
                        <div className="flex items-center gap-1.5">
                          <CatBadge type={getShortType({ name: row.itemName })} size="xs" />
                          <span className="text-zinc-700 dark:text-zinc-300 truncate">{row.itemName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400 border-r border-zinc-100 dark:border-dark-border">{row.qty}</td>
                      <td className="px-3 py-2 text-right border-r border-zinc-100 dark:border-dark-border">
                        {row.buyingPrice > 0
                          ? <span className="text-zinc-600 dark:text-zinc-400">{fmt(row.buyingPrice)}</span>
                          : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300 border-r border-zinc-100 dark:border-dark-border">{fmt(row.sellingPrice)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-800 dark:text-zinc-200 border-r border-zinc-100 dark:border-dark-border">{fmt(row.grossSales)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmt(row.netSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals block — right-aligned, matching reference */}
            <div className="flex justify-end mb-4">
              <div className="w-72 space-y-1">
                {[
                  { label: "Total Gross Sales",    val: summary.totalGross,    cls: "text-zinc-700 dark:text-zinc-300" },
                  { label: "Total Net Sales",      val: summary.totalNet,      cls: "text-zinc-700 dark:text-zinc-300" },
                  { label: "Total Discount Amount",val: summary.totalDiscount, cls: "text-rose-500", wrap: true },
                  { label: "Total Sales Income",   val: summary.totalNet,      cls: "font-black text-emerald-600 dark:text-emerald-400 border-t border-zinc-200 dark:border-dark-border pt-1 mt-1" },
                ].map(({ label, val, cls, wrap }) => (
                  <div key={label} className={clsx("flex justify-between items-center", cls)}>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
                    <span className={clsx("text-xs font-bold tabular-nums")}>
                      {wrap ? `(${fmt(val)})` : fmt(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer note */}
            <p className="text-[10px] text-zinc-400 italic text-center border-t border-zinc-100 dark:border-dark-border pt-3">
              These results are based from bill date of Billing Invoice records. (Pending, Partially and Fully Paid).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Service Summary List Report ──────────────────────────────────────────────

function ServiceReportPane({ services, clinic }) {
  const [itemSearch, setItemSearch]     = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [generated, setGenerated]       = useState(false);
  const [reportData, setReportData]     = useState([]);
  const generatedAt                     = useState(() => new Date())[0];

  const handleSearch = () => {
    let src = services;
    if (itemSearch.trim()) {
      src = src.filter((s) => s.name.toLowerCase().includes(itemSearch.toLowerCase()));
    }
    if (categorySearch.trim()) {
      src = src.filter((s) => (s.category || "").toLowerCase().includes(categorySearch.toLowerCase()));
    }
    setReportData(src);
    setGenerated(true);
  };

  const handleClear = () => {
    setItemSearch(""); setCategorySearch("");
    setGenerated(false); setReportData([]);
  };

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map();
    reportData.forEach((s) => {
      const cat = s.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(s);
    });
    return [...map.entries()];
  }, [reportData]);

  const now = new Date();
  const asOf = formatDateTime(now);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "200px minmax(0,1fr)" }}>

      {/* Left: filter panel */}
      <div className="card-shell p-4 space-y-3 h-fit sticky top-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Filter</p>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Item</label>
          <input type="text" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="Search service..."
            className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 focus:outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Category</label>
          <input type="text" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="Search category..."
            className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 focus:outline-none" />
        </div>

        <div className="flex gap-1.5 pt-1">
          <button onClick={handleClear}
            className="flex-1 h-8 rounded border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
            Clear
          </button>
          <button onClick={handleSearch}
            className="flex-1 h-8 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1">
            <FiSearch className="h-3 w-3" /> Search
          </button>
        </div>
      </div>

      {/* Right: report document */}
      <div className="card-shell p-5">

        {!generated ? (
          <div className="flex h-48 items-center justify-center text-center border border-dashed border-zinc-200 dark:border-dark-border rounded-lg">
            <div>
              <FiTag className="mx-auto h-10 w-10 text-zinc-200 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Enter filters and click Search</p>
            </div>
          </div>
        ) : (
          <>
            {/* Clinic header — matches reference */}
            <div className="flex items-start justify-between mb-4 pb-4 border-b border-zinc-200 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0 text-[10px] font-black text-center leading-tight px-1">
                  AUTO<br/>VET
                </div>
                <div>
                  <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase">
                    {clinic?.clinic_name || "AutoVet Clinic"}
                  </p>
                  {clinic?.address && <p className="text-[10px] text-zinc-500">{clinic.address}</p>}
                  {(clinic?.phone || clinic?.email) && (
                    <p className="text-[10px] text-zinc-400">
                      {[clinic?.phone, clinic?.email].filter(Boolean).join(" / ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50 tracking-tight">SERVICE SUMMARY LIST REPORT</h2>
                <p className="text-[10px] text-zinc-400 mt-1">as of {asOf}</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-dark-border mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface">
                    <th className="px-4 py-2.5 text-left font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border">Service</th>
                    <th className="px-4 py-2.5 text-right font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border w-28">Buying</th>
                    <th className="px-4 py-2.5 text-right font-bold text-zinc-700 dark:text-zinc-300 w-28">Service Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-xs text-zinc-400 italic">No services found.</td>
                    </tr>
                  ) : grouped.map(([category, svcs]) => (
                    <>
                      {/* Category header row */}
                      <tr key={`cat-${category}`} className="bg-zinc-100 dark:bg-dark-surface/60 border-b border-zinc-200 dark:border-dark-border">
                        <td colSpan={3} className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 italic">
                          {category}
                        </td>
                      </tr>
                      {/* Service rows */}
                      {svcs.map((svc) => (
                        <tr key={svc.id} className="border-b border-zinc-100 dark:border-dark-border hover:bg-zinc-50/50 dark:hover:bg-dark-surface/20">
                          <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300 border-r border-zinc-100 dark:border-dark-border pl-8">
                            {svc.name}
                          </td>
                          <td className="px-4 py-2 text-right text-zinc-500 dark:text-zinc-400 border-r border-zinc-100 dark:border-dark-border tabular-nums">
                            {fmt(svc.buying_price || svc.cost || 0)}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">
                            {svc.pricing_mode !== "manual"
                              ? <span className="text-[10px] text-zinc-400 italic">Dynamic</span>
                              : fmt(svc.price || 0)}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <p className="text-[10px] text-zinc-400 italic text-center border-t border-zinc-100 dark:border-dark-border pt-3">
              Buying and Selling Price comes from update item information as of {asOf}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Inventory Report Pane ────────────────────────────────────────────────────

function InventoryReportPane({ inventory, reportData, setReportData, generated, setGenerated }) {
  const [reportType, setReportType]             = useState("stock_level");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateFrom, setDateFrom]                 = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const categories = useMemo(() => {
    const map = new Map();
    inventory.forEach((i) => {
      const id = i.inventory_category_id?.toString() || "0";
      map.set(id, getCatName(i));
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [inventory]);

  const handleGenerate = useCallback(() => {
    let src = inventory;
    if (reportType === "low_stock") {
      src = src.filter((i) => Number(i.stock_level) <= Number(i.min_stock_level || 0));
    }
    if (selectedCategory !== "all") {
      src = src.filter((i) => (i.inventory_category_id?.toString() || "0") === selectedCategory);
    }
    const mapped = src.map((i) => ({
      id:           i.id,
      name:         i.item_name || i.name,
      category:     getCatName(i),
      shortType:    getShortType({ ...i, name: i.item_name }),
      stock:        Number(i.stock_level) || 0,
      buyingPrice:  Number(i.price) || 0,
      sellingPrice: Number(i.selling_price) || 0,
      totalValue:   (Number(i.stock_level) || 0) * (Number(i.selling_price) || 0),
      status:       Number(i.stock_level) <= 0 ? "Out"
        : Number(i.stock_level) <= Number(i.min_stock_level || 0) ? "Low" : "OK",
    }));
    mapped.sort((a, b) => {
      const o = { Out: 0, Low: 1, OK: 2 };
      return o[a.status] !== o[b.status] ? o[a.status] - o[b.status] : a.name.localeCompare(b.name);
    });
    setReportData(mapped);
    setGenerated(true);
  }, [inventory, reportType, selectedCategory, setReportData, setGenerated]);

  const handleReset = () => { setGenerated(false); setReportData([]); setSelectedCategory("all"); };

  const summary = useMemo(() => ({
    total: reportData.length,
    low:   reportData.filter((i) => i.status === "Low").length,
    out:   reportData.filter((i) => i.status === "Out").length,
    value: reportData.reduce((s, i) => s + i.totalValue, 0),
  }), [reportData]);

  const reportMonthLabel = useMemo(() =>
    new Date((dateFrom || new Date().toISOString().split("T")[0]) + "T00:00:00")
      .toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  [dateFrom]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "200px minmax(0,1fr)" }}>

      {/* Left: filter panel */}
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
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-full rounded border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
            </div>
          </div>

          <div className="flex gap-1.5 pt-1">
            <button onClick={handleReset}
              className="flex-1 h-8 rounded border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
              Clear
            </button>
            <button onClick={handleGenerate}
              className="flex-1 h-8 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
              Search
            </button>
          </div>
        </div>

        {generated && (
          <div className="card-shell p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Summary</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { val: summary.total, label: "Total items",  cls: "text-emerald-500" },
                { val: summary.low,   label: "Low stock",    cls: "text-amber-500"  },
                { val: summary.out,   label: "Out of stock", cls: "text-rose-500"   },
                { val: summary.value >= 1000 ? `₱${Math.round(summary.value / 1000)}k` : fmtPeso(summary.value),
                  label: "Total value", cls: "text-blue-400" },
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

      {/* Right: report document */}
      <div className="card-shell p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Inventory Stock Report — {reportMonthLabel}
          </p>
          {generated && (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Generated
            </span>
          )}
        </div>

        {!generated ? (
          <div className="flex h-48 items-center justify-center text-center border border-dashed border-zinc-200 dark:border-dark-border rounded-lg">
            <div>
              <FiPackage className="mx-auto h-10 w-10 text-zinc-200 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Set filters and click Search</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-dark-border">
              <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                <thead className="bg-zinc-50 dark:bg-dark-surface border-b border-zinc-200 dark:border-dark-border">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border" style={{ width: "28%" }}>Item</th>
                    <th className="px-3 py-2.5 text-left font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border" style={{ width: "14%" }}>Category</th>
                    <th className="px-3 py-2.5 text-right font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border" style={{ width: "10%" }}>Stock</th>
                    <th className="px-3 py-2.5 text-right font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border" style={{ width: "16%" }}>Buy Price</th>
                    <th className="px-3 py-2.5 text-right font-bold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-dark-border" style={{ width: "16%" }}>Sell Price</th>
                    <th className="px-3 py-2.5 text-center font-bold text-zinc-700 dark:text-zinc-300" style={{ width: "16%" }}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                  {reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30">
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 truncate border-r border-zinc-100 dark:border-dark-border">{item.name}</td>
                      <td className="px-3 py-2 border-r border-zinc-100 dark:border-dark-border"><CatBadge type={item.shortType} size="xs" /></td>
                      <td className={clsx("px-3 py-2 text-right font-bold border-r border-zinc-100 dark:border-dark-border",
                        item.status === "Out" ? "text-rose-500" : item.status === "Low" ? "text-amber-500" : "text-emerald-500")}>
                        {item.stock}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500 dark:text-zinc-400 border-r border-zinc-100 dark:border-dark-border tabular-nums">
                        {item.buyingPrice > 0 ? fmt(item.buyingPrice) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold border-r border-zinc-100 dark:border-dark-border tabular-nums">
                        {item.sellingPrice > 0
                          ? <span className="text-emerald-600 dark:text-emerald-400">{fmt(item.sellingPrice)}</span>
                          : <span className="text-rose-400 text-[10px] font-black">No price</span>}
                      </td>
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

  const [mainTab, setMainTab]             = useState("new");
  const [reportSection, setReportSection] = useState("transaction");
  const [inventory, setInventory]         = useState([]);
  const [services, setServices]           = useState([]);
  const [owners, setOwners]               = useState([]);
  const [clinic, setClinic]               = useState(null);

  // Lifted state — transaction report
  const [txReportRows, setTxReportRows]   = useState([]);
  const [txGenerated, setTxGenerated]     = useState(false);

  // Lifted state — inventory report
  const [invReportData, setInvReportData] = useState([]);
  const [invGenerated, setInvGenerated]   = useState(false);

  // History
  const [reports, setReports]             = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [pagination, setPagination]       = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 10 });
  const [expandedReportId, setExpandedReportId] = useState(null);

  const REPORTS_CACHE_KEY = "reports_history_cache";
  const CACHE_TTL         = 5 * 60 * 1000;

  // Load data
  useEffect(() => {
    if (!user?.token) return;
    Promise.all([
      api.get("/api/inventory").catch(() => []),
      api.get("/api/services").catch(() => []),
      api.get("/api/owners", { params: { minimal: 1, per_page: 1000 } }).catch(() => []),
      fetch("/api/settings", { headers: { Accept: "application/json", Authorization: `Bearer ${user.token}` } })
        .then((r) => r.json()).catch(() => null),
    ]).then(([inv, svc, ownrs, settings]) => {
      setInventory(Array.isArray(inv) ? inv : (inv?.data || []));
      setServices(Array.isArray(svc) ? svc : (svc?.data || svc || []));
      setOwners(Array.isArray(ownrs) ? ownrs : (ownrs?.data || []));
      if (settings) setClinic(settings);
    });
  }, [user?.token]);

  // History fetch
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
    } catch (err) {
      if (err.name !== "AbortError") toast.error("Could not load report history.");
    } finally { setHistoryLoading(false); }
  }, [user?.token, searchQuery, toast]);

  useEffect(() => { if (mainTab === "history") fetchReports(1, searchQuery, null, true); }, [mainTab]);
  useEffect(() => {
    if (mainTab !== "history") return;
    const ctrl = new AbortController();
    const t = setTimeout(() => fetchReports(1, searchQuery, ctrl.signal), 500);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [searchQuery]);

  // Complete inventory report — saves snapshot to DB
  const completeInventoryReport = useCallback(async () => {
    if (!invGenerated || invReportData.length === 0) {
      toast.error("Generate the report first before completing it.");
      return;
    }
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
      setMainTab("history");
      fetchReports(1, "", null, true);
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

  const SECTIONS = [
    { id: "transaction", label: "Transaction report", Icon: FiFileText },
    { id: "inventory",   label: "Inventory report",   Icon: FiPackage  },
    { id: "service",     label: "Service report",      Icon: FiTag      },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-dark-border">

      {/* Main tabs */}
      <div className="shrink-0 flex items-center gap-0 border-b border-zinc-200 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/30">
        {[
          { id: "new",     label: "New report",     Icon: FiFileText  },
          { id: "history", label: "Report history", Icon: FiClipboard },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={clsx(
              "flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors",
              mainTab === id
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-dark-card"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}>
            <Icon className="h-4 w-4" />
            {label}
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
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                  <FiDownload className="h-3.5 w-3.5" /> Export PDF
                </button>
                {reportSection === "inventory" && (
                  <button onClick={completeInventoryReport} disabled={!invGenerated}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    <FiSend className="h-3.5 w-3.5" /> Complete report
                  </button>
                )}
              </div>
            </div>

            {/* Section toggles */}
            <div className="flex items-center gap-2 mt-3">
              {SECTIONS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setReportSection(id)}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                    reportSection === id
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-700"
                      : "bg-transparent text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-dark-border hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable pane */}
          <div className="flex-1 overflow-y-auto p-5">
            {reportSection === "transaction" && (
              <TransactionReportPane
                inventory={inventory}
                services={services}
                owners={owners}
                reportRows={txReportRows}
                setReportRows={setTxReportRows}
                generated={txGenerated}
                setGenerated={setTxGenerated}
                user={user}
              />
            )}
            {reportSection === "inventory" && (
              <InventoryReportPane
                inventory={inventory}
                reportData={invReportData}
                setReportData={setInvReportData}
                generated={invGenerated}
                setGenerated={setInvGenerated}
              />
            )}
            {reportSection === "service" && (
              <ServiceReportPane services={services} clinic={clinic} />
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
                        rep.report_type === "inventory"
                          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                          : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600")}>
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
                          {formatDate(rep.created_at)} · {rep.report_type === "inventory"
                            ? `${rep.items_count ?? 0} items tracked`
                            : (rep.appointment ? (rep.appointment.title || rep.appointment.service?.name || "Appointment") : "No appointment")}
                        </p>
                      </div>
                    </div>
                    <span className={clsx("text-[10px] font-black uppercase px-2 py-0.5 rounded",
                      rep.status === "Finalized" || rep.status === "Paid"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400")}>
                      {rep.status}
                    </span>
                  </div>
                  {expandedReportId === rep.id && (
                    <div className="border-t border-zinc-100 dark:border-dark-border px-5 py-3.5 bg-zinc-50/50 dark:bg-dark-surface/20">
                      {rep.items && rep.items.filter((i) => !i.is_hidden).length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                            {rep.report_type === "inventory" ? "Items Tracked" : "Items Rendered"}
                          </p>
                          {rep.items.filter((i) => !i.is_hidden).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <CatBadge type={getShortType(item)} size="xs" />
                                <span className="text-zinc-600 dark:text-zinc-300">{item.name}</span>
                              </div>
                              <span className="text-zinc-400 font-semibold">Qty: {item.qty}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-zinc-400 italic">No items on this report.</p>}
                      {rep.notes_to_client && (
                        <p className="mt-2.5 text-xs text-zinc-400 italic border-t border-zinc-100 dark:border-dark-border pt-2.5">"{rep.notes_to_client}"</p>
                      )}
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
