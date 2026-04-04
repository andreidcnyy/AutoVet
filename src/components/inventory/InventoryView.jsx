import clsx from "clsx";
import { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
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
import { ROLES } from "../../constants/roles";

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
  Vaccines: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  Consumables: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  Retail: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  Supplies: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400",
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
      <line x1="10" y1="20" x2="310" y2="20" className="stroke-slate-200 dark:stroke-zinc-700" strokeDasharray="4 5" />
      <line x1="10" y1="45" x2="310" y2="45" className="stroke-slate-200 dark:stroke-zinc-700" strokeDasharray="4 5" />
      <line x1="10" y1="70" x2="310" y2="70" className="stroke-slate-200 dark:stroke-zinc-700" strokeDasharray="4 5" />
      <path d={path} className="fill-none stroke-blue-500" strokeWidth="3" strokeLinecap="round" />
      <circle cx="310" cy="10" r="5" className="fill-blue-500" />
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
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  useEffect(() => {
    const fetchInventory = async () => {
      if (!user?.token) return;
      try {
        const response = await fetch("/api/inventory", {
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${user.token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setInventoryRows(data);
        }
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInventory();
  }, [user?.token]);

  const handleRunForecast = async () => {
    setIsSimulating(true);
    setShowAiAside(false);
    
    try {
      const response = await fetch("/api/dashboard/inventory-forecast", {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch forecast");
      const data = await response.json();
      setAiForecastData(data);
      
      // Simulate analysis delay
      setTimeout(() => {
        setIsSimulating(false);
        setShowAiAside(true);
      }, 1500);
    } catch (err) {
      toast.error("AI Analysis failed. Please check your data.");
      setIsSimulating(false);
    }
  };

  const handleSaveNewItem = (newItem) => {
    // Optimistically push the newly saved backend item to the top of the local state 
    // without triggering a full screen refresh!
    setInventoryRows((prev) => [newItem, ...prev]);
    toast.success(`Successfully added ${newItem.item_name} to the database!`);
  };

  const handleEditProduct = (updatedProduct) => {
    setInventoryRows((prev) =>
      prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item))
    );
    setViewedProduct(updatedProduct);
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete ${product.item_name}?`)) return;

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
      toast.success(`${product.item_name} deleted successfully.`);
    } catch (err) {
      toast.error(err.message || "An error occurred while deleting.");
    }
  };

  const filteredRows = inventoryRows.filter((row) => {
    if (activeFilter === "All Items") return true;
    if (activeFilter === "Low Stock") return Number(row.stock_level) <= Number(row.min_stock_level);
    if (activeFilter === "Expiring") {
      if (!row.expiration_date) return false;
      const expDate = new Date(row.expiration_date);
      const today = new Date();
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 30;
    }
    return row.status === activeFilter;
  });

  const totalItems = inventoryRows.length;
  const lowStock = inventoryRows.filter((r) => Number(r.stock_level) <= Number(r.min_stock_level)).length;
  const expiring = inventoryRows.filter((r) => {
    if (!r.expiration_date) return false;
    const expDate = new Date(r.expiration_date);
    const today = new Date();
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 30; // Flag if expiring within 30 days
  }).length;

  const dynamicSummaryCards = [
    { id: "total", label: "TOTAL ITEMS", value: totalItems.toLocaleString(), meta: "Based on DB", metaTone: "text-emerald-600", icon: FiBox },
    { id: "low", label: "LOW STOCK", value: lowStock.toLocaleString(), meta: "Needs attention", metaTone: "text-amber-600", icon: FiAlertTriangle },
    { id: "expiring", label: "EXPIRING SOON", value: expiring.toLocaleString(), meta: "Check dates", metaTone: "text-rose-600", icon: FiBell },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Internal Inventory Management</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Clinics &gt; Downtown Branch &gt; Stock Control &amp; Forecasting</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleRunForecast}
            disabled={isSimulating}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition",
              isSimulating ? "bg-blue-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            <LuSparkles className={clsx("h-4 w-4", isSimulating && "animate-spin")} />
            {isSimulating ? "Analyzing..." : "Run AI Forecast"}
          </button>
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {dynamicSummaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.id} className="card-shell p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{card.label}</p>
                <Icon className="h-5 w-5 text-slate-400 dark:text-zinc-500" />
              </div>
              <p className="mt-2 text-5xl font-bold leading-none text-slate-900 dark:text-zinc-50">{card.value}</p>
              <p className={clsx("mt-2 text-sm font-semibold", card.metaTone)}>{card.meta}</p>
            </article>
          );
        })}

        <article className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-5 text-white shadow-soft">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-blue-100">
            <LuSparkles className="h-4 w-4" />
            AI Insight
          </p>
          <p className="mt-1 text-2xl font-bold">Stock Optimization</p>
          <p className="mt-2 text-sm text-blue-100">Forecast refresh complete. 6 items flagged for reorder planning.</p>
        </article>
      </section>

      <section className="relative card-shell overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-dark-border p-4">
          <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 lg:max-w-md dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400">
            <FiSearch className="h-4 w-4" />
            <input
              type="text"
              placeholder="Search items, categories, or SKUs..."
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-zinc-200 dark:placeholder:text-zinc-500"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:bg-dark-surface">
              <FiFilter className="h-4 w-4" />
              Filter
            </button>
            <button
              onClick={() => setActiveFilter("All Items")}
              className={clsx("rounded-xl border px-4 py-2 text-sm font-semibold", activeFilter === "All Items" ? "border-slate-400 bg-slate-100 text-slate-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50" : "border-slate-200 bg-white text-slate-700 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300")}
            >
              All Items
            </button>
            <button
              onClick={() => setActiveFilter("Low Stock")}
              className={clsx("rounded-xl border px-4 py-2 text-sm font-semibold", activeFilter === "Low Stock" ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "border-slate-200 bg-white text-amber-700 dark:border-dark-border dark:bg-dark-card dark:text-amber-400")}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />
              Low Stock
            </button>
            <button
              onClick={() => setActiveFilter("Expiring")}
              className={clsx("rounded-xl border px-4 py-2 text-sm font-semibold", activeFilter === "Expiring" ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300" : "border-slate-200 bg-white text-rose-700 dark:border-dark-border dark:bg-dark-card dark:text-rose-400")}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-500" />
              Expiring
            </button>
            {isAdmin && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="ml-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
              >
                <FiPlus className="h-4 w-4" />
                Add Item
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px]">
            <thead className="bg-slate-50 dark:bg-dark-surface">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="px-5 py-4">Item Name / Category</th>
                <th className="px-5 py-4">SKU</th>
                <th className="px-5 py-4">Stock Level</th>
                <th className="px-5 py-4">Pricing (Cost/Sell)</th>
                <th className="px-5 py-4">Status & Logic</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
                    Loading inventory data...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
                    No items found matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const catName = row.inventory_category?.name || "Uncategorized";
                  const Icon = categoryIcons[catName] || FiBox;
                  const iconStyle = categoryIconStyles[catName] || "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400";
                  return (
                    <tr key={row.id} className="border-t border-slate-200 dark:border-dark-border align-top hover:bg-slate-50 dark:hover:bg-dark-surface/50">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className={clsx("mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg", iconStyle)}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="mb-0.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{catName}</p>
                            <p className="text-lg font-semibold text-slate-900 dark:text-zinc-50">{row.item_name}</p>
                            <p className="text-sm text-slate-500 dark:text-zinc-400">{row.sub_details}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500 dark:text-zinc-400">{row.sku}</td>
                      <td className="px-5 py-4 text-lg font-medium text-slate-800 dark:text-zinc-200">
                        {Number(row.stock_level || 0).toLocaleString()} units
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <p className="text-sm text-slate-500 dark:text-zinc-500 line-through decoration-slate-300 font-medium">
                            ₱{Number(row.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-lg font-bold text-slate-900 dark:text-zinc-50">
                            ₱{Number(row.selling_price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                             const isLowStock = Number(row.stock_level) <= Number(row.min_stock_level);
                             const expDate = row.expiration_date ? new Date(row.expiration_date) : null;
                             const isExpiring = expDate && (expDate - new Date()) / (1000 * 60 * 60 * 24) <= 30;
                             
                             let currentStatus = row.status;
                             if (isLowStock) currentStatus = "Low Stock";
                             else if (isExpiring) currentStatus = "Expiring";
                             else currentStatus = "In Stock";

                             return (
                               <span
                                 className={clsx(
                                   "inline-flex rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap",
                                   statusStyles[currentStatus] || "border-slate-200 bg-slate-50 text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300"
                                 )}
                               >
                                 {currentStatus}
                               </span>
                             );
                          })()}
                          {row.is_billable && (
                            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400 whitespace-nowrap">
                              Billable
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500">
                           <span className={clsx("h-1.5 w-1.5 rounded-full", row.deduct_on_finalize ? "bg-blue-400" : "bg-slate-300")} />
                           {row.deduct_on_finalize ? "Auto-Deduct" : "Manual Stock Out"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => setViewedProduct(row)}
                          className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 focus:outline-none w-full"
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

        <div className="px-5 py-4 text-sm text-slate-500 dark:text-zinc-400">Showing {filteredRows.length} entries</div>

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

      {showAiAside && aiForecastData && (
        <aside className="fixed bottom-6 right-6 z-[9500] w-[430px] animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-dark-border dark:bg-dark-card dark:shadow-dark-soft ring-1 ring-slate-900/5 dark:ring-white/10">
            <div className="flex items-center justify-between bg-blue-600 px-5 py-3 text-white">
              <p className="text-xl font-bold flex items-center gap-2">
                <LuSparkles className="h-5 w-5" />
                AI Analysis: {aiForecastData.item_name}
              </p>
              <button onClick={() => setShowAiAside(false)} className="rounded-md p-1 hover:bg-white/15 transition-colors">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Recommended Stock Level</p>
                  <p className="mt-1 text-4xl font-bold text-slate-900 dark:text-zinc-50">{aiForecastData.recommended_stock} Units</p>
                </div>
                <span className="mt-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{aiForecastData.growth_label}</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-dark-border dark:bg-dark-surface">
                <TrendMiniChart />
                <div className="mt-1 grid grid-cols-7 text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                  {aiForecastData.chart_data.months.map((m, i) => (
                    <span key={i} className={i === 6 ? "text-blue-600 dark:text-blue-400" : ""}>{m} {i === 6 ? "(Est)" : ""}</span>
                  ))}
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
                {aiForecastData.analysis}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => toast.info("Item marked for manual review.")}
                  className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  Mark for Review
                </button>
                <button
                  onClick={() => {
                    toast.success("Target stock updated in system based on AI forecast.");
                    setShowAiAside(false);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                >
                  Update Target Stock
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {isSimulating && (
        <div className="fixed bottom-6 right-6 z-[9999] flex w-[320px] transform items-center gap-4 rounded-xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-slate-200 dark:bg-dark-card dark:ring-dark-border animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <LuSparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-50">Running AI Forecast simulation...</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Analyzing historical patterns</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryView;
