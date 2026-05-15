import { useMemo, useState, useEffect } from "react";
import clsx from "clsx";
import {
  FiChevronDown, FiChevronLeft, FiChevronRight, FiFileText,
  FiSearch, FiSend, FiDownload, FiRefreshCw,
  FiX, FiCalendar,
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

const getCatName = (item) => item.inventory_category?.name || item.category || "Uncategorized";

// ─── Transaction: Report History (view/filter) ────────────────────────────────

function TransactionViewPane({ inventory, services, owners, setReportRows, setGenerated }) {
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
  const [allRows, setAllRows]                         = useState([]);
  const [localGenerated, setLocalGenerated]           = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const params = { per_page: 500, with_items: 1, only_transactions: 1, date_from: dateFrom, date_to: dateTo };
      if (selectedOwnerId) params.owner_id = selectedOwnerId;

      const data = await api.get("/api/reports", { params });
      const invoices = Array.isArray(data) ? data : (data?.data || []);

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
      setLocalGenerated(true);
      setGenerated(true);
      if (rows.length === 0) toast.warning("No transactions found for the selected filters.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  const displayRows = useMemo(() => {
    if (!localGenerated) return [];
    return allRows.filter((row) => {
      if (itemTypeFilter !== "all" && row.itemType !== itemTypeFilter) return false;
      if (selectedServiceId && row.service_id?.toString() !== selectedServiceId) return false;
      if (selectedInventoryId && row.inventory_id?.toString() !== selectedInventoryId) return false;
      return true;
    });
  }, [allRows, localGenerated, itemTypeFilter, selectedServiceId, selectedInventoryId]);

  useEffect(() => { setReportRows(displayRows); }, [displayRows]);

  const handleReset = () => {
    setLocalGenerated(false); setGenerated(false); setAllRows([]); setReportRows([]);
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
        {localGenerated && (
          <p className="text-[9px] text-zinc-400 italic text-center pt-1">Filters apply instantly.</p>
        )}
      </div>

      {/* Report document */}
      <div className="card-shell p-5">
        <div className="mb-4 text-right">
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">Report History</h2>
          {localGenerated && <p className="text-xs text-zinc-500 mt-0.5">Bill Date From {formatDate(dateFrom)} To {formatDate(dateTo)}</p>}
        </div>

        {!localGenerated ? (
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
            <div className="flex justify-end">
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

  const [txSubTab, setTxSubTab] = useState("create");

  // Shared reference data
  const [inventory, setInventory] = useState([]);
  const [services, setServices]   = useState([]);
  const [owners, setOwners]       = useState([]);
  const [pets, setPets]           = useState([]);

  // ── Transaction CREATE form ────────────────────────────────────────────────
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
  const [submitting, setSubmitting]                     = useState(false);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.qty * (i.unit_price || 0), 0), [items]);

  // ── Lifted report state (for PDF / header context) ─────────────────────────
  const [txReportRows, setTxReportRows] = useState([]);
  const [txGenerated, setTxGenerated]   = useState(false);

  // Load shared reference data
  useEffect(() => {
    if (!user?.token) return;
    Promise.all([
      api.get("/api/inventory").catch(() => ({ data: [] })),
      api.get("/api/services").catch(() => []),
      api.get("/api/owners",   { params: { minimal: 1, per_page: 1000 } }).catch(() => ({ data: [] })),
      api.get("/api/pets",     { params: { minimal: 1, per_page: 1000 } }).catch(() => ({ data: [] })),
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
    api.get("/api/appointments", { params: { pet_id: pId, per_page: 100 } }).then((data) => {
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

    setSubmitting(true);
    const isUpdate = !!reportId;
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
      const data = isUpdate
        ? await api.put(`/api/reports/${reportId}`, payload)
        : await api.post("/api/reports", payload);

      window.dispatchEvent(new CustomEvent("inventory-forecast-refresh"));

      if (finalStatus === "Draft") {
        const id = data?.id || data?.data?.id;
        if (id) { setReportId(id); }
        setStatus("Draft");
        toast.success("Report saved as draft.");
      } else {
        toast.success("Report completed. Stock deducted and AI data updated.");
        resetForm();
        setTxSubTab("view");
      }
    } catch (err) {
      const errData = err?.response?.data;
      if (err?.response?.status === 422 && errData?.errors) {
        toast.error(Object.values(errData.errors)[0]?.[0] || "Validation error.");
      } else {
        toast.error(errData?.message || errData?.error || "Failed to save report.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-dark-border">
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Section header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-dark-border">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Reports › New report</p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50">New report</h1>
            <div className="flex items-center gap-2">
              {txSubTab === "create" && (
                <>
                  <span className={clsx("rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border",
                    status === "Finalized" ? "bg-emerald-950/60 text-emerald-400 border-emerald-800" : "bg-amber-950/60 text-amber-400 border-amber-800")}>
                    {status}
                  </span>
                  <button onClick={() => submitReport("Draft")} disabled={submitting || status !== "Draft"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface disabled:opacity-50 transition-colors">
                    Save draft
                  </button>
                  <button onClick={() => submitReport("Finalized")} disabled={submitting || status === "Finalized"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {submitting ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiSend className="h-3.5 w-3.5" />} Complete report
                  </button>
                </>
              )}
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-dark-border text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                <FiDownload className="h-3.5 w-3.5" /> Export PDF
              </button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-1 mt-3 border-b border-zinc-100 dark:border-dark-border -mb-3 pb-0">
            {[{ id: "create", label: "New transaction" }, { id: "view", label: "Report History" }].map(({ id, label }) => (
              <button key={id} onClick={() => setTxSubTab(id)}
                className={clsx("px-4 py-2 text-xs font-semibold border-b-2 transition-colors",
                  txSubTab === id ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable pane */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* New transaction */}
          {txSubTab === "create" && (
            <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>
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
                      <p className="text-[10px] text-zinc-400">Digivet Systems</p>
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

          {/* Report History (renamed from Sales Income Report) */}
          {txSubTab === "view" && (
            <TransactionViewPane
              inventory={inventory} services={services} owners={owners}
              setReportRows={setTxReportRows} setGenerated={setTxGenerated}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportsModuleView;
