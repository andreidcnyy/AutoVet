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
  code: z.string().min(1, "Unique code is required for AI forecasting").max(100),
  stock_level: z.coerce.number().min(0, "Quantity must be 0 or more"),
  unit: z.string().min(1, "Unit is required"),
  min_stock_level: z.coerce.number().min(0, "Alert threshold must be 0 or more"),
  
  price: z.coerce.number().min(0.01, "Buying price is required"),
  selling_price: z.coerce.number().min(0.01, "Selling price is required"),
  
  expiration_date: z.string().optional().or(z.literal("")),
  
  // Defaults set for standard behavior (Hidden from UI)
  is_billable: z.boolean().default(true),
  is_consumable: z.boolean().default(false),
  deduct_on_finalize: z.boolean().default(true),
  track_expiration: z.boolean().default(true),
  
  supplier: z.string().optional().default("Other"),
  sku: z.string().max(255).optional(),
  sub_details: z.string().max(255).optional(),
  status: z.string().optional(),
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
      code: "",
      stock_level: 0,
      unit: "",
      min_stock_level: 10,
      price: "",
      selling_price: "",
      is_billable: true,
      is_consumable: false,
      deduct_on_finalize: true,
      track_expiration: true,
      expiration_date: "",
      supplier: "Other",
      sku: "",
      sub_details: "",
      status: "In Stock"
    },
  });

  const initialStock = watch("stock_level") || 0;
  const alertThreshold = watch("min_stock_level") || 0;

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
    "w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 transition-colors focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:bg-dark-surface/80 dark:focus:border-emerald-500";
  const getInputClass = (error) =>
    clsx(
      inputBase,
      error
        ? "border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/50"
        : "border-zinc-200 focus:border-emerald-500 dark:border-dark-border"
    );

  const SectionHeading = ({ children }) => (
    <div className="mb-4 mt-6 first:mt-0">
      <h4 className="text-[13px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {children}
      </h4>
      <div className="mt-1.5 h-px w-full bg-zinc-100 dark:bg-dark-border/50"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70 overflow-y-auto">
      <div className="my-auto flex w-full max-w-5xl flex-col max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-card dark:shadow-dark-soft">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-dark-border">
          <div>
            <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-50">
              Add New Inventory Item
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Define parameters for clinical stock management
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none dark:text-zinc-500 dark:hover:bg-dark-surface dark:hover:text-zinc-300"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden h-full">
          <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2">
            
            <div className="border-r border-zinc-100 p-6 dark:border-dark-border">
              <SectionHeading>A. Item Information</SectionHeading>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Item Name *</label>
                        <input type="text" {...register("item_name")} className={getInputClass(errors.item_name)} placeholder="e.g., Meloxicam" />
                        {errors.item_name && <p className="mt-1 text-xs text-red-500">{errors.item_name.message}</p>}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Item Code *</label>
                        <input type="text" {...register("code")} className={getInputClass(errors.code)} placeholder="e.g., MED-001" />
                        {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Category *</label>
                    <select {...register("inventory_category_id")} className={getInputClass(errors.inventory_category_id)}>
                      <option value="" disabled>Select category</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Unit *</label>
                    <select {...register("unit")} className={getInputClass(errors.unit)}>
                      <option value="" disabled>Select unit</option>
                      {UNIT_OPTIONS.filter(Boolean).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <SectionHeading>B. Stock & Expiration</SectionHeading>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Initial Quantity *</label>
                  <input type="number" min="0" {...register("stock_level")} className={getInputClass(errors.stock_level)} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Expiration Date</label>
                  <input type="date" {...register("expiration_date")} className={getInputClass(errors.expiration_date)} />
                  {errors.expiration_date && <p className="mt-1 text-xs text-red-500">{errors.expiration_date.message}</p>}
                </div>
              </div>
            </div>

            <div className="p-6 bg-zinc-50/50 dark:bg-zinc-900/30">
              <SectionHeading>C. Financials</SectionHeading>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Buying Price (₱) *</label>
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
                  {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Selling Price (₱) *</label>
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
              </div>

              <div className="mt-12 rounded-2xl bg-zinc-900 p-6 shadow-xl">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Clinical Preview</p>
                 <div className="mt-4 flex items-center justify-between">
                    <div className="flex flex-col">
                       <span className="text-2xl font-black text-white leading-tight">₱{sellingPriceDisplay || "0.00"}</span>
                       <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Retail Price</span>
                    </div>
                    <div className="h-10 w-px bg-zinc-800"></div>
                    <div className="flex flex-col items-end">
                       <span className="text-2xl font-black text-white leading-tight">{initialStock} {watch("unit") || "units"}</span>
                       <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">In Stock</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-zinc-100 bg-zinc-50 px-6 py-4 dark:border-dark-border dark:bg-dark-card/90 pb-safe">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-dark-surface">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-2.5 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20">
              {isSubmitting ? "Syncing..." : <><FiCheckCircle className="h-4 w-4" /> Save Item</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
