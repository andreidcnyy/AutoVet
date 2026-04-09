import { useState, useEffect } from "react";
import { FiX, FiCheckCircle, FiInfo, FiCheck } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";

const UNIT_OPTIONS = ["", "piece", "vial", "bottle", "tablet", "pack", "box", "dose", "ml", "sachet", "tube"];

const inventorySchema = z.object({
  inventory_category_id: z.coerce.number().min(1, "Category is required"),
  item_name: z.string().min(1, "Item name is required").max(255),
  stock_level: z.coerce.number().min(0, "Quantity must be 0 or more"),
  unit: z.string().min(1, "Unit is required"),
  min_stock_level: z.coerce.number().min(0, "Alert threshold must be 0 or more"),
  
  price: z.coerce.number().min(0, "Price must be 0 or more").optional().or(z.literal("")),
  selling_price: z.coerce.number().min(0, "Selling price is required").optional().or(z.literal("")),
  
  is_billable: z.boolean().default(true),
  is_consumable: z.boolean().default(false),
  deduct_on_finalize: z.boolean().default(true),
  track_expiration: z.boolean().default(false),
  expiration_date: z.string().optional().or(z.literal("")),
  
  // Kept for backward compatibility but optional/defaulted
  supplier: z.string().optional().default("Other"),
  sku: z.string().max(255).optional(),
  sub_details: z.string().max(255).optional(),
  status: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.track_expiration && !data.expiration_date) {
    ctx.addIssue({
      path: ["expiration_date"],
      message: "Expiration Date is required when Track Expiration is enabled",
      code: z.ZodIssueCode.custom,
    });
  }
  if (data.selling_price === "" || data.selling_price === undefined || data.selling_price === null) {
      ctx.addIssue({
          path: ["selling_price"],
          message: "Selling price is required",
          code: z.ZodIssueCode.custom
      });
  }
});

