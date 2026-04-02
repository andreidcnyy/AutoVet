import { useState, useEffect } from "react";
import { FiX, FiCheckCircle } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";

const STATUS_OPTIONS = ["In Stock", "Low Stock", "Expiring"];

const inventorySchema = z.object({
    item_name: z.string().min(1, "Item name is required").max(255),
    sub_details: z.string().max(255).optional(),
    category: z.string().min(1, "Category is required").max(255),
    sku: z.string().max(255).optional(),
    stock_level: z.coerce.number().min(0, "Stock must be 0 or more"),
    min_stock_level: z.coerce.number().min(0, "Alert level must be 0 or more"),
    status: z.string().min(1, "Status is required").max(255),
    price: z.coerce.number().min(0, "Cost price must be 0 or more").optional().or(z.literal("")),
    selling_price: z.coerce.number().min(0, "Selling price must be 0 or more").optional().or(z.literal("")),
    is_billable: z.boolean().default(true),
    is_consumable: z.boolean().default(false),
    deduct_on_finalize: z.boolean().default(true),
    supplier: z.string().max(255).optional(),
    expiration_date: z.string().optional().or(z.literal(""))
});

export default function AddInventoryModal({ isOpen, onClose, onSave }) {
    const toast = useToast();
    const [categoryOptions, setCategoryOptions] = useState(["Consumables", "Medicines", "Retail", "Supplies", "Vaccines", "Clinic assets"]);
    const [costPriceDisplay, setCostPriceDisplay] = useState("");
    const [sellingPriceDisplay, setSellingPriceDisplay] = useState("");
    const { user } = useAuth();

    useEffect(() => {
        if (isOpen && user?.token) {
            fetch("/api/settings", {
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${user.token}`
                }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.inventory_categories) setCategoryOptions(JSON.parse(data.inventory_categories));
                })
                .catch(console.error);
        }
    }, [isOpen, user?.token]);

    const {
        register,
        handleSubmit,
        reset,
        setValue, // <-- needed for interactive input
        formState: { errors, isSubmitting }
        } = useForm({
        resolver: zodResolver(inventorySchema),
        defaultValues: {
            item_name: "",
            sub_details: "",
            category: "Consumables",
            sku: "",
            stock_level: 0,
            min_stock_level: 10,
            status: "In Stock",
            price: "",
            selling_price: "",
            is_billable: true,
            is_consumable: false,
            deduct_on_finalize: true,
            supplier: "",
            expiration_date: "",
        }
        });

    if (!isOpen) return null;

    const onSubmit = async (data) => {
        try {
            const response = await fetch("/api/inventory", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": `Bearer ${user?.token}`
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const err = await response.json();
                if (err.errors) {
                    throw new Error(Object.values(err.errors)[0][0]);
                }
                throw new Error(err.message || "Failed to save inventory item.");
            }

            const savedItem = await response.json();
            onSave(savedItem);
            toast.success("Inventory item added successfully!");

            reset();
            onClose();
        } catch (err) {
            toast.error(err.message || "An error occurred while saving.");
        }
    };

    const inputBase = "w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-blue-500";
    const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-500 dark:border-dark-border");

    return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70">
    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-card dark:shadow-dark-soft">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-dark-border">
        <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-50">
          Add New Inventory Item
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:text-zinc-500 dark:hover:bg-dark-surface dark:hover:text-zinc-300"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Category - moved to top */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              Category *
            </label>
            <select {...register("category")} className={getInputClass(errors.category)}>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-500">{errors.category.message}</p>
            )}
          </div>

          {/* Supplier - moved to top */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              Supplier
            </label>
            <input
              type="text"
              {...register("supplier")}
              className={getInputClass(errors.supplier)}
              placeholder="e.g. Zoetis"
            />
            {errors.supplier && (
              <p className="mt-1 text-sm text-red-500">{errors.supplier.message}</p>
            )}
          </div>

          {/* Item Name */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              Item Name *
            </label>
            <input
              type="text"
              {...register("item_name")}
              className={getInputClass(errors.item_name)}
              placeholder="e.g. Parvovirus Vaccine"
            />
            {errors.item_name && (
              <p className="mt-1 text-sm text-red-500">{errors.item_name.message}</p>
            )}
          </div>

          {/* Sub Details */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              Sub Details
            </label>
            <input
              type="text"
              {...register("sub_details")}
              className={getInputClass(errors.sub_details)}
              placeholder="e.g. 10ml Vial"
            />
            {errors.sub_details && (
              <p className="mt-1 text-sm text-red-500">{errors.sub_details.message}</p>
            )}
          </div>

          {/* SKU */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              SKU (Auto-generated)
            </label>
            <input
              type="text"
              readOnly
              className={clsx(getInputClass(errors.sku), "uppercase bg-slate-50 dark:bg-dark-surface/50 cursor-not-allowed")}
              placeholder="GEN-AUTO-001"
              value="AUTO-GENERATED"
            />
          </div>

          {/* Stock Level */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              Initial Stock Level *
            </label>
            <input
              type="number"
              min="0"
              {...register("stock_level")}
              className={getInputClass(errors.stock_level)}
            />
            {errors.stock_level && (
              <p className="mt-1 text-sm text-red-500">{errors.stock_level.message}</p>
            )}
          </div>

          {/* Min Stock Level */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              Alert Stock Level *
            </label>
            <input
              type="number"
              min="0"
              {...register("min_stock_level")}
              className={getInputClass(errors.min_stock_level)}
              placeholder="e.g. 10"
            />
            {errors.min_stock_level && (
              <p className="mt-1 text-sm text-red-500">{errors.min_stock_level.message}</p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              Status Tracking *
            </label>
            <select {...register("status")} className={getInputClass(errors.status)}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-500">{errors.status.message}</p>
            )}
          </div>

          {/* Cost Price */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Cost Price (₱)
            </label>
            <input
                type="text"
                value={costPriceDisplay}
                onChange={(e) => {
                let raw = e.target.value.replace(/,/g, ""); 
                if (/^\d*\.?\d*$/.test(raw)) {
                    setCostPriceDisplay(
                        raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""
                    );
                    setValue("price", raw === "" ? "" : parseFloat(raw), { shouldValidate: true });
                }
                }}
                className={getInputClass(errors.price)}
                placeholder="0.00"
            />
            {errors.price && (
                <p className="mt-1 text-sm text-red-500">{errors.price.message}</p>
            )}
            </div>

          {/* Selling Price */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Selling Price (₱) *</span>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-tight">For Invoice</span>
            </label>
            <input
                type="text"
                value={sellingPriceDisplay}
                onChange={(e) => {
                let raw = e.target.value.replace(/,/g, ""); 
                if (/^\d*\.?\d*$/.test(raw)) {
                    setSellingPriceDisplay(
                        raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""
                    );
                    setValue("selling_price", raw === "" ? "" : parseFloat(raw), { shouldValidate: true });
                }
                }}
                className={getInputClass(errors.selling_price)}
                placeholder="0.00"
            />
            {errors.selling_price && (
                <p className="mt-1 text-sm text-red-500">{errors.selling_price.message}</p>
            )}
          </div>

          {/* Billing & Logic Flags */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-dark-border dark:bg-dark-surface/30">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  {...register("is_billable")} 
                  className="peer h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Billable?</span>
                <span className="text-[10px] text-slate-500">Show in invoices</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  {...register("is_consumable")} 
                  className="peer h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Consumable?</span>
                <span className="text-[10px] text-slate-500">Used in treatment</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  {...register("deduct_on_finalize")} 
                  className="peer h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Auto-Deduct?</span>
                <span className="text-[10px] text-slate-500">Deduct on finalize</span>
              </div>
            </label>
          </div>

          {/* Expiration Date */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
              Expiration Date
            </label>
            <input
              type="date"
              {...register("expiration_date")}
              className={getInputClass(errors.expiration_date)}
            />
            {errors.expiration_date && (
              <p className="mt-1 text-sm text-red-500">{errors.expiration_date.message}</p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none dark:text-zinc-400 dark:hover:bg-dark-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none disabled:opacity-50"
          >
            {isSubmitting ? (
              "Saving..."
            ) : (
              <>
                <FiCheckCircle className="h-4 w-4" />
                Save Item
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  </div>
    );
}

