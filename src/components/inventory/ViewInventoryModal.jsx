import { FiX, FiTrash2, FiSave, FiEdit2, FiClock } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";

const statusStyles = {
  "Low Stock": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "In Stock": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Expiring: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function ViewInventoryModal({ isOpen, onClose, product, onDeleteRequest, onUpdate }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [aiForecastData, setAiForecastData] = useState(null); // New state for AI forecast
  const [isLoadingForecast, setIsLoadingForecast] = useState(false); // New state for forecast loading

  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  useEffect(() => {
    if (isOpen && product) {
      setFormData(product);
      setIsEditing(false);
      setAiForecastData(null); // Clear previous forecast data when modal opens
      
      // Fetch transaction history
      setIsLoadingTx(true);
      fetch(`/api/inventory/${product.id}/transactions`, {
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
      })
        .then(res => res.json())
        .then(data => {
            setTransactions(data);
            setIsLoadingTx(false);
        })
        .catch(err => {
            console.error(err);
            setIsLoadingTx(false);
        });

      // Fetch category options dynamically
      fetch("/api/inventory-categories?per_page=1000", {
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
      })
      .then(res => res.json())
      .then(data => {
        let categories = [];
        if (Array.isArray(data)) {
            categories = data;
        } else if (data && Array.isArray(data.data)) {
            categories = data.data;
        }
        
        const activeCategories = categories.filter(c => 
            c.status === 'Active' || c.status === 'active'
        );
        setCategoryOptions(activeCategories);
      })
      .catch(console.error);
    }
  }, [isOpen, product, user?.token]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: !!value }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/inventory/${formData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMsg = errorData.message || "Failed to save product";
        if (errorData.errors) {
            const firstKey = Object.keys(errorData.errors)[0];
            if (errorData.errors[firstKey] && errorData.errors[firstKey][0]) {
                errorMsg = errorData.errors[firstKey][0];
            }
        }
        throw new Error(errorMsg);
      }

      const updated = await res.json();
      toast.success("Inventory item updated successfully!");
      setIsEditing(false);
      onUpdate(updated); 
    } catch (err) {
      toast.error(err.message || "An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunForecast = async () => {
    if (!product?.id) {
      toast.error("Cannot run forecast without a product ID.");
      return;
    }
    setIsLoadingForecast(true);
    setAiForecastData(null); // Clear previous forecast
    try {
      const response = await fetch(`/api/inventory/${product.id}/forecast`, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch forecast.");
      }
      const data = await response.json();
      setAiForecastData(data);
      toast.success("AI Forecast generated successfully!");
    } catch (err) {
      toast.error(err.message || "An error occurred during forecasting.");
      setAiForecastData({ error: err.message || "Could not generate forecast." });
    } finally {
      setIsLoadingForecast(false);
    }
  };

  if (!isOpen || !product) return null;

  const inputClass =
    "mt-1 w-full font-semibold border-b px-1 py-0.5 text-slate-900 dark:text-zinc-50 dark:bg-dark-card dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-card dark:shadow-dark-soft">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-dark-border">
          <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-50">Product Details</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:text-zinc-500 dark:hover:bg-dark-surface dark:hover:text-zinc-300"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  className={inputClass + " text-2xl font-bold"}
                  value={formData.item_name || ""}
                  onChange={(e) => handleChange("item_name", e.target.value)}
                />
              ) : (
                <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">{product.item_name}</h2>
              )}
              {isEditing ? (
                <input
                  type="text"
                  className={inputClass + " text-sm mt-1"}
                  value={formData.sub_details || ""}
                  onChange={(e) => handleChange("sub_details", e.target.value)}
                />
              ) : (
                <p className="text-sm text-slate-500 dark:text-zinc-400">{product.sub_details || "No sub details provided."}</p>
              )}
            </div>
            <span
              className={clsx(
                "inline-flex rounded-full border px-3 py-1 text-sm font-semibold",
                statusStyles[product.status] || "border-slate-200 bg-slate-50 text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300"
              )}
            >
              {product.status}
            </span>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-y-4">
            {[
              ["Category", "inventory_category_id"],
              ["SKU", "sku"],
              ["Stock Level", "stock_level"],
              ["Min Stock (Alert)", "min_stock_level"],
              ["Price", "price"],
              ["Supplier", "supplier"],
              ["Expiration Date", "expiration_date"],
            ].map(([label, field]) => (
              <div key={field}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">{label}</p>
                {isEditing ? (
                  field === "inventory_category_id" ? (
                    <select
                      className={inputClass}
                      value={formData[field] ?? ""}
                      onChange={(e) => handleChange(field, parseInt(e.target.value) || "")}
                    >
                      <option value="" disabled>Select category</option>
                      {categoryOptions.length === 0 && <option value="" disabled>No active categories loaded</option>}
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  ) : field === "sku" ? (
                    <input
                      type="text"
                      readOnly
                      className={clsx(inputClass, "bg-slate-50 dark:bg-dark-surface/50 cursor-not-allowed opacity-70")}
                      value={formData[field] ?? ""}
                    />
                  ) : (
                    <input
                      type={
                        field === "price" || field === "stock_level" || field === "min_stock_level" 
                          ? "number" 
                          : field === "expiration_date" 
                            ? "date" 
                            : "text"
                      }
                      className={inputClass}
                      value={formData[field] ?? ""}
                      onChange={(e) => handleChange(field, e.target.value)}
                    />
                  )
                ) : field === "inventory_category_id" ? (
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">
                    {product.inventory_category?.name || "N/A"}
                  </p>
                ) : (field === "price" || field === "selling_price") ? (
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">
                    ₱{Number(product[field] || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                ) : (field === "stock_level" || field === "min_stock_level") ? (
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">{Number(product[field] || 0).toLocaleString()} units</p>
                ) : (
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">{product[field] || "N/A"}</p>
                )}
              </div>
            ))}
          </div>

          {/* Invoice & Logic Flags */}
          <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface/50">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Invoicing Profile</p>
              {isEditing ? (
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input 
                    type="checkbox" 
                    checked={!!formData.is_billable} 
                    onChange={(e) => handleCheckboxChange("is_billable", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Billable?</span>
                </label>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className={clsx(
                    "inline-block h-2 w-2 rounded-full",
                    product.is_billable ? "bg-emerald-500" : "bg-slate-300"
                  )} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    {product.is_billable ? "Billable Item" : "Non-Billable"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Inventory Logic</p>
              {isEditing ? (
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input 
                    type="checkbox" 
                    checked={!!formData.deduct_on_finalize} 
                    onChange={(e) => handleCheckboxChange("deduct_on_finalize", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Auto-Deduct?</span>
                </label>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                   <span className={clsx(
                    "inline-block h-2 w-2 rounded-full",
                    product.deduct_on_finalize ? "bg-blue-500" : "bg-amber-500"
                  )} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    {product.deduct_on_finalize ? "Deduct on Finalize" : "Manual Stock Out"}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* AI Forecast Display */}
          {aiForecastData && (
            <div className="mt-8 border-t border-slate-100 dark:border-dark-border pt-6">
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500 flex items-center gap-2">
                <LuSparkles className="h-4 w-4" /> AI Stockout Forecast
              </h4>
              {aiForecastData.error ? (
                <p className="text-rose-600 dark:text-rose-400 text-sm">{aiForecastData.error}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-slate-800 dark:text-zinc-50">
                    {aiForecastData.prediction_status === "Forecast Available" ? (
                      <>Predicted Stockout: <span className="text-rose-600 dark:text-rose-400">{aiForecastData.predicted_stockout_date}</span></>
                    ) : aiForecastData.prediction_status === "Stockout Imminent/Occurred" ? (
                      <span className="text-rose-600 dark:text-rose-400">{aiForecastData.message}</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">{aiForecastData.message}</span>
                    )}
                  </p>
                  {aiForecastData.prediction_status === "Forecast Available" && (
                    <p className="text-sm text-slate-600 dark:text-zinc-300">
                      Approximately {aiForecastData.days_until_stockout} days until stock reaches minimum level.
                    </p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Current Stock: {aiForecastData.current_stock} | Min Stock Level: {aiForecastData.min_stock_level} | As of: {aiForecastData.last_recorded_date}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Transactions Ledger */}
          <div className="mt-8 border-t border-slate-100 dark:border-dark-border pt-6">
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Transaction Ledger</h4>
            <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {isLoadingTx ? (
                    <p className="text-sm text-slate-400 dark:text-zinc-500">Loading transactions...</p>
                ) : transactions.length > 0 ? (
                    <div className="space-y-3">
                        {transactions.map(tx => (
                            <div key={tx.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-dark-border dark:bg-dark-surface">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                                        {tx.transaction_type}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-500">
                                        {new Date(tx.created_at).toLocaleString()} • {tx.creator?.name || 'System'}
                                    </p>
                                    {tx.remarks && <p className="mt-1 text-xs italic text-slate-600 dark:text-zinc-400">"{tx.remarks}"</p>}
                                </div>
                                <div className="text-right">
                                    <p className={clsx(
                                        "text-sm font-bold",
                                        tx.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                    )}>
                                        {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-500">
                                        Stock: {tx.new_stock}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 dark:text-zinc-500">No transactions recorded yet.</p>
                )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6 dark:border-dark-border">
            {isAdmin && (
              <>
                <button
                  onClick={handleRunForecast}
                  disabled={isLoadingForecast}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition",
                    isLoadingForecast
                      ? "bg-blue-400 text-white cursor-wait"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                  )}
                >
                  <LuSparkles className={clsx("h-4 w-4", isLoadingForecast && "animate-spin")} />
                  {isLoadingForecast ? "Analyzing..." : "Run AI Forecast"}
                </button>
                <button
                  onClick={() => onDeleteRequest(product)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 focus:outline-none dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30"
                >
                  <FiTrash2 className="h-4 w-4" />
                  Delete Product
                </button>

                <button
                  onClick={() => {
                    if (isEditing) {
                      handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  disabled={isSaving}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold focus:outline-none",
                    isEditing
                      ? (isSaving ? "bg-emerald-400 text-white cursor-wait" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20")
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-dark-surface dark:text-zinc-300 dark:hover:bg-zinc-800"
                  )}
                >
                  {isEditing ? <FiSave className="h-4 w-4" /> : <FiEdit2 className="h-4 w-4" />}
                  {isEditing ? (isSaving ? "Saving..." : "Save") : "Edit"}
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 focus:outline-none dark:bg-dark-surface dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
