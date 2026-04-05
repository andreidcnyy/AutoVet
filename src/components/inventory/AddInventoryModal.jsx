import { useState, useEffect } from "react";
import { FiX, FiCheckCircle, FiInfo, FiCheck } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";

const UNIT_OPTIONS = ["", "piece", "vial", "bottle", "tablet", "pack", "box", "dose", "ml", "sachet", "tube"];
const STORAGE_OPTIONS = ["", "Room Temp", "Refrigerated", "Frozen"];
const SUPPLIER_OPTIONS = ["", "Zoetis", "Virbac", "MSD", "Boehringer", "Elanco", "Other"];

const inventorySchema = z.object({
  inventory_category_id: z.coerce.number().min(1, "Category is required"),
  supplier: z.string().min(1, "Supplier is required"),
  item_name: z.string().min(1, "Item name is required for clinical records").max(255),
  sub_details: z.string().max(255).optional(),
  sku: z.string().max(255).optional(),
  stock_level: z.coerce.number().min(0, "Initial stock must be 0 or more"),
  unit: z.string().min(1, "Unit is required"),
  min_stock_level: z.coerce.number().min(0, "Alert threshold must be 0 or more"),
  reorder_quantity: z.coerce.number().optional().or(z.literal("")),
  batch_lot_number: z.string().max(255).optional(),
  
  price: z.coerce.number().min(0, "Cost price must be 0 or more").optional().or(z.literal("")),
  selling_price: z.coerce.number().min(0, "Selling price must be 0 or more").optional().or(z.literal("")),
  
  is_billable: z.boolean().default(true),
  is_consumable: z.boolean().default(false),
  deduct_on_finalize: z.boolean().default(true),
  track_expiration: z.boolean().default(false),
  expiration_date: z.string().optional().or(z.literal("")),
  storage_requirement: z.string().optional(),
  
  status: z.string().optional(), // For backend compat
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
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      inventory_category_id: "",
      supplier: "",
      item_name: "",
      sub_details: "",
      sku: "",
      stock_level: 0,
      unit: "",
      min_stock_level: 10,
      reorder_quantity: "",
      batch_lot_number: "",
      price: "",
      selling_price: "",
      is_billable: true,
      is_consumable: false,
      deduct_on_finalize: true,
      track_expiration: false,
      expiration_date: "",
      storage_requirement: "",
      status: "In Stock" // Backend compat
    },
  });

  const watchCategory = watch("inventory_category_id");
  const watchTrackExpiration = watch("track_expiration");
  const initialStock = watch("stock_level") || 0;
  const alertThreshold = watch("min_stock_level") || 0;
  const watchBillable = watch("is_billable");
  const watchConsumable = watch("is_consumable");
  const watchAutoDeduct = watch("deduct_on_finalize");

  // Fetch categories
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

  // Smart Form Behavior defaults
  useEffect(() => {
    if (watchCategory && categoryOptions.length > 0) {
      const cat = categoryOptions.find((c) => c.id == watchCategory);
      if (cat && cat.name) {
        const name = cat.name.toLowerCase();
        if (name.includes("vaccin")) {
          setValue("unit", "dose");
          setValue("track_expiration", true);
          setValue("storage_requirement", "Refrigerated");
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

  // Computed Stock Status
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

  // Subtle warning if threshold is unusually high
  if (initialStock > 0 && alertThreshold >= initialStock * 0.9) {
      highThresholdWarning = true;
  }

  // Inject backend compat status
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
        {/* MODAL HEADER */}
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

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden h-full">
          <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2">
            
            {/* ================= LEFT COLUMN ================= */}
            <div className="border-r border-slate-100 p-6 dark:border-dark-border">
              
              <SectionHeading>A. Basic Information</SectionHeading>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    Supplier *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="supplier-options"
                      {...register("supplier")}
                      className={getInputClass(errors.supplier)}
                      placeholder="e.g. Zoetis"
                    />
                    <datalist id="supplier-options">
                        {SUPPLIER_OPTIONS.filter(Boolean).map(opt => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>
                  {errors.supplier && <p className="mt-1 text-xs text-red-500">{errors.supplier.message}</p>}
                </div>

                <div className="sm:col-span-2">
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

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Sub Details
                  </label>
                  <input
                    type="text"
                    {...register("sub_details")}
                    className={getInputClass(errors.sub_details)}
                    placeholder="e.g., 10ml vial"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-500 dark:text-zinc-400">
                    SKU
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500 opacity-80 dark:border-dark-border dark:bg-dark-surface/50 dark:text-zinc-500"
                    placeholder="AUTO-GENERATED"
                  />
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
                    Automatically generated unique identifier for this item
                  </p>
                </div>
              </div>

              <SectionHeading>B. Inventory Details</SectionHeading>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Initial Stock *
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
                    Unit *
                  </label>
                  <select {...register("unit")} className={getInputClass(errors.unit)}>
                    <option value="" disabled>Select unit</option>
                    {UNIT_OPTIONS.filter(Boolean).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {errors.unit && <p className="mt-1 text-xs text-red-500">{errors.unit.message}</p>}
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

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Reorder Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...register("reorder_quantity")}
                    className={getInputClass(errors.reorder_quantity)}
                    placeholder="Optional"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Batch / Lot Number
                  </label>
                  <input
                    type="text"
                    {...register("batch_lot_number")}
                    className={getInputClass(errors.batch_lot_number)}
                    placeholder="e.g., B-990-23"
                  />
                </div>

                {/* Computed Stock Preview */}
                <div className="sm:col-span-2 mt-2 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface/40">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Stock Status Preview</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-500">Based on current stock and alert threshold</span>
                    {highThresholdWarning && (
                        <span className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                            <FiInfo className="h-3 w-3" /> Alert threshold is close to or exceeds initial stock.
                        </span>
                    )}
                  </div>
                  <div className={clsx("flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide", stockStatusColor)}>
                    {stockStatus}
                  </div>
                </div>
              </div>

              <SectionHeading>C. Storage & Expiration</SectionHeading>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center sm:col-span-2">
                   <label className="flex cursor-pointer items-center gap-3">
                      <div className="relative">
                        <input type="checkbox" className="peer sr-only" {...register("track_expiration")} />
                        <div className="block h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 dark:bg-dark-surface"></div>
                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Track Expiration</span>
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">Recommended for medicines and vaccines</span>
                      </div>
                    </label>
                </div>

                {watchTrackExpiration && (
                  <div className="sm:col-span-2">
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

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Storage Requirement
                  </label>
                  <select {...register("storage_requirement")} className={getInputClass(errors.storage_requirement)}>
                    <option value="" disabled>Select requirement</option>
                    {STORAGE_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Important for temperature-sensitive items such as vaccines</p>
                </div>
              </div>
            </div>

            {/* ================= RIGHT COLUMN ================= */}
            <div className="p-6 bg-slate-50/50 dark:bg-zinc-900/30">
              
              <SectionHeading>D. Item Profile</SectionHeading>
              
              {/* Item Profile Readonly Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-surface/50">
                <div className="space-y-3">
                    <ProfileRow label="Billable" active={watchBillable} description="Included in invoice" />
                    <ProfileRow label="Consumable" active={watchConsumable} description="Used in treatment" />
                    <ProfileRow label="Auto-Deduct" active={watchAutoDeduct} description="Deducted after finalization" />
                    <ProfileRow label="Track Expiration" active={watchTrackExpiration} description="Expiration monitored" />
                </div>
              </div>

              <SectionHeading>E. Financials</SectionHeading>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    placeholder="0.00"
                  />
                </div>

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
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Required for invoice generation</p>
                  {errors.selling_price && <p className="mt-1 text-xs text-red-500">{errors.selling_price.message}</p>}
                </div>
              </div>

              <SectionHeading>F. Usage Behavior</SectionHeading>
              <div className="space-y-3">
                
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface/50 dark:hover:bg-dark-surface">
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      {...register("is_billable")}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:checked:border-blue-500 dark:checked:bg-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Billable Item</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">Charge this item directly to client invoices</span>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface/50 dark:hover:bg-dark-surface">
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      {...register("is_consumable")}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:checked:border-blue-500 dark:checked:bg-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Consumable</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">Item is consumed during treatment or procedure</span>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface/50 dark:hover:bg-dark-surface">
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      {...register("deduct_on_finalize")}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:checked:border-blue-500 dark:checked:bg-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Auto-Deduct Stock</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">Automatically deduct stock after treatment or invoice is finalized</span>
                  </div>
                </label>

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
