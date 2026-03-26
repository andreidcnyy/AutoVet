import { useState, useEffect } from "react";
import clsx from "clsx";
import { FiX, FiAlertCircle } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../context/ToastContext";

const inputBase =
    "h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800";

const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-300 dark:border-dark-border");

const ownerSchema = z.object({
    name: z.string().min(1, "Owner name is required").max(255),
    phone: z.string().max(255).optional().or(z.literal("")),
    email: z.string().email("Invalid email address").max(255).optional().or(z.literal("")),
    address: z.string().max(255).optional().or(z.literal("")),
    city: z.string().max(255).optional().or(z.literal("")),
    province: z.string().max(255).optional().or(z.literal("")),
    zip: z.string().max(255).optional().or(z.literal("")),
});

function EditOwnerModal({ isOpen, onClose, owner, onSaveSuccess }) {
    const toast = useToast();
    const [error, setError] = useState(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(ownerSchema),
        defaultValues: {
            name: "",
            phone: "",
            email: "",
            address: "",
            city: "",
            province: "",
            zip: "",
        }
    });

    useEffect(() => {
        if (owner && isOpen) {
            reset({
                name: owner.name || "",
                phone: owner.phone || "",
                email: owner.email || "",
                address: owner.address || "",
                city: owner.city || "",
                province: owner.province || "",
                zip: owner.zip || "",
            });
            setError(null);
        }
    }, [owner, isOpen, reset]);

    if (!isOpen || !owner) return null;

    const onSubmit = async (data) => {
        setError(null);
        try {
            const response = await fetch(`/api/owners/${owner.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || "Failed to update owner details.");
            }

            const updatedOwner = await response.json();
            toast.success("Owner details updated successfully!");
            onSaveSuccess(updatedOwner);
            onClose();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-dark-card border dark:border-dark-border">
                <div className="flex items-center justify-between border-b px-6 py-4 dark:border-dark-border">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Edit Owner Details</h2>
                    <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-surface">
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6">
                    {error && (
                        <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                            <FiAlertCircle className="h-5 w-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form id="edit-owner-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Full Name *</label>
                            <input {...register("name")} className={getInputClass(errors.name)} placeholder="e.g. Maria Clara" />
                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Phone</label>
                                <input {...register("phone")} className={getInputClass(errors.phone)} placeholder="0917..." />
                                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Email</label>
                                <input type="email" {...register("email")} className={getInputClass(errors.email)} placeholder="email@example.com" />
                                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Street Address</label>
                            <input {...register("address")} className={getInputClass(errors.address)} placeholder="123 Street..." />
                            {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-1">
                                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">City</label>
                                <input {...register("city")} className={getInputClass(errors.city)} placeholder="City" />
                            </div>
                            <div className="sm:col-span-1">
                                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Province</label>
                                <input {...register("province")} className={getInputClass(errors.province)} placeholder="Province" />
                            </div>
                            <div className="sm:col-span-1">
                                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Zip</label>
                                <input {...register("zip")} className={getInputClass(errors.zip)} placeholder="Zip" />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="border-t bg-slate-50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200">
                        Cancel
                    </button>
                    <button type="submit" form="edit-owner-form" disabled={isSubmitting} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EditOwnerModal;
