import clsx from "clsx";
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useToast } from "../../context/ToastContext";
import echo from "../../utils/echo";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiBox,
  FiFilter,
  FiPackage,
  FiSearch,
  FiTrendingUp,
  FiX,
  FiPlus,
  FiChevronLeft,
  FiChevronRight,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
} from "react-icons/fi";
import { LuPill, LuSparkles } from "react-icons/lu";
import AddInventoryModal from "./AddInventoryModal";
import ViewInventoryModal from "./ViewInventoryModal";
import ReceiveStockModal from "./ReceiveStockModal";
import { useAuth } from "../../context/AuthContext";
import { ROLES, VET_AND_ADMIN } from "../../constants/roles";
import { useApi, useQueryClient } from "../../hooks/useApi";
import api from "../../api";

// Expired is derived, never stored: the API sends is_expired computed against
// the current date, and the date comparison is kept as a fallback for cached
// rows fetched before that field existed.
const isRowExpired = (row) => {
  if (typeof row?.is_expired === "boolean") return row.is_expired;
  if (!row?.expiration_date) return false;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return new Date(row.expiration_date) < t;
};

// Expiring means "within the next 30 days and not yet lapsed", judged per
// batch, since each delivery carries its own expiration date.
const isBatchExpiringSoon = (row) => {
  if (!row?.expiration_date) return false;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const exp = new Date(row.expiration_date);
  return exp >= t && Math.ceil((exp - t) / 86400000) <= 30;
};