export default function AddInventoryModal({ isOpen, onClose, onSave }) {
  const toast = useToast();
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [costPriceDisplay, setCostPriceDisplay] = useState("");
  const [sellingPriceDisplay, setSellingPriceDisplay] = useState("");
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      inventory_category_id: "",
      item_name: "",
      stock_level: 0,
      unit: "",
      min_stock_level: 10,
      price: "",
      selling_price: "",
      is_billable: true,
      is_consumable: false,
      deduct_on_finalize: true,
      track_expiration: false,
      expiration_date: "",
      supplier: "Other",
      sku: "",
      sub_details: "",
      status: "In Stock"
    },
  });

  const watchCategory = watch("inventory_category_id");
  const watchTrackExpiration = watch("track_expiration");
  const initialStock = watch("stock_level") || 0;
  const alertThreshold = watch("min_stock_level") || 0;
  const watchBillable = watch("is_billable");
  const watchConsumable = watch("is_consumable");
  const watchAutoDeduct = watch("deduct_on_finalize");

  useEffect(() => {
    if (isOpen && user?.token) {
      fetch("/api/inventory-categories?per_page=1000", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          let categories = [];
          if (Array.isArray(data)) {
            categories = data;
          } else if (data && Array.isArray(data.data)) {
            categories = data.data;
          }
          const activeCategories = categories.filter(
            (c) => c.status === "Active" || c.status === "active"
          );
          setCategoryOptions(activeCategories);
        })
        .catch(console.error);
    }
  }, [isOpen, user?.token]);

  useEffect(() => {
    if (watchCategory && categoryOptions.length > 0) {
      const cat = categoryOptions.find((c) => c.id == watchCategory);
      if (cat && cat.name) {
        const name = cat.name.toLowerCase();
        if (name.includes("vaccin")) {
          setValue("unit", "dose");
          setValue("track_expiration", true);
          setValue("is_billable", true);
          setValue("is_consumable", true);
          setValue("deduct_on_finalize", true);
        } else if (name.includes("medicin")) {
          setValue("track_expiration", true);
        } else if (name.includes("supplies")) {
          setValue("track_expiration", false);
        } else if (name.includes("retail")) {
          setValue("is_billable", true);
          setValue("deduct_on_finalize", true);
        }
      }
    }
  }, [watchCategory, categoryOptions, setValue]);

  let stockStatus = "Out of Stock";
  let stockStatusColor = "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400";
  let highThresholdWarning = false;

  if (initialStock == 0) {
    stockStatus = "Out of Stock";
    stockStatusColor = "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400";
  } else if (initialStock > 0 && initialStock <= alertThreshold) {
    stockStatus = "Low Stock";
    stockStatusColor = "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400";
  } else {
    stockStatus = "In Stock";
    stockStatusColor = "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400";
  }

  if (initialStock > 0 && alertThreshold >= initialStock * 0.9) {
      highThresholdWarning = true;
  }

  useEffect(() => {
      setValue("status", stockStatus);
  }, [stockStatus, setValue]);

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${user?.token}`,
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
      setCostPriceDisplay("");
      setSellingPriceDisplay("");
      onClose();
    } catch (err) {
      toast.error(err.message || "An error occurred while saving.");
    }
  };

  const inputBase =
    "w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition-colors focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:bg-dark-surface/80 dark:focus:border-blue-500";
  const getInputClass = (error) =>
    clsx(
      inputBase,
      error
        ? "border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/50"
        : "border-slate-200 focus:border-blue-500 dark:border-dark-border"
    );

  const SectionHeading = ({ children }) => (
    <div className="mb-4 mt-6 first:mt-0">
      <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
        {children}
      </h4>
      <div className="mt-1.5 h-px w-full bg-slate-100 dark:bg-dark-border/50"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70">
      <div className="flex w-full max-w-5xl flex-col max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-card dark:shadow-dark-soft">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-dark-border">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-50">
              Add New Inventory Item
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              Define parameters for clinical stock management
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:text-zinc-500 dark:hover:bg-dark-surface dark:hover:text-zinc-300"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden h-full">
          <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2">
            
            <div className="border-r border-slate-100 p-6 dark:border-dark-border">
              
              <SectionHeading>A. Item Information</SectionHeading>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    {...register("item_name")}
                    className={getInputClass(errors.item_name)}
                    placeholder="e.g., Meloxicam Oral Suspension"
                  />
                  {errors.item_name && <p className="mt-1 text-xs text-red-500">{errors.item_name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                      Category *
                    </label>
                    <select {...register("inventory_category_id")} className={getInputClass(errors.inventory_category_id)}>
                      <option value="" disabled>Select category</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {errors.inventory_category_id && <p className="mt-1 text-xs text-red-500">{errors.inventory_category_id.message}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                      Unit *
                    </label>
                    <select {...register("unit")} className={getInputClass(errors.unit)}>
                      <option value="" disabled>Select unit</option>
                      {UNIT_OPTIONS.filter(Boolean).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {errors.unit && <p className="mt-1 text-xs text-red-500">{errors.unit.message}</p>}
                  </div>
                </div>
              </div>

              <SectionHeading>B. Inventory & Expiration</SectionHeading>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...register("stock_level")}
                    className={getInputClass(errors.stock_level)}
                  />
                  {errors.stock_level && <p className="mt-1 text-xs text-red-500">{errors.stock_level.message}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Alert Threshold *
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...register("min_stock_level")}
                    className={getInputClass(errors.min_stock_level)}
                  />
                  {errors.min_stock_level && <p className="mt-1 text-xs text-red-500">{errors.min_stock_level.message}</p>}
                </div>

                <div className="flex items-center col-span-2 pt-2">
                   <label className="flex cursor-pointer items-center gap-3">
                      <div className="relative">
                        <input type="checkbox" className="peer sr-only" {...register("track_expiration")} />
                        <div className="block h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 dark:bg-dark-surface"></div>
                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Track Expiration</span>
                      </div>
                    </label>
                </div>

                {watchTrackExpiration && (
                  <div className="col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                      Expiration Date *
                    </label>
                    <input
                      type="date"
                      {...register("expiration_date")}
                      className={getInputClass(errors.expiration_date)}
                    />
                    {errors.expiration_date && <p className="mt-1 text-xs text-red-500">{errors.expiration_date.message}</p>}
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface/40">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Stock Status Preview</span>
                    {highThresholdWarning && (
                        <p className="text-[11px] text-amber-500 mt-0.5 flex items-center gap-1">
                            <FiInfo className="h-3 w-3" /> Threshold exceeds/matches qty.
                        </p>
                    )}
                  </div>
                  <div className={clsx("flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide", stockStatusColor)}>
                    {stockStatus}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 dark:bg-zinc-900/30">
              
              <SectionHeading>C. Financials</SectionHeading>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Selling Price (₱) *
                  </label>
                  <input
                    type="text"
                    value={sellingPriceDisplay}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/,/g, "");
                      if (/^\d*\.?\d*$/.test(raw)) {
                        setSellingPriceDisplay(raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "");
                        setValue("selling_price", raw === "" ? "" : parseFloat(raw), { shouldValidate: true });
                      }
                    }}
                    className={getInputClass(errors.selling_price)}
                    placeholder="0.00"
                  />
                  {errors.selling_price && <p className="mt-1 text-xs text-red-500">{errors.selling_price.message}</p>}
                </div>

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
                        setCostPriceDisplay(raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "");
                        setValue("price", raw === "" ? "" : parseFloat(raw), { shouldValidate: true });
                      }
                    }}
                    className={getInputClass(errors.price)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <SectionHeading>D. Usage Settings</SectionHeading>
              <p className="mb-4 text-xs text-slate-500 dark:text-zinc-400">
                Determines how the item interacts with invoices and treatments.
              </p>
              
              <div className="space-y-3">
                <label className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  watchBillable ? "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20" : "border-slate-200 bg-white dark:border-dark-border dark:bg-dark-surface/50"
                )}>
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      {...register("is_billable")}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Billable</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">Item appears on client invoices</span>
                  </div>
                </label>

                <label className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  watchConsumable ? "border-indigo-200 bg-indigo-50 dark:border-indigo-900/40 dark:bg-indigo-900/20" : "border-slate-200 bg-white dark:border-dark-border dark:bg-dark-surface/50"
                )}>
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      {...register("is_consumable")}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Consumable</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">Item is consumed during treatments</span>
                  </div>
                </label>

                <label className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  watchAutoDeduct ? "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20" : "border-slate-200 bg-white dark:border-dark-border dark:bg-dark-surface/50"
                )}>
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      {...register("deduct_on_finalize")}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Auto-Deduct Stock</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">Automatic stock reduction</span>
                  </div>
                </label>
              </div>

              {/* Simple Preview Widget */}
              <div className="mt-6 rounded-2xl bg-slate-900 p-4 shadow-xl">
                 <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Preview</p>
                 <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-col">
                       <span className="text-lg font-bold text-white leading-tight">₱{sellingPriceDisplay || "0.00"}</span>
                       <span className="text-xs text-slate-400">Retail Price</span>
                    </div>
                    <div className="h-8 w-px bg-slate-800"></div>
                    <div className="flex flex-col items-end">
                       <span className="text-lg font-bold text-white leading-tight">{initialStock} {watch("unit") || "units"}</span>
                       <span className="text-xs text-slate-400">Initial Total</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          {/* ================= MODAL FOOTER ================= */}
          <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-dark-border dark:bg-dark-card/90 pb-safe">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 focus:outline-none dark:text-zinc-300 dark:hover:bg-dark-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-dark-card"
            >
              {isSubmitting ? "Saving..." : <><FiCheckCircle className="h-4 w-4" /> Save Item</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Small helper component for Profile rows
function ProfileRow({ label, description, active }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{label}</span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-500">{description}</span>
            </div>
            {active ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <FiCheck className="h-3 w-3" />
                </div>
            ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-dark-surface dark:text-zinc-600">
                    <FiX className="h-3 w-3" />
                </div>
            )}
        </div>
    );
}
