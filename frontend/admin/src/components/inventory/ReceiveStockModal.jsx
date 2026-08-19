import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiX, FiCheckCircle, FiPackage, FiArrowDown } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import api from "../../api";

const receiveSchema = z.object({
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  batch_number: z.string().min(1, "Batch number is required").max(100),
  lot_number: z.string().max(100).optional().or(z.literal("")),
  expiration_date: z.string().optional().or(z.literal("")),
  price: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  selling_price: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  supplier: z.string().max(255).optional().or(z.literal("")),
  remarks: z.string().max(255).optional().or(z.literal("")),
});

export default function ReceiveStockModal({ isOpen, onClose, product, onReceived }) {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(receiveSchema),
    defaultValues: {
      quantity: 1,
      batch_number: "",
      lot_number: "",
      expiration_date: "",
      price: "",
      selling_price: "",
      supplier: "",
      remarks: "",
    },
  });

  // Show the product's existing batches in the order FIFO will consume them,
  // so it is obvious what this delivery is being added behind.
  useEffect(() => {
    if (!isOpen || !product?.id) return;
    setLoadingBatches(true);
    api
      .get(`/api/inventory/${product.id}/batches`)
      .then((data) => setBatches(data?.batches || []))
      .catch(() => setBatches([]))
      .finally(() => setLoadingBatches(false));
  }, [isOpen, product?.id]);

  useEffect(() => {
    if (isOpen) {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      reset({
        quantity: 1,
        batch_number: `BATCH-${stamp}-${Math.floor(100 + Math.random() * 900)}`,
        lot_number: "",
        expiration_date: "",
        price: "",
        selling_price: "",
        supplier: product?.supplier || "",
        remarks: "",
      });
    }
  }, [isOpen, product?.id, reset]);

  if (!isOpen || !product) return null;

  const onSubmit = async (data) => {
    try {
      // Blank optional numerics must be omitted, not sent as "".
      const payload = { ...data };
      ["price", "selling_price", "expiration_date", "lot_number", "supplier", "remarks"].forEach((k) => {
        if (payload[k] === "" || payload[k] == null) delete payload[k];
      });

      const saved = await api.post(`/api/inventory/${product.id}/receive`, payload);
      toast.success(`Received ${data.quantity} units as batch ${data.batch_number}.`);
      onReceived?.(saved);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to receive stock.");
    }
  };

  const inputBase =
    "w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 transition-colors focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500";
  const getInputClass = (error) =>
    clsx(
      inputBase,
      error
        ? "border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500/50"
        : "border-zinc-200 focus:border-emerald-500 dark:border-dark-border"
    );

  const totalStock = batches.reduce((sum, b) => sum + Number(b.stock_level || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70 overflow-y-auto">
      <div className="my-auto flex w-full max-w-3xl flex-col max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-card">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <FiPackage className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-50">Receive Stock</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Adds a new batch of <span className="font-bold">{product.item_name}</span> — existing stock is used up first
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-dark-surface"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Existing batches, in consumption order */}
            <div className="rounded-xl border border-zinc-100 dark:border-dark-border overflow-hidden">
              <div className="flex items-center justify-between bg-zinc-50 px-4 py-2.5 dark:bg-dark-surface border-b border-zinc-100 dark:border-dark-border">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Current batches — consumed top to bottom
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Total: {totalStock}
                </p>
              </div>
              {loadingBatches ? (
                <p className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Loading…</p>
              ) : batches.length === 0 ? (
                <p className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-zinc-400">No batches yet</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-dark-border">
                  {batches.map((b, i) => (
                    <li key={b.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase text-zinc-400 w-4">{i + 1}</span>
                        <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase">
                          {b.batch_number || "No batch"}
                        </span>
                        {b.expiration_date && (
                          <span className="text-[9px] font-bold uppercase text-zinc-400">
                            exp {new Date(b.expiration_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span
                        className={clsx(
                          "text-xs font-black",
                          Number(b.stock_level) <= 0 ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-800 dark:text-zinc-200"
                        )}
                      >
                        {Number(b.stock_level) <= 0 ? "empty" : `${b.stock_level} ${product.unit || "pcs"}`}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 bg-emerald-50/50 px-4 py-2.5 dark:bg-emerald-900/10">
                    <FiArrowDown className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                      New batch goes here — used last
                    </span>
                  </li>
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Quantity Received *</label>
                <input type="number" min="1" {...register("quantity")} className={getInputClass(errors.quantity)} />
                {errors.quantity && <p className="mt-1 text-xs text-red-500">{errors.quantity.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Batch # *</label>
                <input type="text" {...register("batch_number")} className={getInputClass(errors.batch_number)} placeholder="BATCH-001" />
                {errors.batch_number && <p className="mt-1 text-xs text-red-500">{errors.batch_number.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Lot #</label>
                <input type="text" {...register("lot_number")} className={getInputClass(errors.lot_number)} placeholder="LOT-123" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Expiration Date</label>
                <input type="date" {...register("expiration_date")} className={getInputClass(errors.expiration_date)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Buying Price (₱)
                  <span className="ml-1 text-xs font-normal text-zinc-400">— blank keeps current</span>
                </label>
                <input type="number" step="0.01" min="0" {...register("price")} className={getInputClass(errors.price)} placeholder={product.price ?? "0.00"} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Selling Price (₱)
                  <span className="ml-1 text-xs font-normal text-zinc-400">— blank keeps current</span>
                </label>
                <input type="number" step="0.01" min="0" {...register("selling_price")} className={getInputClass(errors.selling_price)} placeholder={product.selling_price ?? "0.00"} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Supplier</label>
                <input type="text" {...register("supplier")} className={getInputClass(errors.supplier)} placeholder="Supplier name" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Remarks</label>
                <input type="text" {...register("remarks")} className={getInputClass(errors.remarks)} placeholder="e.g. PO #1234" />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-zinc-100 bg-zinc-50 px-6 py-4 dark:border-dark-border dark:bg-dark-card/90">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-dark-surface">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-2.5 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {isSubmitting ? "Saving…" : <><FiCheckCircle className="h-4 w-4" /> Receive Batch</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
