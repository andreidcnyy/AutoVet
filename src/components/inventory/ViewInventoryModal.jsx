import { FiX, FiTrash2 } from "react-icons/fi";
import clsx from "clsx";

const statusStyles = {
    "Low Stock": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    "In Stock": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    Expiring: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function ViewInventoryModal({ isOpen, onClose, product, onDeleteRequest }) {
    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-card dark:shadow-dark-soft">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-dark-border">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-50">Product Details</h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:text-zinc-500 dark:hover:bg-dark-surface dark:hover:text-zinc-300"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">{product.item_name}</h2>
                            <p className="text-sm text-slate-500 dark:text-zinc-400">{product.sub_details || "No sub details provided."}</p>
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
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Category</p>
                            <p className="font-semibold text-slate-800 dark:text-zinc-200">{product.category}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">SKU</p>
                            <p className="font-semibold text-slate-800 dark:text-zinc-200">{product.sku}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Stock Level</p>
                            <p className="font-semibold text-slate-800 dark:text-zinc-200">{product.stock_level} units</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Price</p>
                            <p className="font-semibold text-slate-800 dark:text-zinc-200">{product.price ? `$${Number(product.price).toFixed(2)}` : "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Supplier</p>
                            <p className="font-semibold text-slate-800 dark:text-zinc-200">{product.supplier || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Expiration Date</p>
                            <p className="font-semibold text-slate-800 dark:text-zinc-200">{product.expiration_date || "N/A"}</p>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-between gap-3 border-t border-slate-100 pt-6 dark:border-dark-border">
                        <button
                            onClick={() => onDeleteRequest(product)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 focus:outline-none dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30"
                        >
                            <FiTrash2 className="h-4 w-4" />
                            Delete Product
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
