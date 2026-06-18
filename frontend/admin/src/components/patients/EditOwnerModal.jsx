import { useState, useEffect } from "react";
import clsx from "clsx";
import { FiX, FiAlertCircle, FiChevronDown, FiPhone, FiMap, FiMapPin, FiUser, FiMail } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { PH_LOCATION_DATA } from "../../utils/phLocationData";

const inputBase =
    "h-11 w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800";
const selectBase =
    "h-11 w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 focus:bg-white focus:outline-none appearance-none pr-10 dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800";

const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-emerald-300 dark:border-dark-border");
const getSelectClass = (error) => clsx(selectBase, error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-emerald-300 dark:border-dark-border");

const ownerSchema = z.object({
    name: z.string().min(1, "Owner name is required").max(255),
    phone: z.string().length(11, "Contact number must be exactly 11 digits"),
    email: z.string().email("Invalid email address").max(255).optional().or(z.literal("")),
    address: z.string().min(1, "Street address is required").max(255),
    city: z.string().min(1, "City is required").max(255),
    province: z.string().min(1, "Province is required").max(255),
    zip: z.string().max(255).optional().or(z.literal("")),
});

function EditOwnerModal({ isOpen, onClose, owner, onSaveSuccess }) {
    const toast = useToast();
    const { user } = useAuth();
    const [error, setError] = useState(null);
    const [availableCities, setAvailableCities] = useState([]);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
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

    const watchedProvince = watch("province");
    const watchedCity = watch("city");

    // Initialize/Reset form
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

    // Handle Province -> Cities mapping
    useEffect(() => {
        const provinceData = PH_LOCATION_DATA.find(p => p.name === watchedProvince);
        if (provinceData) {
            setAvailableCities(provinceData.cities);
        } else {
            setAvailableCities([]);
        }
        // If the current city is not in the new province's cities, reset it.
        // We only do this if province actually changed.
        if (watchedProvince && owner?.province && owner.province !== watchedProvince) {
            setValue("city", "");
            setValue("zip", "");
        }
    }, [watchedProvince, setValue, owner?.province]);

    // Handle City -> Zip mapping
    useEffect(() => {
        const cityData = availableCities.find(c => c.name === watchedCity);
        if (cityData) {
            setValue("zip", cityData.zip);
        }
    }, [watchedCity, availableCities, setValue]);

    if (!isOpen || !owner) return null;

    const onSubmit = async (data) => {
        setError(null);
        try {
            const response = await fetch(`/api/owners/${owner.id}`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json", 
                    "Accept": "application/json",
                    "Authorization": `Bearer ${user?.token}`
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                if (response.status === 422 && errData.errors) {
                    const messages = Object.values(errData.errors).flat().join(" ");
                    throw new Error(messages);
                }
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
            <div className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-dark-card border dark:border-dark-border animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b px-6 py-4 dark:border-dark-border">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Edit Owner Details</h2>
                    <button onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface">
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

                    <form id="edit-owner-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {/* Name */}
                        <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Full Name *</label>
                            <div className="relative">
                                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input {...register("name")} className={clsx(getInputClass(errors.name), "pl-10")} placeholder="e.g. Maria Clara" />
                            </div>
                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Contact Number */}
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Contact Number *</label>
                                <div className="flex gap-2">
                                    <div className="flex h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 px-2.5 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:border-dark-border">
                                        🇵🇭 +63
                                    </div>
                                    <input 
                                        {...register("phone")} 
                                        onChange={(e) => setValue("phone", e.target.value.replace(/\D/g, "").slice(0, 11), { shouldValidate: true })}
                                        className={getInputClass(errors.phone)} 
                                        maxLength={11}
                                        placeholder="09123456789"
                                    />
                                </div>
                                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Email Address</label>
                                <div className="relative">
                                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input type="email" {...register("email")} className={clsx(getInputClass(errors.email), "pl-10")} placeholder="owner@example.com" />
                                </div>
                                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Street Address *</label>
                            <div className="relative">
                                <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input {...register("address")} className={clsx(getInputClass(errors.address), "pl-10")} placeholder="123 Street, Brgy..." />
                            </div>
                            {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Province */}
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Province *</label>
                                <div className="relative">
                                    <select {...register("province")} className={getSelectClass(errors.province)}>
                                        <option value="">Select Province...</option>
                                        {PH_LOCATION_DATA.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                    </select>
                                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                                </div>
                                {errors.province && <p className="mt-1 text-xs text-red-500">{errors.province.message}</p>}
                            </div>

                            {/* City */}
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500">City *</label>
                                <div className="relative">
                                    <select {...register("city")} className={getSelectClass(errors.city)} disabled={!watchedProvince}>
                                        <option value="">Select City...</option>
                                        {availableCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                                </div>
                                {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city.message}</p>}
                            </div>
                        </div>

                        {/* Zip Code */}
                        <div className="w-1/2">
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-emerald-600">Zip Code (Auto)</label>
                            <div className="relative">
                                <FiMap className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                                <input 
                                    {...register("zip")} 
                                    readOnly 
                                    className="h-11 w-full rounded-xl border border-emerald-100 bg-emerald-50/50 pl-10 pr-3 text-sm font-bold text-emerald-700 cursor-not-allowed dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400" 
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="border-t bg-zinc-50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="rounded-xl border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200 transition-all">
                        Cancel
                    </button>
                    <button type="submit" form="edit-owner-form" disabled={isSubmitting} className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
                        {isSubmitting ? "Saving..." : "Update Details"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EditOwnerModal;
