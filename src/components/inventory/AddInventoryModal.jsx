import { useState } from "react";
import { FiX, FiCheckCircle } from "react-icons/fi";

const CATEGORY_OPTIONS = ["Vaccines", "Antibiotics", "Supplies", "Diagnostics"];
const STATUS_OPTIONS = ["In Stock", "Low Stock", "Expiring"];

export default function AddInventoryModal({ isOpen, onClose, onSave }) {
    const [formData, setFormData] = useState({
        item_name: "",
        sub_details: "",
        category: "Vaccines",
        sku: "",
        stock_level: 0,
        status: "In Stock",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorData, setErrorData] = useState(null);

    if (!isOpen) return null;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "stock_level" ? Number(value) : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorData(null);

        try {
            const response = await fetch("/api/inventory", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to save inventory item.");
            }

            const savedItem = await response.json();
            onSave(savedItem);

            // Reset form after successful save
            setFormData({
                item_name: "",
                sub_details: "",
                category: "Vaccines",
                sku: "",
                stock_level: 0,
                status: "In Stock",
            });
            onClose();
        } catch (err) {
            setErrorData(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-card dark:shadow-dark-soft">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-dark-border">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-50">Add New Inventory Item</h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:text-zinc-500 dark:hover:bg-dark-surface dark:hover:text-zinc-300"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {errorData && (
                        <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            <p className="font-semibold">Submission Error</p>
                            <p>{errorData}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Item Name *</label>
                            <input
                                required
                                type="text"
                                name="item_name"
                                value={formData.item_name}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-blue-500"
                                placeholder="e.g. Parvovirus Vaccine"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Sub Details</label>
                            <input
                                type="text"
                                name="sub_details"
                                value={formData.sub_details}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-blue-500"
                                placeholder="e.g. 10ml Vial"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Category *</label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:focus:border-blue-500"
                            >
                                {CATEGORY_OPTIONS.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Unique SKU *</label>
                            <input
                                required
                                type="text"
                                name="sku"
                                value={formData.sku}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm uppercase text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:focus:border-blue-500"
                                placeholder="e.g. VAC-PAR-01"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Initial Stock Level *</label>
                            <input
                                required
                                type="number"
                                name="stock_level"
                                min="0"
                                value={formData.stock_level}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Status Tracking *</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleInputChange}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:focus:border-blue-500"
                            >
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

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
