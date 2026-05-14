import { useMemo, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  FiChevronDown, FiChevronLeft, FiChevronRight, FiClipboard, FiEye,
  FiFileText, FiPackage, FiPlusCircle, FiSearch, FiSend, FiX,
  FiDownload, FiCalendar,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useFormErrors } from "../../hooks/useFormErrors";
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
  `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getShortType = (item) => {
  const cat = (item.category || item.inventory_category?.name || "").toLowerCase();
  const nm  = (item.name || item.item_name || "").toLowerCase();
  if (/vac/i.test(cat) || /vaccine/i.test(nm)) return "Vac";
  if (/med|drug|pharma|antibiotic/i.test(cat)) return "Med";
  if (/food|feed/i.test(cat)) return "Food";
  if (/supply|suppli/i.test(cat)) return "Sup";
  if (item.item_type === "service") return cat.substring(0, 3).toUpperCase() || "Svc";
  return cat.substring(0, 3).toUpperCase() || "Inv";
};

const getCatName = (item) =>
  item.inventory_category?.name || item.category || "Uncategorized";

// ─── Stock badge ──────────────────────────────────────────────────────────────

function StockBadge({ status }) {
  return (
    <span className={clsx(
      "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide",
      status === "Out" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
        : status === "Low" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    )}>
      {status}
    </span>
  );
}

// ─── Inventory Report Pane ────────────────────────────────────────────────────

function InventoryReportPane({ inventory }) {
  const [reportType, setReportType] = useState("stock_level");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [generated, setGenerated] = useState(false);
  const [reportData, setReportData] = useState([]);

  const categories = useMemo(() => {
    const map = new Map();
    inventory.forEach((i) => {
      const id = i.inventory_category_id?.toString() || "0";
      map.set(id, getCatName(i));
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [inventory]);

  const handleGenerate = useCallback(() => {
    let src = reportType === "low_stock"
      ? inventory.filter((i) => Number(i.stock_level) <= Number(i.min_stock_level || 0))
      : inventory;
    if (selectedCategory !== "all") {
      src = src.filter((i) => (i.inventory_category_id?.toString() || "0") === selectedCategory);
    }
    const mapped = src.map((i) => ({
      id: i.id,
      name: i.item_name || i.name,
      category: getCatName(i),
      stock: Number(i.stock_level) || 0,
      minStock: Number(i.min_stock_level) || 0,
      unitValue: Number(i.selling_price) || 0,
      totalValue: (Number(i.stock_level) || 0) * (Number(i.selling_price) || 0),
      status: Number(i.stock_level) <= 0 ? "Out"
        : Number(i.stock_level) <= Number(i.min_stock_level || 0) ? "Low" : "OK",
    }));
    mapped.sort((a, b) => {
      const o = { Out: 0, Low: 1, OK: 2 };
      return o[a.status] !== o[b.status] ? o[a.status] - o[b.status] : a.name.localeCompare(b.name);
    });
    setReportData(mapped);
    setGenerated(true);
  }, [inventory, reportType, selectedCategory]);

  const handleReset = () => { setGenerated(false); setReportData([]); setSelectedCategory("all"); };

  const summary = useMemo(() => ({
    total: reportData.length,
    low: reportData.filter((i) => i.status === "Low").length,
    out: reportData.filter((i) => i.status === "Out").length,
    value: reportData.reduce((s, i) => s + i.totalValue, 0),
  }), [reportData]);

  const reportMonthLabel = useMemo(() => {
    if (!dateFrom) return "";
    return new Date(dateFrom + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [dateFrom]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Filters */}
      <aside className="w-72 shrink-0 flex flex-col overflow-y-auto border-r border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card">
        <div className="p-5 space-y-5">
          <section>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Report filters</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Report type</label>
                <div className="relative">
                  <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-8 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none">
                    <option value="stock_level">Stock level summary</option>
                    <option value="low_stock">Low stock report</option>
                    <option value="valuation">Stock valuation</option>
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Category</label>
                <div className="relative">
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-8 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none">
                    <option value="all">All categories</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Date range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-3 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none" />
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-3 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none" />
                </div>
              </div>
              <button onClick={handleGenerate}
                className="w-full h-11 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold hover:opacity-90 transition-opacity">
                Generate report
              </button>
            </div>
          </section>

          {generated && (
            <section>
              <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Summary</h3>
              <div className="space-y-2.5">
                {[
                  { val: summary.total, label: "Total items in stock", cls: "border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface", txt: "text-zinc-900 dark:text-zinc-50", sub: "text-zinc-400" },
                  { val: summary.low,   label: "Low stock items",      cls: "border-amber-100 dark:border-dark-border bg-amber-50 dark:bg-amber-900/20", txt: "text-amber-700 dark:text-amber-400", sub: "text-amber-500" },
                  { val: summary.out,   label: "Out of stock",         cls: "border-rose-100 dark:border-dark-border bg-rose-50 dark:bg-rose-900/20",   txt: "text-rose-700 dark:text-rose-400",   sub: "text-rose-500" },
                  { val: summary.value >= 1000 ? `₱${Math.round(summary.value / 1000)}k` : fmt(summary.value),
                    label: "Total stock value", cls: "border-indigo-100 dark:border-dark-border bg-indigo-50 dark:bg-indigo-900/20", txt: "text-indigo-700 dark:text-indigo-400", sub: "text-indigo-500" },
                ].map(({ val, label, cls, txt, sub }) => (
                  <div key={label} className={clsx("rounded-2xl border p-4", cls)}>
                    <p className={clsx("text-2xl font-black", txt)}>{val}</p>
                    <p className={clsx("text-[10px] font-black uppercase tracking-widest mt-0.5", sub)}>{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={handleReset}
                  className="flex-1 h-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-dark-card text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50">
                  Reset
                </button>
                <button onClick={() => window.print()}
                  className="flex-1 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2">
                  <FiDownload className="h-4 w-4" /> Export
                </button>
              </div>
            </section>
          )}
        </div>
      </aside>

      {/* Right: Generated report */}
      <div className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-950 p-6">
        {!generated ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <FiPackage className="mx-auto h-14 w-14 text-zinc-200 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Configure filters and click Generate report</p>
            </div>
          </div>
        ) : (
          <article className="mx-auto max-w-3xl rounded-2xl bg-white dark:bg-dark-card p-8 md:p-10 shadow-md border border-zinc-100 dark:border-dark-border">
            <header className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-50">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <FiPackage className="h-4 w-4" />
                  </span>
                  Inventory stock level report — {reportMonthLabel}
                </div>
                <p className="mt-1 text-xs text-zinc-400 uppercase tracking-widest">AutoVet Systems</p>
              </div>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Generated
              </span>
            </header>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-dark-border">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-dark-surface border-b border-zinc-200 dark:border-dark-border">
                  <tr>
                    {["Item", "Category", "Stock", "Unit value", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                  {reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30">
                      <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</td>
                      <td className="px-4 py-3 text-zinc-500">{item.category}</td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">{item.stock}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{fmt(item.unitValue)}</td>
                      <td className="px-4 py-3"><StockBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface">
                    <td colSpan={3} className="px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-500">Total stock value</td>
                    <td colSpan={2} className="px-4 py-3 text-base font-black text-zinc-900 dark:text-zinc-50">{fmt(summary.value)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function ReportsModuleView() {
  const toast = useToast();
  const { user } = useAuth();
  const { setLaravelErrors, clearErrors, getError } = useFormErrors();

  const [mainTab, setMainTab]   = useState("new");
  const [reportTab, setReportTab] = useState("transaction");

  // Form state
  const [items, setItems]                         = useState([]);
  const [owners, setOwners]                       = useState([]);
  const [pets, setPets]                           = useState([]);
  const [selectedOwnerId, setSelectedOwnerId]     = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [appointments, setAppointments]           = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [patientDetails, setPatientDetails]       = useState(null);
  const [notes, setNotes]                         = useState("");
  const [status, setStatus]                       = useState("Draft");
  const [reportId, setReportId]                   = useState(null);
  const [isPreviewMode, setIsPreviewMode]         = useState(false);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [reportDate, setReportDate]               = useState(new Date().toISOString().split("T")[0]);
  const [services, setServices]                   = useState([]);
  const [inventory, setInventory]                 = useState([]);
  const [serviceInput, setServiceInput]           = useState("");
  const [qtyInput, setQtyInput]                   = useState(1);
  const [isDropdownOpen, setIsDropdownOpen]       = useState(false);
  const [isApptDropdownOpen, setIsApptDropdownOpen] = useState(false);
  const [selectedService, setSelectedService]     = useState(null);

  // History state
  const [reports, setReports]           = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery]   = useState("");
  const [pagination, setPagination]     = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 10 });
  const [expandedReportId, setExpandedReportId] = useState(null);

  const REPORTS_CACHE_KEY  = "reports_history_cache";
  const FORM_DATA_CACHE_KEY = "reports_form_data_cache";
  const CACHE_TTL = 5 * 60 * 1000;

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.qty * (i.unit_price || 0), 0), [items]);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.token) return;
    try {
      const cached = JSON.parse(localStorage.getItem(FORM_DATA_CACHE_KEY) || "null");
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        if (Array.isArray(cached.owners))    setOwners(cached.owners);
        if (Array.isArray(cached.pets))      setPets(cached.pets);
        if (Array.isArray(cached.services))  setServices(cached.services);
        if (Array.isArray(cached.inventory)) setInventory(cached.inventory);
      }
    } catch (_) {}

    const controller = new AbortController();
    Promise.all([
      api.get("/api/owners",    { params: { minimal: 1, per_page: 1000 }, signal: controller.signal }).catch(() => ({})),
      api.get("/api/pets",      { params: { minimal: 1, per_page: 1000 }, signal: controller.signal }).catch(() => ({})),
      api.get("/api/services",  { signal: controller.signal }).catch(() => []),
      api.get("/api/inventory", { signal: controller.signal }).catch(() => []),
    ]).then(([o, p, s, inv]) => {
      const os  = Array.isArray(o)   ? o   : (o?.data   || []);
      const ps  = Array.isArray(p)   ? p   : (p?.data   || []);
      const ss  = Array.isArray(s)   ? s   : (s?.data   || s   || []);
      const is  = Array.isArray(inv) ? inv : (inv?.data || inv || []);
      setOwners(os); setPets(ps); setServices(ss); setInventory(is);
      try { localStorage.setItem(FORM_DATA_CACHE_KEY, JSON.stringify({ owners: os, pets: ps, services: ss, inventory: is, ts: Date.now() })); } catch (_) {}
    }).catch((err) => {
      if (err.name === "AbortError" || err.name === "CanceledError") return;
    });
    return () => controller.abort();
  }, [user?.token]);

  // ── History fetch ───────────────────────────────────────────────────────────

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
      const response = await fetch(`/api/invoices?${params}`, {
        signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch");
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

  useEffect(() => {
    if (mainTab === "history") fetchReports(1, searchQuery, null, true);
  }, [mainTab]);

  useEffect(() => {
    if (mainTab !== "history") return;
    const controller = new AbortController();
    const handler = setTimeout(() => fetchReports(1, searchQuery, controller.signal), 500);
    return () => { clearTimeout(handler); controller.abort(); };
  }, [searchQuery]);

  // ── Form handlers ───────────────────────────────────────────────────────────

  const filteredAppointments = useMemo(() => {
    const active = appointments.filter((a) => !["cancelled", "declined", "Cancelled", "Declined"].includes(a.status));
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
    const filteredSvcs = (Array.isArray(services) ? services : [])
      .filter((s) => s.name.toLowerCase().includes(term) || (s.category && s.category.toLowerCase().includes(term)))
      .map((s) => ({ ...s, type: "service" }));
    const filteredInv = (Array.isArray(inventory) ? inventory : [])
      .filter((i) => (i.item_name || "").toLowerCase().includes(term) || (i.sku || "").toLowerCase().includes(term))
      .map((i) => ({ ...i, name: i.item_name, sku: i.sku || i.code || "N/A", stock: i.stock_level || 0, type: "inventory" }));
    return [...filteredSvcs, ...filteredInv].reduce((acc, item) => {
      const cat = item.type === "service" ? (item.category || "Services") : (getCatName(item) || "Inventory Products");
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
    const matchInv = inventory.find((i) => (i.item_name || "").toLowerCase() === e.target.value.toLowerCase());
    if (matchInv) { setSelectedService({ ...matchInv, name: matchInv.item_name, type: "inventory" }); return; }
    setSelectedService(null);
  };

  const addItem = () => {
    if (!serviceInput) return;
    const qty       = Number(qtyInput) || 1;
    const itemType  = selectedService?.type || "service";
    const unitPrice = itemType === "service"
      ? (selectedService?.price || selectedService?.unit_price || 0)
      : (selectedService?.selling_price || selectedService?.price || 0);
    const newItem = {
      id: `li-${Date.now()}`,
      name: serviceInput,
      sku: selectedService?.sku || selectedService?.code || "",
      item_type: itemType,
      service_id:   itemType === "service"   ? selectedService?.id : null,
      inventory_id: itemType === "inventory" ? selectedService?.id : null,
      notes: itemType === "inventory" ? "Inventory Item" : "Clinical Service",
      category: selectedService?.category || getCatName(selectedService || {}),
      inventory_category: selectedService?.inventory_category,
      qty,
      unit_price: unitPrice,
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
    const total = subtotal;
    const payload = {
      pet_id: selectedPatientId,
      appointment_id: selectedAppointmentId,
      status: finalStatus,
      subtotal: total,
      discount_type: "fixed", discount_value: 0, tax_rate: 0,
      total, amount_paid: 0,
      notes_to_client: notes,
      items: items.map((item) => ({
        item_type: item.item_type || "service",
        service_id: item.service_id,
        inventory_id: item.inventory_id,
        name: item.name,
        notes: item.notes,
        qty: item.qty,
        unit_price: item.unit_price || 0,
        amount: item.qty * (item.unit_price || 0),
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

  const handleViewReportDetails = useCallback(async (rep) => {
    if (!rep?.id) return;
    try {
      setHistoryLoading(true);
      const full = await api.get(`/api/invoices/${rep.id}`);
      const mappedItems = (full.items || []).map((i) => ({
        ...i,
        id: i.id,
        unit_price: i.unit_price || 0,
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
      setMainTab("new");
      setReportTab("transaction");
      setIsPreviewMode(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error("Failed to load report details.");
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  // ── Pagination ──────────────────────────────────────────────────────────────

  const Pagination = () => {
    if (pagination.lastPage <= 1) return null;
    return (
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 py-4 mb-6 dark:border-dark-border dark:bg-dark-card shadow-sm">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Showing <span className="text-zinc-900 dark:text-zinc-50">{Math.min((pagination.currentPage - 1) * pagination.perPage + 1, pagination.total)}–{Math.min(pagination.currentPage * pagination.perPage, pagination.total)}</span> of <span className="text-zinc-900 dark:text-zinc-50">{pagination.total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchReports(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card">
            <FiChevronLeft className="h-5 w-5" />
          </button>
          {[...Array(pagination.lastPage)].map((_, i) => {
            const p = i + 1;
            if (pagination.lastPage > 7 && p !== 1 && p !== pagination.lastPage && (p < pagination.currentPage - 1 || p > pagination.currentPage + 1)) {
              if (p === pagination.currentPage - 2 || p === pagination.currentPage + 2) return <span key={p} className="px-1 text-zinc-400">...</span>;
              return null;
            }
            return (
              <button key={p} onClick={() => fetchReports(p)}
                className={clsx("flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black transition-all",
                  pagination.currentPage === p ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30" : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card")}>
                {p}
              </button>
            );
          })}
          <button onClick={() => fetchReports(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.lastPage}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card">
            <FiChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-dark-border">

      {/* ── Sidebar nav ── */}
      <aside className="w-52 shrink-0 border-r border-zinc-200 dark:border-dark-border flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-dark-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Reports</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: "new",     label: "New report",     Icon: FiFileText  },
            { id: "history", label: "Report history", Icon: FiClipboard },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setMainTab(id)}
              className={clsx("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all text-left",
                mainTab === id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-dark-surface")}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-200 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-[10px] font-black text-white dark:text-zinc-900 shrink-0">
              {(user?.name || "AD").substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50 truncate">{user?.name || "Administrator"}</p>
              <p className="text-[10px] text-zinc-400 truncate">Clinic Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ──── NEW REPORT ──── */}
        {mainTab === "new" && (
          <>
            {/* Header */}
            <div className="shrink-0 border-b border-zinc-200 dark:border-dark-border px-6 py-4 bg-white dark:bg-dark-card">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Reports › New report</p>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">New report</h1>
                  <span className={clsx("rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest",
                    status === "Finalized" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                    {status}
                  </span>
                </div>
                {reportTab === "transaction" && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsPreviewMode(!isPreviewMode)}
                      className={clsx("flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors border",
                        isPreviewMode ? "bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-50"
                          : "border-zinc-200 dark:border-dark-border text-zinc-500 hover:bg-zinc-50 dark:hover:bg-dark-surface")}>
                      <FiEye className="h-3.5 w-3.5" /> Preview
                    </button>
                    <button onClick={() => window.print()}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-dark-border text-xs font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                      <FiDownload className="h-3.5 w-3.5" /> Export PDF
                    </button>
                    <button onClick={() => submitReport("Finalized")} disabled={status === "Finalized"}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-md transition-all">
                      <FiSend className="h-3.5 w-3.5" /> Complete report
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="shrink-0 flex items-center gap-1 border-b border-zinc-200 dark:border-dark-border px-6 py-2.5 bg-zinc-50/50 dark:bg-dark-surface/30">
              {[
                { id: "transaction", label: "Transaction report" },
                { id: "inventory",   label: "Inventory report"   },
              ].map((t) => (
                <button key={t.id} onClick={() => setReportTab(t.id)}
                  className={clsx("px-4 py-2 rounded-xl text-sm font-bold transition-all",
                    reportTab === t.id
                      ? "bg-white dark:bg-dark-card text-zinc-900 dark:text-zinc-50 shadow-sm border border-zinc-200 dark:border-dark-border"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Transaction report ── */}
            {reportTab === "transaction" && (
              <div className="flex flex-1 overflow-hidden">

                {/* Left: Form */}
                {!isPreviewMode && (
                  <aside className="w-[400px] shrink-0 flex flex-col overflow-hidden border-r border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card">
                    <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">

                      {/* Patient details */}
                      <section>
                        <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Patient details</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Owner</label>
                            <div className="relative">
                              <select value={selectedOwnerId} onChange={(e) => {
                                const oId = e.target.value;
                                setSelectedOwnerId(oId); setSelectedPatientId(""); setPatientDetails(null); setAppointments([]);
                                if (oId) {
                                  const op = (Array.isArray(pets) ? pets : []).filter((p) => p.owner_id?.toString() === oId);
                                  if (op.length === 1) handlePatientSelect({ target: { value: op[0].id.toString() } });
                                }
                              }} className="h-11 w-full appearance-none rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-4 pr-8 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none" disabled={status === "Finalized"}>
                                <option value="">Select an owner...</option>
                                {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                              </select>
                              <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Pet</label>
                            <div className="relative">
                              <select value={selectedPatientId} onChange={handlePatientSelect} disabled={!selectedOwnerId || status === "Finalized"}
                                className={clsx("h-11 w-full appearance-none rounded-xl border pl-4 pr-8 text-sm focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                                  getError("pet_id") ? "border-rose-500" : "border-zinc-200 dark:border-dark-border bg-zinc-50")}>
                                <option value="">Select a pet...</option>
                                {(Array.isArray(pets) ? pets : []).filter((p) => p.owner_id?.toString() === selectedOwnerId?.toString()).map((p) => (
                                  <option key={p.id} value={p.id}>{p.name} ({p.species?.name || "Unknown"}, {p.breed?.name || "—"})</option>
                                ))}
                              </select>
                              <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                              {getError("pet_id") && <p className="mt-1 text-xs text-rose-500">{getError("pet_id")}</p>}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Appointment</label>
                            <div className="relative">
                              <button type="button" onClick={() => setIsApptDropdownOpen(!isApptDropdownOpen)}
                                disabled={!selectedPatientId || status === "Finalized"}
                                className={clsx("flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                                  isApptDropdownOpen ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-zinc-200 dark:border-dark-border bg-zinc-50")}>
                                <div className="flex items-center gap-2 truncate">
                                  <FiCalendar className="h-4 w-4 shrink-0 text-zinc-400" />
                                  <span className={clsx("truncate text-left", !selectedAppointmentId && "text-zinc-400")}>
                                    {selectedAppointmentId
                                      ? (() => { const a = appointments.find((x) => x.id.toString() === selectedAppointmentId); return a ? `${formatDate(a.date)} — ${a.title || a.service?.name}` : "Selected"; })()
                                      : "Choose an appointment..."}
                                  </span>
                                </div>
                                <FiChevronDown className={clsx("h-4 w-4 text-zinc-400 transition-transform shrink-0", isApptDropdownOpen && "rotate-180")} />
                              </button>
                              {isApptDropdownOpen && (
                                <div className="absolute left-0 top-full z-[60] mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-dark-border dark:bg-dark-card">
                                  <div className="p-2 border-b border-zinc-100 dark:border-dark-border">
                                    <div className="relative">
                                      <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                      <input type="text" placeholder="Search date or title..." value={appointmentSearch}
                                        onChange={(e) => setAppointmentSearch(e.target.value)} autoFocus
                                        className="h-9 w-full rounded-lg border border-zinc-100 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300" />
                                    </div>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto divide-y divide-zinc-50 dark:divide-dark-surface">
                                    {filteredAppointments.length > 0 ? filteredAppointments.slice(0, 50).map((appt) => (
                                      <button key={appt.id} type="button"
                                        onClick={() => { setSelectedAppointmentId(appt.id.toString()); setIsApptDropdownOpen(false); setAppointmentSearch(""); }}
                                        className={clsx("w-full px-4 py-2.5 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-dark-surface",
                                          selectedAppointmentId === appt.id.toString() ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 font-bold" : "text-zinc-600 dark:text-zinc-400")}>
                                        <div className="flex justify-between"><span>{formatDate(appt.date)}</span><span className="opacity-60">{appt.time?.substring(0, 5)}</span></div>
                                        <div className="truncate opacity-80">{appt.title || appt.service?.name}</div>
                                      </button>
                                    )) : <div className="px-4 py-8 text-center text-[10px] text-zinc-400 uppercase font-bold">No appointments found</div>}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Services & items */}
                      <section>
                        <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Services &amp; items rendered</h3>
                        <div className="grid grid-cols-[1fr_54px_auto] gap-2 items-center">
                          <div className="relative">
                            <input type="text" placeholder="Search or type service..." value={serviceInput}
                              onChange={handleServiceChange} onFocus={() => setIsDropdownOpen(true)}
                              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); setIsDropdownOpen(false); } }}
                              disabled={status === "Finalized"}
                              className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-8 text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 disabled:opacity-50" />
                            {serviceInput && (
                              <button onClick={() => { setServiceInput(""); setSelectedService(null); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:bg-zinc-100">
                                <FiX className="h-4 w-4" />
                              </button>
                            )}
                            {isDropdownOpen && (
                              <div className="absolute left-0 top-full mt-1 max-h-[360px] w-[480px] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-3 shadow-2xl z-[100]">
                                {Object.keys(groupedItems).length > 0 ? Object.entries(groupedItems).map(([cat, svcs]) => (
                                  <div key={cat} className="mb-4 last:mb-0">
                                    <div className="flex items-center gap-2 mb-2 px-2">
                                      <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{cat}</span>
                                    </div>
                                    <ul className="space-y-1">
                                      {svcs.map((item) => (
                                        <li key={`${item.type}-${item.id}`}>
                                          <button type="button" onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => selectItemFromDropdown(item)}
                                            className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-dark-surface border border-transparent hover:border-zinc-100">
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-[10px] uppercase",
                                                item.type === "inventory" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                                                {item.type === "inventory" ? "ITEM" : "SRVC"}
                                              </div>
                                              <div className="min-w-0">
                                                <p className="truncate font-bold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                  {item.sku && item.sku !== "N/A" && <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{item.sku}</span>}
                                                  {item.type === "inventory" && (
                                                    <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded", item.stock > 10 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50")}>
                                                      Stock: {item.stock}
                                                    </span>
                                                  )}
                                                  {(item.price || item.selling_price) > 0 && (
                                                    <span className="text-[10px] font-bold text-zinc-500">{fmt(item.price || item.selling_price)}</span>
                                                  )}
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
                                {serviceInput && !services.find((s) => s.name.toLowerCase() === serviceInput.toLowerCase()) && !inventory.find((i) => (i.item_name || "").toLowerCase() === serviceInput.toLowerCase()) && (
                                  <div className="mt-3 border-t border-zinc-100 dark:border-dark-border pt-4">
                                    <button type="button" onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => { addItem(); setIsDropdownOpen(false); }}
                                      className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:opacity-90">
                                      <FiPlusCircle className="w-4 h-4" /> Add "{serviceInput}"
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <input type="number" min="1" value={qtyInput} onChange={(e) => setQtyInput(e.target.value)}
                            disabled={status === "Finalized"} placeholder="Qty"
                            className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-center text-sm disabled:opacity-50" />
                          <button type="button" onClick={() => { addItem(); setIsDropdownOpen(false); }}
                            disabled={!serviceInput || status === "Finalized"}
                            className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
                            Add
                          </button>
                        </div>

                        {/* Items list */}
                        <div className="mt-4 space-y-2">
                          {items.length > 0 ? items.map((item) => (
                            <div key={item.id} className="group flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-4 py-3">
                              <span className={clsx("text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0",
                                item.item_type === "inventory" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                                {getShortType(item)}
                              </span>
                              <span className="flex-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{item.name}</span>
                              <span className="text-xs text-zinc-400 shrink-0">x{item.qty}</span>
                              {item.unit_price > 0 && (
                                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 shrink-0">{fmt(item.qty * item.unit_price)}</span>
                              )}
                              {status === "Draft" && (
                                <button onClick={() => removeItem(item.id)}
                                  className="p-1 rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 shrink-0">
                                  <FiX className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )) : (
                            <div className="py-10 flex flex-col items-center justify-center text-center opacity-50">
                              <LuPawPrint className="h-8 w-8 text-zinc-300 mb-2" />
                              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No items added yet</p>
                            </div>
                          )}
                        </div>

                        {/* Subtotal */}
                        {items.length > 0 && (
                          <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3">
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Subtotal</span>
                            <span className="text-base font-black text-zinc-900 dark:text-zinc-50">{fmt(subtotal)}</span>
                          </div>
                        )}
                      </section>

                      {/* Notes */}
                      <section>
                        <h3 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Clinical notes</h3>
                        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={status === "Finalized"}
                          placeholder="Clinical notes or observations..."
                          className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 disabled:opacity-50 focus:outline-none resize-none" />
                      </section>
                    </div>

                    {/* Form actions */}
                    <div className="shrink-0 border-t border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={resetForm}
                          className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-dark-card px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 transition-colors">
                          Reset
                        </button>
                        <button onClick={() => submitReport("Draft")} disabled={status !== "Draft"}
                          className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-50 hover:bg-emerald-100 transition-colors">
                          Save draft
                        </button>
                      </div>
                    </div>
                  </aside>
                )}

                {/* Right: Clinical report preview */}
                <div className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-950 p-6">
                  <article className="mx-auto max-w-3xl rounded-2xl bg-white dark:bg-dark-card p-8 md:p-12 shadow-md border border-zinc-100 dark:border-dark-border">
                    <header className="flex items-start justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                            <LuPawPrint className="h-4 w-4" />
                          </span>
                          Clinical Report
                        </div>
                        <p className="mt-1 text-xs text-zinc-400 uppercase tracking-widest">AutoVet Systems</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-light tracking-wide text-zinc-200 dark:text-zinc-700">REPORT</p>
                        <p className="mt-1 text-sm text-zinc-500">Date: {reportDate}</p>
                        <span className={clsx("mt-1 inline-block rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest",
                          status === "Finalized" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                          {status}
                        </span>
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
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Patient</p>
                        {patientDetails ? (
                          <div className="mt-2">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{patientDetails.name}</p>
                            <p className="text-xs text-zinc-500">{patientDetails?.species?.name || "—"} — {patientDetails?.breed?.name || "—"}</p>
                            {selectedAppointmentId && (() => {
                              const a = appointments.find((x) => x.id.toString() === selectedAppointmentId);
                              return a ? <p className="mt-1 text-xs text-zinc-400">{formatDate(a.date)} — {a.title || a.service?.name}</p> : null;
                            })()}
                          </div>
                        ) : <p className="mt-2 text-xs text-zinc-400 italic">No patient selected</p>}
                      </div>
                    </section>

                    <section className="mt-8">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Services &amp; items rendered</p>
                      {items.filter((i) => !i.is_hidden).length > 0 ? (
                        <div className="rounded-xl border border-zinc-200 dark:border-dark-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-zinc-50 dark:bg-dark-surface border-b border-zinc-200 dark:border-dark-border">
                              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                <th className="px-4 py-3">Item</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3 text-center">Qty</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                              {items.filter((i) => !i.is_hidden).map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30">
                                  <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</td>
                                  <td className="px-4 py-3">
                                    <span className={clsx("text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                      item.item_type === "inventory" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                                      {getShortType(item)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-zinc-700 dark:text-zinc-300">{item.qty}</td>
                                  <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                                    {item.unit_price > 0 ? fmt(item.qty * item.unit_price) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface">
                                <td colSpan={3} className="px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-500">Total</td>
                                <td className="px-4 py-3 text-right text-base font-black text-zinc-900 dark:text-zinc-50">{fmt(subtotal)}</td>
                              </tr>
                            </tfoot>
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
              </div>
            )}

            {/* ── Inventory report ── */}
            {reportTab === "inventory" && (
              <InventoryReportPane inventory={inventory} />
            )}
          </>
        )}

        {/* ──── HISTORY ──── */}
        {mainTab === "history" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by patient or report..."
                  className="h-11 w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-10 pr-4 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none" />
              </div>
            </div>
            <Pagination />
            {historyLoading ? (
              <div className="py-20 text-center text-zinc-400 font-bold uppercase tracking-widest animate-pulse">Loading reports...</div>
            ) : reports.length > 0 ? (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div key={rep.id} className="rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-dark-surface/40 transition-colors"
                      onClick={() => setExpandedReportId(expandedReportId === rep.id ? null : rep.id)}>
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
                          <FiClipboard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{rep.pet?.name || "—"}</p>
                          <p className="text-xs text-zinc-500">{formatDate(rep.created_at)} · {rep.appointment ? (rep.appointment.title || rep.appointment.service?.name || "Appointment") : "No appointment"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={clsx("text-[10px] font-black uppercase px-2 py-1 rounded-full",
                          rep.status === "Finalized" || rep.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                          {rep.status}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); handleViewReportDetails(rep); }}
                          className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 underline underline-offset-4">
                          Edit
                        </button>
                      </div>
                    </div>
                    {expandedReportId === rep.id && (
                      <div className="border-t border-zinc-100 dark:border-dark-border px-5 py-4 bg-zinc-50/50 dark:bg-dark-surface/20">
                        {rep.items && rep.items.filter((i) => !i.is_hidden).length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Items Rendered</p>
                            {rep.items.filter((i) => !i.is_hidden).map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={clsx("text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                    item.item_type === "inventory" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                                    {getShortType(item)}
                                  </span>
                                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.name}</span>
                                </div>
                                <span className="font-bold text-zinc-500">Qty: {item.qty}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-zinc-400 italic">No items on this report.</p>}
                        {rep.notes_to_client && (
                          <p className="mt-3 text-xs text-zinc-500 italic border-t border-zinc-100 dark:border-dark-border pt-3">"{rep.notes_to_client}"</p>
                        )}
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
    </div>
  );
}

export default ReportsModuleView;