const statusStyles = {
  "In Stock": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Expiring: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  Expired: "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function AiGuideModal({ onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-dark-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-dark-border bg-gradient-to-r from-emerald-50 to-zinc-50 dark:from-emerald-900/10 dark:to-dark-surface">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <LuSparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">AI Forecasting</p>
              <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100 leading-tight">How It Works</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-dark-border transition-colors text-zinc-400">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Intro */}
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            The AI Forecast system automatically watches your inventory and predicts when items are going to run low — before they actually run out. No manual counting needed.
          </p>

          {/* Steps */}
          <div className="space-y-3">
            {[
              {
                icon: FiRefreshCw,
                color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
                title: "It learns from usage history",
                desc: "Every time a product is used in an appointment or medical record, the AI tracks it. Over time, it builds a picture of how fast each item gets used.",
              },
              {
                icon: FiTrendingUp,
                color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
                title: "It predicts when stock will run out",
                desc: "Based on the usage pattern, it estimates how many days are left before an item hits zero. You'll see this as \"Out in ~X days\" in the AI Forecast column.",
              },
              {
                icon: FiAlertTriangle,
                color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
                title: "It warns you early",
                desc: "When an item is predicted to run out soon, it gets flagged as Low Stock — giving you time to reorder before patients are affected.",
              },
              {
                icon: FiCheckCircle,
                color: "text-zinc-500 bg-zinc-50 dark:bg-zinc-800",
                title: "It updates automatically",
                desc: "The forecast refreshes every time you open the Inventory page, so the predictions are always based on the latest usage data.",
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex gap-3 p-4 rounded-xl border border-zinc-100 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/50">
                <div className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">{title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status guide */}
          <div className="rounded-xl border border-zinc-100 dark:border-dark-border overflow-hidden">
            <div className="bg-zinc-50 dark:bg-dark-surface px-4 py-2.5 border-b border-zinc-100 dark:border-dark-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">What the status colors mean</p>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-dark-border">
              {[
                { dot: "bg-emerald-500", label: "In Stock", desc: "Enough supply — no action needed right now." },
                { dot: "bg-amber-400", label: "Low Stock", desc: "The AI predicts this item will run out soon. Time to reorder." },
                { dot: "bg-rose-500", label: "Out of Stock", desc: "Zero units left. Immediate reorder required." },
              ].map(({ dot, label, desc }) => (
                <div key={label} className="flex items-start gap-3 px-4 py-3">
                  <span className={clsx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
                  <div>
                    <p className="text-xs font-black text-zinc-700 dark:text-zinc-200">{label}</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
            The more appointment and usage data the system has, the more accurate the forecasts become over time.
          </p>

        </div>
      </div>
    </div>,
    document.body
  );
}

function InventoryView() {
  const toast = useToast();
  const [activeFilter, setActiveFilter] = useState("All Items");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewedProduct, setViewedProduct] = useState(null);
  const [receivingProduct, setReceivingProduct] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [forecastStatus, setForecastStatus] = useState({ percent: 0, message: "", is_running: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState([]);
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [showAiGuide, setShowAiGuide] = useState(false);
  // Which product rows have their batch list open. Keyed by product key, so it
  // survives a refetch that hands back new row objects.
  const [expandedProducts, setExpandedProducts] = useState(() => new Set());
  const itemsPerPage = 8;

  const toggleProduct = (key) =>
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const { user } = useAuth();
  const isAdmin = VET_AND_ADMIN.includes(user?.role);

  const INVENTORY_CACHE_KEY = 'inventory_cache_v2';
  const CACHE_TTL = 5 * 60 * 1000;

  const queryClient = useQueryClient();

  /**
   * Inventory list, held in the shared query cache.
   *
   * The manual version kept its own localStorage copy and re-read it in an
   * effect to paint before the network answered. useApi does the same thing
   * with the same key, so a return visit still paints instantly, but the rows
   * now live in one cache that the websocket handlers and every optimistic
   * update below write to — instead of a component-local array that was thrown
   * away on unmount.
   */
  const inventoryQuery = useApi(["inventory"], "/api/inventory", {
    enabled: Boolean(user?.token),
    cacheKey: INVENTORY_CACHE_KEY,
    cacheTTL: CACHE_TTL,
    staleTime: 60 * 1000,
  });

  const inventoryRows = Array.isArray(inventoryQuery.data) ? inventoryQuery.data : [];
  const isLoading = inventoryQuery.isLoading;

  /** Applies a list updater to the cached inventory, replacing setInventoryRows. */
  const setInventoryRows = useCallback(
    (updater) => {
      queryClient.setQueryData(["inventory"], (current) => {
        const list = Array.isArray(current) ? current : [];
        return typeof updater === "function" ? updater(list) : updater;
      });
    },
    [queryClient]
  );

  const fetchInventory = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    [queryClient]
  );

  // Category filter options follow whatever the cached rows contain.
  useEffect(() => {
    setCategories([
      ...new Set(inventoryRows.map((item) => item.inventory_category?.name).filter(Boolean)),
    ]);
  }, [inventoryQuery.data]);

  useEffect(() => {
    if (!user?.token) return;

    handleForecast();

    const channel = echo.private('admin.inventory')
      .listen('.inventory.updated', (e) => {
        setInventoryRows(prev => prev.map(item => item.id === e.inventory.id ? { ...item, ...e.inventory } : item));
      })
      .listen('.inventory.low_stock', (e) => {
        setInventoryRows(prev => prev.map(item => item.id === e.inventoryItem.id ? { ...item, ...e.inventoryItem } : item));
        toast.warning(`Low Stock Alert: ${e.inventoryItem.item_name} is running low!`);
      });

    const onVisible = () => { if (document.visibilityState === 'visible') fetchInventory(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      echo.leave('admin.inventory');
    };
  }, [user?.token, fetchInventory, setInventoryRows]);

  // Keep viewedProduct in sync when inventoryRows refreshes (e.g. after background fetch)
  useEffect(() => {
    if (!viewedProduct) return;
    const fresh = inventoryRows.find((r) => r.id === viewedProduct.id);
    if (fresh) setViewedProduct(fresh);
  }, [inventoryRows]);

  const handleSaveNewItem = (newItem) => {
    setInventoryRows((prev) => [newItem, ...prev]);
    toast.success(`Successfully added ${newItem.item_name}!`);
  };

  const handleBatchReceived = (batch) => {
    // The new batch is its own row, so insert it rather than merging into the
    // product it replenishes.
    if (batch?.id) setInventoryRows((prev) => [batch, ...prev.filter((r) => r.id !== batch.id)]);
    fetchInventory();
  };

  const handleEditProduct = (updatedProduct) => {
    setInventoryRows((prev) => prev.map((item) =>
      item.id === updatedProduct.id
        ? { ...item, ...updatedProduct, latest_forecast: updatedProduct.latest_forecast ?? item.latest_forecast }
        : item
    ));
    setViewedProduct((prev) => prev?.id === updatedProduct.id
      ? { ...prev, ...updatedProduct, latest_forecast: updatedProduct.latest_forecast ?? prev?.latest_forecast }
      : prev
    );
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to archive ${product.item_name}?`)) return;
    try {
      const response = await fetch(`/api/inventory/${product.id}`, { 
        method: "DELETE",
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
      });
      if (!response.ok) throw new Error("Failed to delete product.");
      setInventoryRows((prev) => prev.filter((item) => item.id !== product.id));
      setViewedProduct(null);
      toast.success(`${product.item_name} archived successfully.`);
    } catch (err) {
      toast.error(err.message || "An error occurred.");
    }
  };

  const handleForecast = async () => {
    setIsSimulating(true);
    try {
      await api.post('/api/dashboard/run-forecast');
      const pollStatus = async () => {
        try {
          const data = await api.get('/api/dashboard/forecast-status');
          setForecastStatus(data);
          if (data.is_running) {
            setTimeout(pollStatus, 2000);
          } else {
            setIsSimulating(false);
            fetchInventory();
          }
        } catch (pollErr) {
          setIsSimulating(false);
        }
      };
      pollStatus();
    } catch (err) {
      setIsSimulating(false);
    }
  };

  // Receiving a delivery creates a NEW row sharing the product's code — those
  // sibling rows are the batches InvoiceFinalizationService consumes
  // oldest-first, so the extra row is correct FIFO behaviour and the API must
  // keep returning it. What was wrong was the screen: one product with three
  // deliveries read as three separate products, and its quantity looked split.
  // Group the rows back into products here, in the view only. Nothing about
  // the schema, the endpoints or the deduction order changes.
  const products = useMemo(() => {
    const groups = new Map();

    for (const row of inventoryRows) {
      const code = row.code ? String(row.code).trim() : "";
      // Rows predating the code backfill have no code to group on, so they
      // stand alone rather than collapsing into one shared "" bucket.
      const key = code !== "" ? `code:${code}` : `id:${row.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    return Array.from(groups.entries()).map(([key, rows]) => {
      // Ascending id is the order FIFO consumes, so the first row is both the
      // original product and the next batch to be drawn down.
      const batches = [...rows].sort((a, b) => a.id - b.id);
      const primary = batches[0];

      const totalStock = batches.reduce((sum, b) => sum + Number(b.stock_level || 0), 0);

      // A forecast is stored per batch. At product level report the most
      // severe one, so a product is never shown as Safe while one of its
      // batches is projected to run out.
      const severity = { "Low Stock": 3, "Reorder Soon": 2, Safe: 1 };
      const worstStatus = batches.reduce((worst, b) => {
        const status = b.latest_forecast?.forecast_status;
        if (!status) return worst;
        return (severity[status] ?? 0) > (severity[worst] ?? 0) ? status : worst;
      }, null);
      const worstForecast =
        batches.find((b) => b.latest_forecast?.forecast_status === worstStatus)?.latest_forecast ?? null;

      const priceVaries = batches.some((b) => Number(b.price) !== Number(primary.price));
      const sellPriceVaries = batches.some((b) => Number(b.selling_price) !== Number(primary.selling_price));

      return {
        key,
        primary,
        batches,
        totalStock,
        worstStatus,
        worstForecast,
        priceVaries,
        sellPriceVaries,
        hasExpiring: batches.some(isBatchExpiringSoon),
        hasExpired: batches.some(isRowExpired),
      };
    });
  }, [inventoryRows]);

  // Filter whole products, never individual batches, so a product's displayed
  // total is always its real total rather than the sum of whatever matched.
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.primary.item_name.toLowerCase().includes(q) ||
      (p.primary.code && p.primary.code.toLowerCase().includes(q)) ||
      p.batches.some((b) => (b.batch_number || "").toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (selectedCategory !== "all" && p.primary.inventory_category?.name !== selectedCategory) return false;

    if (activeFilter === "All Items") return true;
    if (activeFilter === "Low Stock") return p.worstStatus === "Low Stock" || p.totalStock <= 0;
    if (activeFilter === "Expiring") return p.hasExpiring;
    if (activeFilter === "Expired") return p.hasExpired;
    return true;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentItems = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Expiry belongs to the individual batch, so these two stay batch-level
  // counts on purpose — one expired batch of a product is one thing to pull
  // off the shelf. The other two cards count products.
  const expiringCount = inventoryRows.filter(isBatchExpiringSoon).length;
  const expiredCount = inventoryRows.filter(isRowExpired).length;
  const lowStockAiCount = products.filter((p) => p.worstStatus === "Low Stock").length;
  const distinctProductCount = products.length;

  const summaryCards = [
    { id: "total",    label: "TOTAL STOCK ITEMS",   value: distinctProductCount, meta: "Distinct Products",  icon: FiBox,          color: "text-zinc-900 dark:text-zinc-100", accent: "bg-emerald-500", bg: "bg-white dark:bg-dark-card", labelColor: "text-zinc-400" },
    { id: "low",      label: "LOW STOCK ALERTS",     value: lowStockAiCount,      meta: "Predictive Need",   icon: FiAlertTriangle, color: "text-amber-600",                  accent: "bg-amber-500",  bg: "bg-white dark:bg-dark-card", labelColor: "text-zinc-400" },
    { id: "expiring", label: "EXPIRING PRODUCTS",    value: expiringCount,        meta: "Within 30 Days",    icon: FiClock,         color: "text-orange-500",                  accent: "bg-orange-400", bg: "bg-white dark:bg-dark-card", labelColor: "text-zinc-400" },
    { id: "expired",  label: "EXPIRED PRODUCTS",     value: expiredCount,         meta: "Check Expiry Dates", icon: FiBell,         color: "text-rose-600",                   accent: "bg-rose-500",   bg: "bg-white dark:bg-dark-card", labelColor: "text-zinc-400" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic leading-none">
            <span className="text-emerald-600 mr-2">/</span>Inventory
          </h2>
          <p className="mt-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">Master Stock Control & AI Predictive Projections</p>
        </div>
        {isAdmin && (
          <button onClick={() => setIsAddModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-black uppercase tracking-widest hover:bg-emerald-700 hover:scale-105 transition-all shadow-xl shadow-emerald-600/20">
            <FiPlus className="h-5 w-5" /> Add New Product
          </button>
        )}
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.id} className={clsx("card-shell p-6 relative overflow-hidden group border border-zinc-100 dark:border-dark-border", card.bg)}>
              <div className={clsx("absolute top-0 right-0 w-1.5 h-full transition-all group-hover:w-2", card.accent)} />
              <div className="flex items-start justify-between gap-2">
                <p className={clsx("text-[10px] font-black uppercase tracking-wider", card.labelColor)}>{card.label}</p>
                <Icon className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
              </div>
              <p className={clsx("mt-2 text-5xl font-black leading-none tracking-tighter", card.color)}>{card.value}</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{card.meta}</p>
            </article>
          );
        })}

      </section>

      <div className="card-shell overflow-hidden bg-white dark:bg-dark-card border border-zinc-100 dark:border-dark-border">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 dark:border-dark-border p-4 bg-zinc-50/50 dark:bg-dark-surface/20">
          <div className="flex flex-1 items-center gap-3 min-w-[300px]">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items or codes..."
                className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-9 py-2 text-sm font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                  <FiX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-300"
            >
                <option value="all">Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <button
              onClick={() => setShowAiGuide(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all whitespace-nowrap"
            >
              <LuSparkles className="h-3.5 w-3.5" />
              How AI Works
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-zinc-100/50 dark:bg-zinc-800/50 p-1.5 rounded-2xl border border-zinc-100 dark:border-dark-border">
            {[
              { id: "All Items", active: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md" },
              { id: "Low Stock", active: "bg-amber-500 text-white shadow-md shadow-amber-500/20 border-amber-600" },
              { id: "Expiring", active: "bg-rose-400 text-white shadow-md shadow-rose-400/20" },
              { id: "Expired", active: "bg-zinc-500 text-white shadow-md" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setActiveFilter(f.id); setCurrentPage(1); }}
                className={clsx(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                  activeFilter === f.id ? f.active : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                {f.id}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 bg-zinc-50/50 dark:bg-dark-surface/30 border-b border-zinc-100 dark:border-dark-border">
                <th className="px-6 py-4">Item Details</th>
                <th className="px-6 py-4">Batch #</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-right">Buy Price</th>
                <th className="px-6 py-4 text-right">Sell Price</th>
                <th className="px-6 py-4">AI Forecast Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr><td colSpan="8" className="py-20 text-center font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Loading Clinical Inventory...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan="8" className="py-20 text-center font-bold text-zinc-400 uppercase tracking-widest">No Items Found</td></tr>
              ) : (
                currentItems.map((product) => {
                  const { key, primary, batches, totalStock, worstStatus, worstForecast } = product;
                  const isExpanded = expandedProducts.has(key);
                  const isOut = totalStock <= 0;
                  const isLow = worstStatus === 'Low Stock';
                  const money = (v) => `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  return (
                    <Fragment key={key}>
                    <tr className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/20 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleProduct(key)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? `Hide batches of ${primary.item_name}` : `Show batches of ${primary.item_name}`}
                            className="mt-0.5 rounded-md p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            <FiChevronRight className={clsx("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                          </button>
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight leading-tight">{primary.item_name}</span>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{primary.code || primary.sku}</span>
                                {product.hasExpired && (
                                    <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                                        Has expired batch
                                    </span>
                                )}
                                {!product.hasExpired && product.hasExpiring && (
                                    <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                        Expiring soon
                                    </span>
                                )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          type="button"
                          onClick={() => toggleProduct(key)}
                          className="flex flex-col text-left hover:opacity-70"
                        >
                            <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">
                                {batches.length === 1 ? (primary.batch_number || "No Batch") : `${batches.length} batches`}
                            </span>
                            <span className="text-[9px] font-bold text-zinc-400 uppercase mt-0.5">
                                {batches.length === 1
                                  ? (primary.lot_number ? `Lot: ${primary.lot_number}` : "Single batch")
                                  : (isExpanded ? "Hide breakdown" : "Show breakdown")}
                            </span>
                        </button>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[10px] font-black uppercase text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                            {primary.inventory_category?.name || "Unsorted"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <div className="flex flex-col items-center">
                            <span className={clsx(
                                "text-lg font-black",
                                isOut ? "text-rose-600 animate-pulse" : "text-zinc-900 dark:text-zinc-100"
                            )}>
                                {isOut ? "OUT" : totalStock}
                            </span>
                            <span className="text-[9px] font-bold text-zinc-400 uppercase">
                                {isOut ? "OF STOCK" : `${primary.unit || "pcs"}${batches.length > 1 ? " total" : ""}`}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                          {primary.price > 0 ? money(primary.price) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                        </span>
                        {product.priceVaries && (
                          <span className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400">Varies by batch</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className={clsx("text-sm font-black", primary.selling_price > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-400 dark:text-rose-500")}>
                          {primary.selling_price > 0 ? money(primary.selling_price) : "No price"}
                        </span>
                        {product.sellPriceVaries && (
                          <span className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400">Varies by batch</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                         {/* Expiry is judged from the date on every render, so an item
                             lapses on its own and a changed system date is reflected
                             at once — the stored status only ever tracks stock level. */}
                         {worstForecast ? (
                            <div className={clsx(
                                "flex flex-col gap-1 p-2 rounded-xl border",
                                (isLow || isOut)
                                    ? (isOut ? "border-rose-200 bg-rose-50 dark:bg-rose-900/10" : "border-amber-200 bg-amber-50 dark:bg-amber-900/10")
                                    : "border-emerald-100 bg-emerald-50/30 dark:bg-emerald-900/10 dark:border-emerald-800"
                            )}>
                                <span className={clsx(
                                    "text-[9px] font-black uppercase leading-none tracking-widest",
                                    isOut ? "text-rose-400" : (isLow ? "text-amber-400" : "text-emerald-400")
                                )}>AI projection{batches.length > 1 ? " — worst batch" : ""}</span>
                                <span className={clsx(
                                    "text-[11px] font-black uppercase",
                                    isOut ? "text-rose-600 dark:text-rose-400" : (isLow ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")
                                )}>
                                    {isOut ? "Out of Stock" : worstStatus}
                                </span>
                                <span className={clsx(
                                    "text-[10px] font-bold italic",
                                    isOut ? "text-rose-500" : (isLow ? "text-amber-500" : "text-zinc-500 dark:text-zinc-400")
                                )}>
                                    {isOut
                                        ? "Immediate reorder required"
                                        : (worstForecast.days_until_stockout == null
                                            ? "Stable trend — no stockout predicted"
                                            : `Out in ~${worstForecast.days_until_stockout} ${worstForecast.days_until_stockout === 1 ? 'day' : 'days'}`)}
                                </span>
                            </div>
                         ) : <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-300 dark:text-zinc-600 italic">Needs more transaction data</span>}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {isAdmin && (
                            <button
                              onClick={() => setReceivingProduct(primary)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400"
                              title="Receive a new batch of this product"
                            >
                              <FiPackage className="h-3 w-3" /> Receive
                            </button>
                          )}
                          <button onClick={() => setViewedProduct(primary)} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 underline underline-offset-4">Details</button>
                        </div>
                      </td>
                    </tr>

                    {/* Batch breakdown. Listed oldest-first, which is the order
                        FIFO draws them down, so the top row is what the next
                        invoice will consume. */}
                    {isExpanded && batches.map((b, i) => {
                      const batchExpired = isRowExpired(b);
                      return (
                        <tr key={b.id} className="bg-zinc-50/70 dark:bg-dark-surface/30 text-zinc-600 dark:text-zinc-400">
                          <td className="px-6 py-3 pl-14">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                {i === 0 ? "Next to be used" : `Batch ${i + 1}`}
                              </span>
                              {b.expiration_date && (
                                <span className="mt-0.5 text-[9px] font-black uppercase tracking-tighter text-zinc-400">
                                  EXP: {new Date(b.expiration_date).toLocaleDateString()}
                                </span>
                              )}
                              {batchExpired && (
                                <span className={clsx("mt-1 inline-block w-fit rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest", statusStyles["Expired"])}>
                                  Expired
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300">{b.batch_number || "No Batch"}</span>
                              {b.lot_number && <span className="text-[9px] font-bold text-zinc-400 uppercase mt-0.5">Lot: {b.lot_number}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {b.supplier && <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{b.supplier}</span>}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={clsx("text-sm font-black", b.stock_level <= 0 ? "text-rose-500" : "text-zinc-700 dark:text-zinc-300")}>
                              {b.stock_level <= 0 ? "0" : b.stock_level}
                            </span>
                            <span className="block text-[9px] font-bold text-zinc-400 uppercase">{b.unit || "pcs"}</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-[11px] font-bold">{b.price > 0 ? money(b.price) : "—"}</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-[11px] font-bold">{b.selling_price > 0 ? money(b.selling_price) : "—"}</span>
                          </td>
                          <td className="px-6 py-3">
                            {b.latest_forecast ? (
                              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                {b.latest_forecast.forecast_status}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-300 dark:text-zinc-600 italic">No forecast</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button onClick={() => setViewedProduct(b)} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 underline underline-offset-4">Details</button>
                          </td>
                        </tr>
                      );
                    })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between border-t border-zinc-100 dark:border-dark-border px-6 py-4 bg-zinc-50/50 dark:bg-dark-surface/20">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Page {currentPage} of {totalPages || 1}</p>
            <div className="flex gap-2">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 disabled:opacity-50 hover:bg-zinc-50 transition-colors"><FiChevronLeft /></button>
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 disabled:opacity-50 hover:bg-zinc-50 transition-colors"><FiChevronRight /></button>
            </div>
        </footer>
      </div>

      <AddInventoryModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveNewItem} />
      <ViewInventoryModal isOpen={!!viewedProduct} onClose={() => setViewedProduct(null)} product={viewedProduct} onDeleteRequest={handleDeleteProduct} onUpdate={handleEditProduct} />
      <ReceiveStockModal
        isOpen={!!receivingProduct}
        onClose={() => setReceivingProduct(null)}
        product={receivingProduct}
        onReceived={handleBatchReceived}
      />
      {showAiGuide && <AiGuideModal onClose={() => setShowAiGuide(false)} />}
    </div>
  );
}

export default InventoryView;
