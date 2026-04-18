import clsx from "clsx";
import { useState, useEffect, useCallback } from "react";
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
} from "react-icons/fi";
import { LuPill, LuSparkles } from "react-icons/lu";
import AddInventoryModal from "./AddInventoryModal";
import ViewInventoryModal from "./ViewInventoryModal";
import { useAuth } from "../../context/AuthContext";
import { ROLES, VET_AND_ADMIN } from "../../constants/roles";
import api from "../../api";

const categoryIcons = {
  Medicines: LuPill,
  Vaccines: FiPackage,
  Consumables: FiTrendingUp,
  Retail: FiBox,
  Supplies: FiPackage,
  "Clinic assets": FiBarChart2,
};

const categoryIconStyles = {
  Medicines: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  Vaccines: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  Consumables: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  Retail: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  Supplies: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400",
  "Clinic assets": "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
};

const statusStyles = {
  "Low Stock": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "In Stock": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Expiring: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

function TrendMiniChart() {
  const path = "M10 70 L58 50 L102 56 L152 34 L204 26 L258 18 L310 10";
  return (
    <svg viewBox="0 0 320 80" className="h-24 w-full">
      <line x1="10" y1="20" x2="310" y2="20" className="stroke-zinc-200 dark:stroke-zinc-700" strokeDasharray="4 5" />
      <line x1="10" y1="45" x2="310" y2="45" className="stroke-zinc-200 dark:stroke-zinc-700" strokeDasharray="4 5" />
      <line x1="10" y1="70" x2="310" y2="70" className="stroke-zinc-200 dark:stroke-zinc-700" strokeDasharray="4 5" />
      <path d={path} className="fill-none stroke-emerald-500" strokeWidth="3" strokeLinecap="round" />
      <circle cx="310" cy="10" r="5" className="fill-emerald-500" />
    </svg>
  );
}

function InventoryView() {
  const toast = useToast();
  const [activeFilter, setActiveFilter] = useState("All Items");
  const [showAiAside, setShowAiAside] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewedProduct, setViewedProduct] = useState(null);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [aiForecastData, setAiForecastData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState([]);
  const [forecastStatus, setForecastStatus] = useState({ percent: 0, message: "", is_running: false });
  const [updatingIds, setUpdatingIds] = useState(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { user } = useAuth();
  const isAdmin = VET_AND_ADMIN.includes(user?.role);

  useEffect(() => {
    const fetchInventory = async () => {
      if (!user?.token) return;
      try {
        const data = await api.get('/api/inventory');
        setInventoryRows(data);
        const uniqueCats = [...new Set(data.map(item => item.inventory_category?.name).filter(Boolean))];
        setCategories(uniqueCats);
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInventory();

    // Real-time listener
    const channel = echo.private('admin.inventory')
      .listen('.inventory.updated', (e) => {
        setInventoryRows(prev => prev.map(item => item.id === e.inventory.id ? { ...item, ...e.inventory } : item));
        toast.info(`Inventory Updated: ${e.inventory.item_name} stock is now ${e.inventory.stock_level}`);
      })
      .listen('.inventory.low_stock', (e) => {
        setInventoryRows(prev => prev.map(item => item.id === e.inventoryItem.id ? { ...item, ...e.inventoryItem } : item));
        toast.warning(`Low Stock Alert: ${e.inventoryItem.item_name} is running low!`);
      });

    return () => {
      echo.leave('admin.inventory');
    };
  }, [user?.token]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery, selectedCategory]);

  const handleForecast = async () => {
    setIsSimulating(true);
    setForecastStatus({ percent: 0, message: "Initiating batch analysis...", is_running: true });
    
    try {
      // 1. Trigger the background job
      const syncData = await api.post('/api/dashboard/run-forecast');
      if (syncData.status === 'error') throw new Error(syncData.message || "Failed to start analysis");

      // 2. Poll for Status
      const pollStatus = async () => {
        try {
          const data = await api.get('/api/dashboard/forecast-status');
          setForecastStatus(data);

          if (data.is_running) {
            setTimeout(pollStatus, 2000);
          } else {
            setIsSimulating(false);
            const rows = await api.get('/api/inventory');
            setInventoryRows(rows);
            toast.success(data.message || "AI Analysis complete.");
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
          setIsSimulating(false);
        }
      };

      pollStatus();

    } catch (err) {
      console.error("[AI-FORECAST-UI-ERROR]", err);
      toast.error(err.message || "AI Analysis failed to start.");
      setIsSimulating(false);
    }
  };

  const handleSaveNewItem = (newItem) => {
    setInventoryRows((prev) => [newItem, ...prev]);
    toast.success(`Successfully added ${newItem.item_name} to the database!`);
  };

  const handleEditProduct = (updatedProduct) => {
    setInventoryRows((prev) =>
      prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item))
    );
    setViewedProduct(updatedProduct);
    
    // Part 5.1: Track this item as "Updating" for AI Forecast polling
    setUpdatingIds(prev => new Set(prev).add(updatedProduct.id));
  };

  // Part 5.1: Background Polling for AI Forecast updates
  useEffect(() => {
    if (updatingIds.size === 0) return;

    const pollInterval = setInterval(async () => {
      const idsToPoll = Array.from(updatingIds);
      try {
        const updatedItems = await api.get('/api/inventory', { params: { ids: idsToPoll.join(',') } });
        if (updatedItems) {
          let allFresh = true;
          
          setInventoryRows(prev => prev.map(item => {
            const found = updatedItems.find(ui => ui.id === item.id);
            if (found) {
                const oldGen = item.latest_forecast?.generated_at;
                const newGen = found.latest_forecast?.generated_at;
                
                // If generated_at changed, or we have a forecast where we didn't before
                if (newGen !== oldGen) {
                    setUpdatingIds(curr => {
                        const next = new Set(curr);
                        next.delete(item.id);
                        return next;
                    });
                    return found;
                }
                allFresh = false;
                return item;
            }
            return item;
          }));

          if (allFresh && updatingIds.size > 0) {
             // If we found all items but none were "fresh" yet, we keep polling
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [updatingIds, user?.token]);

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Archive: recoverable within 30 days.\nAre you sure you want to archive ${product.item_name}?`)) return;

    try {
      const response = await fetch(`/api/inventory/${product.id}`, { 
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      if (!response.ok) throw new Error("Failed to delete product.");

      setInventoryRows((prev) => prev.filter((item) => item.id !== product.id));
      setViewedProduct(null);
      toast.success(`${product.item_name} archived successfully.`);
    } catch (err) {
      toast.error(err.message || "An error occurred while archiving.");
    }
  };

  const filteredRows = inventoryRows.filter((row) => {
    // 1. Search Logic
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
        row.item_name.toLowerCase().includes(q) ||
        (row.code && row.code.toLowerCase().includes(q)) ||
        (row.inventory_category?.name && row.inventory_category.name.toLowerCase().includes(q));
    
    if (!matchesSearch) return false;

    // 2. Category Logic
    if (selectedCategory !== "all" && row.inventory_category?.name !== selectedCategory) return false;

    // 3. Status Tabs Logic
    if (activeFilter === "All Items") return true;
    if (activeFilter === "Low Stock") return Number(row.stock_level) <= Number(row.min_stock_level);
    if (activeFilter === "Expiring") {
      if (!row.expiration_date) return false;
      const expDate = new Date(row.expiration_date);
      const today = new Date();
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30; // Expired or expiring within 30 days
    }
    return row.status === activeFilter;
  });

  // Calculate Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRows.slice(indexOfFirstItem, indexOfLastItem);

  const totalItems = inventoryRows.length;
  const lowStock = inventoryRows.filter((r) => Number(r.stock_level) <= Number(r.min_stock_level)).length;
  const expiringCount = inventoryRows.filter((r) => {
    if (!r.expiration_date) return false;
    const expDate = new Date(r.expiration_date);
    const today = new Date();
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30; 
  }).length;

  const dynamicSummaryCards = [
    { id: "total", label: "TOTAL ITEMS", value: totalItems.toLocaleString(), meta: "Based on DB", metaTone: "text-emerald-600", icon: FiBox },
    { id: "low", label: "LOW STOCK", value: lowStock.toLocaleString(), meta: "Needs attention", metaTone: "text-amber-600", icon: FiAlertTriangle },
    { id: "expiring", label: "EXPIRING/EXPIRED", value: expiringCount.toLocaleString(), meta: "Check dates", metaTone: "text-rose-600", icon: FiBell },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Internal Inventory Management</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Clinics &gt; Downtown Branch &gt; Stock Control &amp; Forecasting</p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {dynamicSummaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.id} className="card-shell p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{card.label}</p>
                <Icon className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
              </div>
              <p className="mt-2 text-5xl font-bold leading-none text-zinc-900 dark:text-zinc-50">{card.value}</p>
              <p className={clsx("mt-2 text-sm font-semibold", card.metaTone)}>{card.meta}</p>
            </article>
          );
        })}

        <article className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-5 text-white shadow-soft">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-100">
            <LuSparkles className="h-4 w-4" />
            AI Insight
          </p>
          <p className="mt-1 text-2xl font-bold">Stock Optimization</p>
          <p className="mt-2 text-sm text-emerald-100">Forecast refresh complete. {lowStock} items flagged for reorder planning.</p>
        </article>
      </section>

      {false && isAdmin && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LuSparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">AI Inventory Forecast</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {aiForecastData
                  ? `Last run: ${new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })} · ${aiForecastData.item_name} analyzed`
                  : 'Run the model to predict stockout dates using linear regression on your transaction history.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleForecast}
            disabled={isSimulating}
            className="flex-shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {isSimulating ? 'Analyzing...' : 'Run AI Forecast'}
          </button>
        </div>
      )}

      <section className="relative card-shell overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-dark-border p-4">
          <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-zinc-500 lg:max-w-md dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400 relative">
            <FiSearch className="h-4 w-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, codes, or categories..."
              className="w-full bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-200 dark:placeholder:text-zinc-500 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <FiX className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
                <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="appearance-none inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 pr-8 text-sm font-semibold text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:bg-dark-surface cursor-pointer"
                >
                    <option value="all">All Categories</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <FiFilter className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setActiveFilter("All Items")}
              className={clsx("rounded-xl border px-4 py-2 text-sm font-semibold", activeFilter === "All Items" ? "border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50" : "border-zinc-200 bg-white text-zinc-700 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300")}
            >
              All Items
            </button>
            <button
              onClick={() => setActiveFilter("Low Stock")}
              className={clsx("rounded-xl border px-4 py-2 text-sm font-semibold", activeFilter === "Low Stock" ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "border-zinc-200 bg-white text-amber-700 dark:border-dark-border dark:bg-dark-card dark:text-amber-400")}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />
              Low Stock
            </button>
            <button
              onClick={() => setActiveFilter("Expiring")}
              className={clsx("rounded-xl border px-4 py-2 text-sm font-semibold", activeFilter === "Expiring" ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300" : "border-zinc-200 bg-white text-rose-700 dark:border-dark-border dark:bg-dark-card dark:text-rose-400")}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-500" />
              Expiring
            </button>
            {isAdmin && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="ml-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm"
              >
                <FiPlus className="h-4 w-4" />
                Add Item
              </button>
            )}
          </div>
        </div>

        {/* Pagination Controls - TOP */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-dark-border px-5 py-3 bg-zinc-50/50 dark:bg-dark-surface/30">
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                Showing <span className="text-zinc-900 dark:text-zinc-50">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredRows.length)}</span> of <span className="text-zinc-900 dark:text-zinc-50">{filteredRows.length}</span> entries
            </div>
            
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                
                <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setCurrentPage(i + 1)}
                            className={clsx(
                                "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all",
                                currentPage === i + 1
                                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md"
                                    : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card"
                            )}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px]">
            <thead className="bg-zinc-50/50 dark:bg-dark-surface/50 border-b border-zinc-200 dark:border-dark-border">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="px-5 py-4">Code</th>
                <th className="px-5 py-4">Item</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Buying Price</th>
                <th className="px-5 py-4">Selling Price</th>
                <th className="px-5 py-4">Stock Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">AI Forecast</th>
                <th className="px-5 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Loading inventory data...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No items found matching the current filter.
                  </td>
                </tr>
              ) : (
                currentItems.map((row) => {
                  const catName = row.inventory_category?.name || "Uncategorized";
                  const Icon = categoryIcons[catName] || FiBox;
                  const iconStyle = categoryIconStyles[catName] || "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
                  
                  const isLowStock = Number(row.stock_level) <= Number(row.min_stock_level);
                  const expDate = row.expiration_date ? new Date(row.expiration_date) : null;
                  const isExpiring = expDate && (expDate - new Date()) / (1000 * 60 * 60 * 24) <= 30;
                  
                  let currentStatus = row.status;
                  if (isLowStock) currentStatus = "Low Stock";
                  else if (isExpiring) currentStatus = "Expiring";
                  else currentStatus = "In Stock";

                  return (
                    <tr key={row.id} className="border-t border-zinc-200 dark:border-dark-border align-middle hover:bg-zinc-50 dark:hover:bg-dark-surface/50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest bg-zinc-100 dark:bg-dark-surface px-2 py-1 rounded">
                          {row.code || "---"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={clsx("inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0", iconStyle)}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-tight">{row.item_name}</p>
                            <div className="mt-1 flex gap-1">
                                <span className={clsx(
                                  "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
                                  statusStyles[currentStatus] || "border-zinc-200 bg-zinc-50 text-zinc-700"
                                )}>
                                  {currentStatus}
                                </span>
                                {row.is_billable && (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                                        Billable
                                    </span>
                                )}
                            </div>
                            {row.expiration_date && (
                              <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                                <FiBell className="h-3 w-3" />
                                Exp: {new Date(row.expiration_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{catName}</p>
                      </td>
                      <td className="px-5 py-4 font-bold text-zinc-600 dark:text-zinc-400">
                        ₱{Number(row.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 font-black text-zinc-900 dark:text-zinc-50">
                        ₱{Number(row.selling_price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                            <p className={clsx("text-lg font-bold", isLowStock ? "text-amber-600" : "text-zinc-800 dark:text-zinc-200")}>
                                {Number(row.stock_level || 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] uppercase font-bold text-zinc-400">{row.unit || "units"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {updatingIds.has(row.id) ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse uppercase tracking-wider">
                            <LuSparkles className="h-3 w-3 animate-spin" />
                            Refreshing...
                          </div>
                        ) : row.latest_forecast ? (
                          <button
                            onClick={() => { setAiForecastData({ ...row.latest_forecast, item_name: row.item_name }); setShowAiAside(true); }}
                            className={clsx(
                              "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider",
                              row.latest_forecast.forecast_status === 'Critical'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                                : row.latest_forecast.forecast_status === 'Reorder Soon'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            )}
                          >
                            {row.latest_forecast.forecast_status}
                            <span className="ml-1 opacity-60">({row.latest_forecast.days_until_stockout}d)</span>
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => setViewedProduct(row)}
                          className="inline-flex items-center justify-center rounded-lg bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 focus:outline-none transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {showAiAside && aiForecastData && (
          <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card p-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <LuSparkles className="h-4 w-4 text-emerald-500" />
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-50">AI Analysis: {aiForecastData.item_name}</h4>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">scikit-learn LinearRegression · trained on transaction history</p>
              </div>
              <button onClick={() => setShowAiAside(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 dark:bg-dark-surface p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Current stock</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{aiForecastData.current_stock ?? aiForecastData.chart_data?.usage?.at(-1) ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3">
                <p className="text-xs text-rose-600 dark:text-rose-400 mb-1">Days until stockout</p>
                <p className="text-xl font-bold text-rose-700 dark:text-rose-300">{aiForecastData.days_until_stockout ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 dark:bg-dark-surface p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Daily consumption</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{aiForecastData.average_daily_consumption ?? '—'} <span className="text-xs font-normal">units/day</span></p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Recommended restock</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{aiForecastData.recommended_stock ?? '—'} units</p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4 leading-relaxed">{aiForecastData.analysis}</p>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/inventory/${aiForecastData.inventory_id}/accept-forecast`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ recommended_stock: aiForecastData.recommended_stock }) });
                    if (!res.ok) throw new Error();
                    toast.success('Target stock updated based on AI forecast.');
                    setShowAiAside(false);
                  } catch { toast.error('Failed to apply recommendation.'); }
                }}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Apply recommendation
              </button>
              <button onClick={() => setShowAiAside(false)} className="rounded-xl border border-zinc-200 dark:border-dark-border px-5 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors">
                Dismiss
              </button>
            </div>
          </div>
        )}
      </section>

      <AddInventoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveNewItem}
      />
      <ViewInventoryModal
        isOpen={!!viewedProduct}
        onClose={() => setViewedProduct(null)}
        product={viewedProduct}
        onDeleteRequest={handleDeleteProduct}
        onUpdate={handleEditProduct}
      />

      {isSimulating && (
        <div className="fixed bottom-6 right-6 z-[9999] flex w-[320px] flex-col gap-3 rounded-xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-zinc-200 dark:bg-dark-card dark:ring-dark-border animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <LuSparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                {forecastStatus.message || "Running AI Forecast..."}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {forecastStatus.percent}% complete
              </p>
            </div>
          </div>
          
          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${forecastStatus.percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryView;
