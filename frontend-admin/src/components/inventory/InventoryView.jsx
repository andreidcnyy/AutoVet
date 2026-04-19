import clsx from "clsx";
import { useState, useEffect, useCallback, useMemo } from "react";
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
  FiChevronRight
} from "react-icons/fi";
import { LuPill, LuSparkles } from "react-icons/lu";
import AddInventoryModal from "./AddInventoryModal";
import ViewInventoryModal from "./ViewInventoryModal";
import { useAuth } from "../../context/AuthContext";
import { ROLES, VET_AND_ADMIN } from "../../constants/roles";
import api from "../../api";

const statusStyles = {
  "In Stock": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Expiring: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  Expired: "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function InventoryView() {
  const toast = useToast();
  const [activeFilter, setActiveFilter] = useState("All Items");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewedProduct, setViewedProduct] = useState(null);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState([]);
  const [forecastStatus, setForecastStatus] = useState({ percent: 0, message: "", is_running: false });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const { user } = useAuth();
  const isAdmin = VET_AND_ADMIN.includes(user?.role);

  const INVENTORY_CACHE_KEY = 'inventory_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  const fetchInventory = useCallback(async (signal = null) => {
    try {
        const data = await api.get('/api/inventory', { signal });
        if (!Array.isArray(data)) return;
        setInventoryRows(data);
        const uniqueCats = [...new Set(data.map(item => item.inventory_category?.name).filter(Boolean))];
        setCategories(uniqueCats);
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch (err) {
        if (err.name === 'AbortError' || err.name === 'CanceledError') return;
        console.error("Failed to fetch inventory:", err);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.token) return;

    try {
      const cached = JSON.parse(localStorage.getItem(INVENTORY_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.data)) {
        setInventoryRows(cached.data);
        const uniqueCats = [...new Set(cached.data.map(item => item.inventory_category?.name).filter(Boolean))];
        setCategories(uniqueCats);
        setIsLoading(false);
      }
    } catch (_) {}

    const controller = new AbortController();
    fetchInventory(controller.signal);
    handleForecast();

    const channel = echo.private('admin.inventory')
      .listen('.inventory.updated', (e) => {
        setInventoryRows(prev => prev.map(item => item.id === e.inventory.id ? { ...item, ...e.inventory } : item));
      })
      .listen('.inventory.low_stock', (e) => {
        setInventoryRows(prev => prev.map(item => item.id === e.inventoryItem.id ? { ...item, ...e.inventoryItem } : item));
        toast.warning(`Low Stock Alert: ${e.inventoryItem.item_name} is running low!`);
      });

    return () => {
      controller.abort();
      echo.leave('admin.inventory');
    };
  }, [user?.token, fetchInventory]);

  const handleSaveNewItem = (newItem) => {
    setInventoryRows((prev) => [newItem, ...prev]);
    toast.success(`Successfully added ${newItem.item_name}!`);
  };

  const handleEditProduct = (updatedProduct) => {
    setInventoryRows((prev) => prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)));
    setViewedProduct(updatedProduct);
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

  const filteredRows = inventoryRows.filter((row) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = row.item_name.toLowerCase().includes(q) || (row.code && row.code.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (selectedCategory !== "all" && row.inventory_category?.name !== selectedCategory) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const expDate = row.expiration_date ? new Date(row.expiration_date) : null;
    
    if (activeFilter === "All Items") return true;
    if (activeFilter === "Low Stock") {
        return row.latest_forecast?.forecast_status === 'Low Stock';
    }
    if (activeFilter === "Expiring") return expDate && Math.ceil((expDate - today) / 86400000) <= 30 && expDate >= today;
    if (activeFilter === "Expired") return expDate && expDate < today;
    return true;
  });

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const currentItems = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const expiredCount = inventoryRows.filter(r => r.expiration_date && new Date(r.expiration_date) < new Date()).length;
  const lowStockAiCount = inventoryRows.filter(r => r.latest_forecast?.forecast_status === 'Low Stock').length;

  const summaryCards = [
    { id: "total", label: "TOTAL STOCK ITEMS", value: inventoryRows.length, meta: "Live DB Records", icon: FiBox, color: "text-zinc-900 dark:text-zinc-100", accent: "bg-emerald-500", bg: "bg-white dark:bg-dark-card", labelColor: "text-zinc-400" },
    { id: "low", label: "LOW STOCK ALERTS", value: lowStockAiCount, meta: "Predictive Need", icon: FiAlertTriangle, color: "text-amber-600", accent: "bg-amber-500", bg: "bg-white dark:bg-dark-card", labelColor: "text-zinc-400" },
    { id: "expired", label: "EXPIRED PRODUCTS", value: expiredCount, meta: "Check Expiry Dates", icon: FiBell, color: "text-rose-600", accent: "bg-rose-500", bg: "bg-white dark:bg-dark-card", labelColor: "text-zinc-400" },
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
            <FiPlus className="h-5 w-5" /> Add New Item
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

        <article className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <LuSparkles className="h-32 w-32" />
          </div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">
            <LuSparkles className="h-4 w-4" /> AI Optimization
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight uppercase italic leading-tight">Stock Insight</p>
          <p className="mt-2 text-xs font-bold opacity-90 leading-relaxed text-emerald-50">
            Automatic analysis complete. {lowStockAiCount} items flagged for immediate reorder planning.
          </p>
        </article>
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
                className="w-full rounded-xl border border-zinc-200 bg-white px-10 py-2 text-sm font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
              />
            </div>
            <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-300"
            >
                <option value="all">Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
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
                    onClick={() => setActiveFilter(f.id)}
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
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Pricing</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4">AI Forecast Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr><td colSpan="6" className="py-20 text-center font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Loading Clinical Inventory...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan="6" className="py-20 text-center font-bold text-zinc-400 uppercase tracking-widest">No Items Found</td></tr>
              ) : (
                currentItems.map((row) => {
                  const isExpired = row.expiration_date && new Date(row.expiration_date) < new Date();
                  return (
                    <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/20 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{row.item_name}</span>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{row.code || row.sku}</span>
                            {row.expiration_date && (
                                <span className={clsx("text-[9px] font-black uppercase tracking-tighter mt-1 px-1.5 py-0.5 rounded-sm w-fit", isExpired ? "bg-rose-100 text-rose-600" : "text-zinc-400")}>
                                    EXP: {new Date(row.expiration_date).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[10px] font-black uppercase text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                            {row.inventory_category?.name || "Unsorted"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                         <div className="flex flex-col">
                            <span className="text-xs font-bold text-zinc-400 font-mono">Buy: ₱{Number(row.price || 0).toFixed(2)}</span>
                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 font-mono">Sell: ₱{Number(row.selling_price || 0).toFixed(2)}</span>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <div className="flex flex-col items-center">
                            <span className={clsx(
                                "text-lg font-black",
                                row.stock_level <= 0 ? "text-rose-600 animate-pulse" : "text-zinc-900 dark:text-zinc-100"
                            )}>
                                {row.stock_level <= 0 ? "OUT" : row.stock_level}
                            </span>
                            <span className="text-[9px] font-bold text-zinc-400 uppercase">
                                {row.stock_level <= 0 ? "OF STOCK" : (row.unit || "pcs")}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         {row.latest_forecast ? (
                            <div className={clsx(
                                "flex flex-col gap-1 p-2 rounded-xl border",
                                (row.latest_forecast.forecast_status === 'Low Stock' || row.stock_level <= 0) 
                                    ? (row.stock_level <= 0 ? "border-rose-200 bg-rose-50 dark:bg-rose-900/10" : "border-amber-200 bg-amber-50 dark:bg-amber-900/10") 
                                    : "border-emerald-100 bg-emerald-50/30 dark:bg-emerald-900/10 dark:border-emerald-800"
                            )}>
                                <span className={clsx(
                                    "text-[9px] font-black uppercase leading-none tracking-widest",
                                    row.stock_level <= 0 ? "text-rose-400" : (row.latest_forecast.forecast_status === 'Low Stock' ? "text-amber-400" : "text-emerald-400")
                                )}>AI projection</span>
                                <span className={clsx(
                                    "text-[11px] font-black uppercase", 
                                    row.stock_level <= 0 ? "text-rose-600 dark:text-rose-400" : (row.latest_forecast.forecast_status === 'Low Stock' ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")
                                )}>
                                    {row.stock_level <= 0 ? "Out of Stock" : row.latest_forecast.forecast_status}
                                </span>
                                <span className={clsx(
                                    "text-[10px] font-bold italic", 
                                    row.stock_level <= 0 ? "text-rose-500" : (row.latest_forecast.forecast_status === 'Low Stock' ? "text-amber-500" : "text-zinc-500 dark:text-zinc-400")
                                )}>
                                    {row.stock_level <= 0 ? "Immediate reorder required" : `Out in ~${row.latest_forecast.days_until_stockout} ${row.latest_forecast.days_until_stockout === 1 ? 'day' : 'days'}`}
                                </span>
                            </div>
                         ) : <span className="text-xs text-zinc-300 font-bold uppercase">No Analysis</span>}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button onClick={() => setViewedProduct(row)} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 underline underline-offset-4">Details</button>
                      </td>
                    </tr>
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
    </div>
  );
}

export default InventoryView;
