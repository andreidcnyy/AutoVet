import { FiX, FiTrash2, FiSave, FiEdit2 } from "react-icons/fi";
import clsx from "clsx";
import { useState, useEffect } from "react";

const statusStyles = {
  "Low Stock": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "In Stock": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Expiring: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function ViewInventoryModal({ isOpen, onClose, product, onDeleteRequest }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (isOpen && product) {
      setFormData(product);
      setIsEditing(false);
    }
  }, [isOpen, product]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/update-product/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to save");
      setIsEditing(false);
      alert("Product updated successfully!");
    } catch (err) {
      alert("Error saving product: " + err.message);
    }
  };

  if (!isOpen || !product) return null;

  const inputClass =
    "mt-1 w-full font-semibold border-b px-1 py-0.5 text-slate-900 dark:text-zinc-50 dark:bg-dark-card dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-sm";

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
              ["Category", "category"],
              ["SKU", "sku"],
              ["Stock Level", "stock_level"],
              ["Price", "price"],
              ["Supplier", "supplier"],
              ["Expiration Date", "expiration_date"],
            ].map(([label, field]) => (
              <div key={field}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">{label}</p>
                {isEditing ? (
                  <input
                    type={field === "price" || field === "stock_level" ? "number" : "text"}
                    className={inputClass}
                    value={formData[field] ?? ""}
                    onChange={(e) => handleChange(field, e.target.value)}
                  />
                ) : field === "price" ? (
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">
                    ₱{Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                ) : field === "stock_level" ? (
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">{Number(product.stock_level).toLocaleString()} units</p>
                ) : (
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">{product[field] || "N/A"}</p>
                )}
              </div>
            ))}
          </div>

          {/* Footer Buttons */}
          <div className="mt-8 flex justify-between gap-3 border-t border-slate-100 pt-6 dark:border-dark-border">
            <button
              onClick={() => onDeleteRequest(product)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 focus:outline-none dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30"
            >
              <FiTrash2 className="h-4 w-4" />
              Delete Product
            </button>

            <button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-5 py-2.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 focus:outline-none dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
            >
              {isEditing ? <FiSave className="h-4 w-4" /> : <FiEdit2 className="h-4 w-4" />}
              {isEditing ? "Save" : "Edit"}
            </button>

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