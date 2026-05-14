import { useMemo, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  FiChevronDown, FiChevronLeft, FiChevronRight, FiClipboard,
  FiFileText, FiPackage, FiPlusCircle, FiSearch, FiSend, FiX,
  FiDownload, FiCalendar, FiEye,
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

// Derive short category code — matches prototype: Med/Vac/Food/Sup
const getShortType = (item) => {
  const cat = (item.category || item.inventory_category?.name || "").toLowerCase();
  const nm  = (item.name || item.item_name || "").toLowerCase();
  if (/vac/i.test(cat) || /vaccine/i.test(nm))          return "Vac";
  if (/med|drug|pharma|antibiotic/i.test(cat))           return "Med";
  if (/food|feed/i.test(cat))                            return "Food";
  return "Sup"; // services and generic supplies
};

// Category badge — colours from prototype (Med=blue, Vac=purple, Sup=green, Food=amber)
function CatBadge({ type, size = "sm" }) {
  const base = size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";
  const map = {
    Med:  "bg-blue-950/80 text-blue-400 dark:bg-blue-950/60",
    Vac:  "bg-purple-950/80 text-purple-400 dark:bg-purple-950/60",
    Sup:  "bg-emerald-950/80 text-emerald-400 dark:bg-emerald-950/60",
    Food: "bg-amber-950/80 text-amber-400 dark:bg-amber-950/60",
  };
  return (
    <span className={clsx("rounded font-bold uppercase tracking-wide shrink-0", base, map[type] ?? map.Sup)}>
      {type}
    </span>
  );
}

// Stock status pill — OK/Low/Out
function StockPill({ status }) {
  const map = {
    OK:  "bg-emerald-950/80 text-emerald-400",
    Low: "bg-amber-950/80 text-amber-400",
    Out: "bg-rose-950/80 text-rose-400",
  };
  return (
    <span className={clsx("rounded px-2 py-0.5 text-[10px] font-bold", map[status] ?? map.OK)}>
      {status}
    </span>
  );
}

const getCatName = (item) =>
  item.inventory_category?.name || item.category || "Uncategorized";

// ─── Inventory Report (right panel + left filters) ────────────────────────────

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
    let src = inventory;
    if (reportType === "low_stock") {
      src = src.filter((i) => Number(i.stock_level) <= Number(i.min_stock_level || 0));
    }
    if (selectedCategory !== "all") {
      src = src.filter((i) => (i.inventory_category_id?.toString() || "0") === selectedCategory);
    }
    const mapped = src.map((i) => ({
      id: i.id,
      name: i.item_name || i.name,
      category: getCatName(i),
      shortType: getShortType({ ...i, name: i.item_name }),
      stock: Number(i.stock_level) || 0,
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
    low:   reportData.filter((i) => i.status === "Low").length,
    out:   reportData.filter((i) => i.status === "Out").length,
    value: reportData.reduce((s, i) => s + i.totalValue, 0),
  }), [reportData]);

  const reportMonthLabel = useMemo(() =>
    new Date((dateFrom || new Date().toISOString().split("T")[0]) + "T00:00:00")
      .toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  [dateFrom]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>

      {/* Left: filters + summary */}
      <div className="flex flex-col gap-4">

        {/* Filters panel */}
        <div className="card-shell p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Report filters</p>

          <div className="space-y-1">
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">Report type</label>
            <div className="relative">
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                className="h-9 w-full appearance-none rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-8 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none">
                <option value="stock_level">Stock level summary</option>
                <option value="low_stock">Low stock alerts</option>
                <option value="valuation">Stock valuation</option>
                <option value="category">Category breakdown</option>
              </select>
              <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">Category</label>
            <div className="relative">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 w-full appearance-none rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-8 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none">
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">Date range</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none" />
            </div>
          </div>

          <button onClick={handleGenerate}
            className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors mt-1">
            Generate report
          </button>
        </div>

        {/* Summary panel — shows after generate */}
        {generated && (
          <div className="card-shell p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Summary</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { val: summary.total, label: "Total items in stock", cls: "text-emerald-500" },
                { val: summary.low,   label: "Low stock items",      cls: "text-amber-500"   },
                { val: summary.out,   label: "Out of stock",         cls: "text-rose-500"    },
                { val: summary.value >= 1000 ? `₱${Math.round(summary.value / 1000)}k` : fmt(summary.value),
                  label: "Total stock value", cls: "text-blue-400" },
              ].map(({ val, label, cls }) => (
                <div key={label} className="rounded-lg border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-3">
                  <p className={clsx("text-lg font-black", cls)}>{val}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleReset}
                className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                Reset
              </button>
              <button onClick={() => window.print()}
                className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-dark-surface flex items-center justify-center gap-1.5 transition-colors">
                <FiDownload className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: generated report table */}
      <div className="card-shell p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Inventory stock level report — {reportMonthLabel}
          </p>
          {generated && (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Generated
            </span>
          )}
        </div>

        {!generated ? (
          <div className="flex h-48 items-center justify-center text-center">
            <div>
              <FiPackage className="mx-auto h-10 w-10 text-zinc-200 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Set filters and click Generate report</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-zinc-100 dark:border-dark-border">
              <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                <thead className="bg-zinc-50 dark:bg-dark-surface border-b border-zinc-200 dark:border-dark-border">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-400" style={{ width: "35%" }}>Item</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-400" style={{ width: "18%" }}>Category</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-zinc-400" style={{ width: "14%" }}>Stock</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-zinc-400" style={{ width: "18%" }}>Unit value</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-zinc-400" style={{ width: "15%" }}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                  {reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30">
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.name}</td>
                      <td className="px-3 py-2"><CatBadge type={item.shortType} size="xs" /></td>
                      <td className={clsx("px-3 py-2 text-right font-bold",
                        item.status === "Out" ? "text-rose-500" : item.status === "Low" ? "text-amber-500" : "text-emerald-500")}>
                        {item.stock}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500 dark:text-zinc-400">{fmt(item.unitValue)}</td>
                      <td className="px-3 py-2 text-center"><StockPill status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-6 mt-3 pt-3 border-t border-zinc-100 dark:border-dark-border text-xs">
              <span className="text-zinc-400">Total stock value</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{fmt(summary.value)}</span>
            </div>
          </>
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

  // "new" | "history"
  const [mainTab, setMainTab]     = useState("new");
  // "transaction" | "inventory"
  const [reportSection, setReportSection] = useState("transaction");

  // ── Transaction form state ──────────────────────────────────────────────────
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
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [reportDate, setReportDate]               = useState(new Date().toISOString().split("T")[0]);
  const [services, setServices]                   = useState([]);
  const [inventory, setInventory]                 = useState([]);
  const [serviceInput, setServiceInput]           = useState("");
  const [qtyInput, setQtyInput]                   = useState(1);
  const [isDropdownOpen, setIsDropdownOpen]       = useState(false);
  const [isApptDropdownOpen, setIsApptDropdownOpen] = useState(false);
  const [selectedService, setSelectedService]     = useState(null);

  // ── History state ───────────────────────────────────────────────────────────
  const [reports, setReports]         = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination]   = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 10 });
  const [expandedReportId, setExpandedReportId] = useState(null);

  const REPORTS_CACHE_KEY   = "reports_history_cache";
  const FORM_DATA_CACHE_KEY = "reports_form_data_cache";
  const CACHE_TTL = 5 * 60 * 1000;

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.qty * (i.unit_price || 0), 0),
    [items]
  );

  // ── Load form data ──────────────────────────────────────────────────────────

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

    const ctrl = new AbortController();
    Promise.all([
      api.get("/api/owners",    { params: { minimal: 1, per_page: 1000 }, signal: ctrl.signal }).catch(() => ({})),
      api.get("/api/pets",      { params: { minimal: 1, per_page: 1000 }, signal: ctrl.signal }).catch(() => ({})),
      api.get("/api/services",  { signal: ctrl.signal }).catch(() => []),
      api.get("/api/inventory", { signal: ctrl.signal }).catch(() => []),
    ]).then(([o, p, s, inv]) => {
      const os  = Array.isArray(o)   ? o   : (o?.data   || []);
      const ps  = Array.isArray(p)   ? p   : (p?.data   || []);
      const ss  = Array.isArray(s)   ? s   : (s?.data   || s   || []);
      const is_ = Array.isArray(inv) ? inv : (inv?.data || inv || []);
      setOwners(os); setPets(ps); setServices(ss); setInventory(is_);
      try { localStorage.setItem(FORM_DATA_CACHE_KEY, JSON.stringify({ owners: os, pets: ps, services: ss, inventory: is_, ts: Date.now() })); } catch (_) {}
    }).catch((err) => { if (err.name !== "AbortError" && err.name !== "CanceledError") {} });
    return () => ctrl.abort();
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
      const res = await fetch(`/api/invoices?${params}`, {
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

  // ── Form handlers ───────────────────────────────────────────────────────────

  const filteredAppts = useMemo(() => {
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
    const svcs = (Array.isArray(services) ? services : [])
      .filter((s) => s.name.toLowerCase().includes(term) || (s.category || "").toLowerCase().includes(term))
      .map((s) => ({ ...s, type: "service" }));
    const invs = (Array.isArray(inventory) ? inventory : [])
      .filter((i) => (i.item_name || "").toLowerCase().includes(term) || (i.sku || "").toLowerCase().includes(term))
      .map((i) => ({ ...i, name: i.item_name, sku: i.sku || i.code || "N/A", stock: i.stock_level || 0, type: "inventory" }));
    return [...svcs, ...invs].reduce((acc, item) => {
      const cat = item.type === "service" ? (item.category || "Services") : (getCatName(item) || "Inventory Products");
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [services, inventory, serviceInput]);

  const selectItem = (item) => { setServiceInput(item.name); setSelectedService(item); setIsDropdownOpen(false); };

  const handleServiceChange = (e) => {
    setServiceInput(e.target.value);
    setIsDropdownOpen(true);
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
    setReportId(null); setReportDate(new Date().toISOString().split("T")[0]);
  };

  const submitReport = async (finalStatus) => {
    if (items.length === 0)     { toast.error("Cannot save a report without items."); return; }
    if (!selectedPatientId)     { toast.error("Please select a patient."); return; }
    if (!selectedAppointmentId) { toast.error("Please select an appointment."); return; }

    // If updating an existing draft, use PUT; otherwise create with POST
    const isUpdate = !!reportId;
    const url    = isUpdate ? `/api/invoices/${reportId}` : "/api/invoices";
    const method = isUpdate ? "PUT" : "POST";

    const payload = {
      pet_id: selectedPatientId,
      appointment_id: selectedAppointmentId,
      status: finalStatus,
      subtotal, discount_type: "fixed", discount_value: 0, tax_rate: 0,
      total: subtotal, amount_paid: 0, notes_to_client: notes,
      items: items.map((item) => ({
        // Include DB id for existing items so the backend updates rather than duplicates
        ...(item.id && !String(item.id).startsWith("li-") ? { id: item.id } : {}),
        item_type: item.item_type || "service",
        service_id: item.service_id, inventory_id: item.inventory_id,
        name: item.name, notes: item.notes, qty: item.qty,
        unit_price: item.unit_price || 0,
        amount: item.qty * (item.unit_price || 0),
        is_hidden: false,
      })),
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      clearErrors();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 422) {
          setLaravelErrors(err);
          // Surface the most useful message from Laravel validation errors
          const firstMsg = err.errors ? Object.values(err.errors)[0]?.[0] : (err.message || "Validation error.");
          toast.error(firstMsg);
        } else {
          toast.error(err.message || "Failed to save report");
        }
        return;
      }

      const data = await res.json();
      localStorage.removeItem(REPORTS_CACHE_KEY);
      window.dispatchEvent(new CustomEvent("inventory-forecast-refresh"));

      if (finalStatus === "Draft") {
        // Capture the ID so future saves update the same record
        setReportId(data.id);
        setStatus(data.status || "Draft");
        toast.success("Report saved as draft.");
      } else {
        // Finalized — go straight to history so the user can see the new record
        toast.success("Report completed. Stock deducted and AI data updated.");
        resetForm();
        setMainTab("history");
        fetchReports(1, "", null, true);
      }
    } catch (err) { toast.error(err.message || "Failed to save report"); }
  };

  const handleViewReportDetails = useCallback(async (rep) => {
    if (!rep?.id) return;
    try {
      setHistoryLoading(true);
      const full = await api.get(`/api/invoices/${rep.id}`);
      setItems((full.items || []).map((i) => ({ ...i, unit_price: i.unit_price || 0 })));
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
      setMainTab("new"); setReportSection("transaction");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { toast.error("Failed to load report details."); }
    finally { setHistoryLoading(false); }
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-dark-border">

      {/* Tab bar — New report | Report history */}
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

          {/* Report header */}
          <div className="shrink-0 px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-dark-border">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Reports › New report</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50">New report</h1>
                <span className={clsx("rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border",
                  status === "Finalized"
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                    : "bg-amber-950/60 text-amber-400 border-amber-800")}>
                  {status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                  <FiEye className="h-3.5 w-3.5" /> Preview
                </button>
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                  <FiDownload className="h-3.5 w-3.5" /> Export PDF
                </button>
                <button onClick={() => submitReport("Finalized")} disabled={status === "Finalized"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  <FiSend className="h-3.5 w-3.5" /> Complete report
                </button>
              </div>
            </div>

            {/* Section toggle */}
            <div className="flex items-center gap-2 mt-3">
              {[
                { id: "transaction", label: "Transaction report", Icon: FiFileText },
                { id: "inventory",   label: "Inventory report",   Icon: FiPackage  },
              ].map(({ id, label, Icon }) => (
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

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* ── Transaction report ── */}
            {reportSection === "transaction" && (
              <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>

                {/* Left: stacked form panels */}
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
                              const op = (Array.isArray(pets) ? pets : []).filter((p) => p.owner_id?.toString() === oId);
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
                            className={clsx("h-9 w-full appearance-none rounded-lg border pl-3 pr-8 text-xs focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                              getError("pet_id") ? "border-rose-500" : "border-zinc-200 dark:border-dark-border bg-zinc-50")}>
                            <option value="">Select a pet...</option>
                            {(Array.isArray(pets) ? pets : [])
                              .filter((p) => p.owner_id?.toString() === selectedOwnerId?.toString())
                              .map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species?.name || "Unknown"}, {p.breed?.name || "—"})</option>)}
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Services &amp; items rendered</p>

                    {/* Add row */}
                    <div className="flex gap-2 mb-3">
                      <div className="relative flex-1">
                        <input type="text" placeholder="Search or type service..." value={serviceInput}
                          onChange={handleServiceChange} onFocus={() => setIsDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); setIsDropdownOpen(false); } }}
                          disabled={status === "Finalized"}
                          className="h-9 w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-3 pr-7 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 disabled:opacity-50 focus:outline-none" />
                        {serviceInput && (
                          <button onClick={() => { setServiceInput(""); setSelectedService(null); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                            <FiX className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1 max-h-72 w-[460px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-2.5 shadow-2xl z-[100]">
                            {Object.keys(groupedItems).length > 0 ? Object.entries(groupedItems).map(([cat, svcs]) => (
                              <div key={cat} className="mb-3 last:mb-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-1.5">{cat}</p>
                                {svcs.map((item) => (
                                  <button key={`${item.type}-${item.id}`} type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectItem(item)}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-dark-surface">
                                    <div className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-black uppercase",
                                      item.type === "inventory" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                                      {item.type === "inventory" ? "ITEM" : "SVC"}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {item.sku && item.sku !== "N/A" && <span className="text-[9px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{item.sku}</span>}
                                        {item.type === "inventory" && <span className={clsx("text-[9px] font-bold", item.stock > 5 ? "text-emerald-500" : "text-rose-500")}>Stock: {item.stock}</span>}
                                        {(item.price || item.selling_price) > 0 && <span className="text-[9px] text-zinc-400">{fmt(item.price || item.selling_price)}</span>}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )) : (
                              <div className="py-8 text-center text-xs text-zinc-400">No matching items</div>
                            )}
                            {serviceInput && !services.find((s) => s.name.toLowerCase() === serviceInput.toLowerCase()) && !inventory.find((i) => (i.item_name || "").toLowerCase() === serviceInput.toLowerCase()) && (
                              <div className="border-t border-zinc-100 dark:border-dark-border pt-2 mt-2">
                                <button type="button" onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { addItem(); setIsDropdownOpen(false); }}
                                  className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:opacity-90">
                                  <FiPlusCircle className="h-3.5 w-3.5" /> Add "{serviceInput}"
                                </button>
                              </div>
                            )}
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

                    {/* Item rows */}
                    {items.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center opacity-40">
                        <LuPawPrint className="h-7 w-7 text-zinc-300 mb-1.5" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">No items added yet</p>
                      </div>
                    ) : (
                      <>
                        {items.map((item) => (
                          <div key={item.id}
                            className="group flex items-center gap-2 py-2 border-b border-zinc-100 dark:border-dark-border last:border-0">
                            <CatBadge type={getShortType(item)} size="xs" />
                            <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300 truncate">{item.name}</span>
                            <span className="text-[11px] text-zinc-400 shrink-0">x{item.qty}</span>
                            {item.unit_price > 0 && (
                              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 w-16 text-right shrink-0">
                                {fmt(item.qty * item.unit_price)}
                              </span>
                            )}
                            {status === "Draft" && (
                              <button onClick={() => removeItem(item.id)}
                                className="p-0.5 text-zinc-300 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                                <FiX className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {/* Subtotal */}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-200 dark:border-dark-border">
                          <span className="text-[11px] text-zinc-400">Subtotal</span>
                          <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">{fmt(subtotal)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Clinical notes + actions */}
                  <div className="card-shell p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">Clinical notes</p>
                    <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                      disabled={status === "Finalized"} placeholder="Clinical notes or observations..."
                      className="w-full rounded-lg border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 disabled:opacity-50 focus:outline-none resize-none" />
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={resetForm}
                        className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                        Reset
                      </button>
                      <button onClick={() => submitReport("Draft")} disabled={status !== "Draft"}
                        className="flex-[2] h-9 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        Save draft
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: live preview card */}
                <div className="card-shell p-5 h-fit sticky top-0">
                  {/* Preview header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                        <LuPawPrint className="h-4 w-4" />
                      </div>
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

                  {/* Owner */}
                  <div className="mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Owner</p>
                    {patientDetails ? (
                      <>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{patientDetails?.owner?.name || "—"}</p>
                        <p className="text-[11px] text-zinc-500">{patientDetails?.owner?.phone || "—"}</p>
                      </>
                    ) : <p className="text-xs text-zinc-400 italic">No patient selected</p>}
                  </div>

                  {/* Patient */}
                  <div className="rounded-lg bg-zinc-50 dark:bg-dark-surface p-3 mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Patient</p>
                    {patientDetails ? (
                      <>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{patientDetails.name}</p>
                        <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-zinc-500">
                          <span>{patientDetails?.species?.name || "—"} — {patientDetails?.breed?.name || "—"}</span>
                          {selectedAppointmentId && (() => {
                            const a = appointments.find((x) => x.id.toString() === selectedAppointmentId);
                            return a ? <span>{a.title || a.service?.name}</span> : null;
                          })()}
                        </div>
                      </>
                    ) : <p className="text-xs text-zinc-400 italic">No patient selected</p>}
                  </div>

                  {/* Items table */}
                  <div className="mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Services &amp; items rendered</p>
                    {items.filter((i) => !i.is_hidden).length > 0 ? (
                      <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-dark-border">
                            <th className="pb-1.5 text-left text-[9px] font-semibold text-zinc-400" style={{ width: "40%" }}>Item</th>
                            <th className="pb-1.5 text-left text-[9px] font-semibold text-zinc-400" style={{ width: "20%" }}>Category</th>
                            <th className="pb-1.5 text-right text-[9px] font-semibold text-zinc-400" style={{ width: "15%" }}>Qty</th>
                            <th className="pb-1.5 text-right text-[9px] font-semibold text-zinc-400" style={{ width: "25%" }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.filter((i) => !i.is_hidden).map((item, idx) => (
                            <tr key={idx} className="border-b border-zinc-100 dark:border-dark-border/50">
                              <td className="py-1.5 text-zinc-700 dark:text-zinc-300 truncate pr-2">{item.name}</td>
                              <td className="py-1.5"><CatBadge type={getShortType(item)} size="xs" /></td>
                              <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-400">{item.qty}</td>
                              <td className="py-1.5 text-right font-semibold text-zinc-800 dark:text-zinc-200">
                                {item.unit_price > 0 ? fmt(item.qty * item.unit_price) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-xs text-zinc-400 italic">No items added.</p>}
                  </div>

                  {/* Total */}
                  {items.length > 0 && (
                    <div className="flex justify-end gap-6 pt-2 border-t border-zinc-200 dark:border-dark-border text-xs">
                      <span className="text-zinc-400">Total</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">{fmt(subtotal)}</span>
                    </div>
                  )}

                  {/* Notes */}
                  {notes && (
                    <>
                      <div className="border-t border-zinc-100 dark:border-dark-border my-3" />
                      <p className="text-[10px] text-zinc-400">Notes: {notes}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Inventory report ── */}
            {reportSection === "inventory" && (
              <InventoryReportPane inventory={inventory} />
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
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 shrink-0">
                        <FiClipboard className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{rep.pet?.name || "—"}</p>
                        <p className="text-xs text-zinc-400">{formatDate(rep.created_at)} · {rep.appointment ? (rep.appointment.title || rep.appointment.service?.name || "Appointment") : "No appointment"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={clsx("text-[10px] font-black uppercase px-2 py-0.5 rounded",
                        rep.status === "Finalized" || rep.status === "Paid" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400")}>
                        {rep.status}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); handleViewReportDetails(rep); }}
                        className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 underline underline-offset-4">
                        Edit
                      </button>
                    </div>
                  </div>
                  {expandedReportId === rep.id && (
                    <div className="border-t border-zinc-100 dark:border-dark-border px-5 py-3.5 bg-zinc-50/50 dark:bg-dark-surface/20">
                      {rep.items && rep.items.filter((i) => !i.is_hidden).length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Items Rendered</p>
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
