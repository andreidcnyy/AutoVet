import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { FiX, FiCamera, FiAlertCircle } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../context/ToastContext";

const inputBase =
    "h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800";

const selectBase =
    "h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-700 focus:bg-white focus:outline-none appearance-none pr-10 dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800";

const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-300 dark:border-dark-border dark:focus:border-blue-500");
const getSelectClass = (error) => clsx(selectBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-300 dark:border-dark-border dark:focus:border-blue-500");

const patientSchema = z.object({
    name: z.string().min(1, "Pet name is required").max(255),
    species: z.string().min(1, "Species is required").max(255),
    breed: z.string().max(255).optional().or(z.literal("")),
    date_of_birth: z.string().optional().or(z.literal("")),
    gender: z.string().max(50).optional().or(z.literal("")),
    color: z.string().max(255).optional().or(z.literal("")),
    weight: z.coerce.number().min(0, "Weight must be valid").optional().or(z.literal("")),
    status: z.string().max(50).optional(),
    owner_name: z.string().min(1, "Owner name is required").max(255),
    owner_phone: z.string().regex(/^([0-9\s\-\+\(\)]*)$/, "Invalid phone format").max(50).optional().or(z.literal("")),
    owner_email: z.string().email("Invalid email address").max(255).optional().or(z.literal("")),
    owner_address: z.string().min(1, "Street address is required").max(255),
    owner_city: z.string().min(1, "City is required").max(255),
    owner_province: z.string().min(1, "Province is required").max(255),
    owner_zip: z.string().min(1, "Zip Code is required").max(20),
    allergies: z.string().max(255).optional().or(z.literal("")),
    medication: z.string().max(255).optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
    photo: z.string().optional().or(z.literal(""))
});

function EditPatientModal({ isOpen, onClose, patient, onSaveSuccess }) {
    const toast = useToast();
    const [error, setError] = useState(null);
    const photoInputRef = useRef(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(patientSchema),
        defaultValues: {
            name: "", species: "Canine", breed: "", date_of_birth: "",
            gender: "Male", color: "", weight: "", status: "Healthy",
            owner_name: "", owner_phone: "", owner_email: "",
            owner_address: "", owner_city: "", owner_province: "", owner_zip: "",
            allergies: "", medication: "", notes: "", photo: "",
        }
    });

    useEffect(() => {
        if (patient && isOpen) {
            reset({
                name: patient.name || "",
                species: patient.species || "Canine",
                breed: patient.breed || "",
                date_of_birth: patient.date_of_birth || "",
                gender: patient.gender || "Male",
                color: patient.color || "",
                weight: patient.weight || "",
                status: patient.status || "Healthy",
                owner_name: patient.ownerName || patient.owner_name || "",
                owner_phone: patient.ownerPhone || patient.owner_phone || "",
                owner_email: patient.ownerEmail || patient.owner_email || "",
                owner_address: patient.owner_address || "",
                owner_city: patient.owner_city || "",
                owner_province: patient.owner_province || "",
                owner_zip: patient.owner_zip || "",
                allergies: patient.allergies || "",
                medication: patient.medication || "",
                notes: patient.notes || "",
                photo: patient.photo || patient.avatar || "",
            });
            setError(null);
        }
    }, [patient, isOpen, reset]);

    if (!isOpen || !patient) return null;

    const photoValue = watch("photo");

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setValue("photo", reader.result, { shouldDirty: true });
        };
        reader.readAsDataURL(file);
    };

    const onSubmit = async (data) => {
        setError(null);
        try {
            const response = await fetch(`/api/patients/${patient.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const err = await response.json();
                const firstError = err.errors ? Object.values(err.errors)[0][0] : (err.message || "Failed to update patient.");
                throw new Error(firstError);
            }

            const updatedPatient = await response.json();
            toast.success("Patient profile updated successfully.");
            onSaveSuccess(updatedPatient);
            onClose();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-dark-card border dark:border-dark-border">
                <div className="flex items-center justify-between border-b px-6 py-4 dark:border-dark-border">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Edit Profile</h2>
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

                    <form id="edit-patient-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <section>
                            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-zinc-100">Pet Details</h3>
                            <div className="flex items-center gap-4 mb-4">
                                <button
                                    type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-blue-400 dark:border-dark-border dark:bg-dark-surface"
                                >
                                    {photoValue && typeof photoValue === 'string' && photoValue.length > 0 ? (
                                        <img src={photoValue} alt="Pet" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full gap-1 text-slate-400">
                                            <FiCamera className="h-5 w-5" />
                                        </div>
                                    )}
                                </button>
                                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Change Photo</p>
                                    <p className="text-xs text-slate-500">JPG, PNG, GIF</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Pet Name *</label>
                                    <input {...register("name")} className={getInputClass(errors.name)} />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Species *</label>
                                    <select {...register("species")} className={getSelectClass(errors.species)}>
                                        <option>Canine</option><option>Feline</option><option>Avian</option>
                                        <option>Reptile</option><option>Exotic</option><option>Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Breed</label>
                                    <input {...register("breed")} className={getInputClass(errors.breed)} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Date of Birth</label>
                                    <input type="date" {...register("date_of_birth")} className={getInputClass(errors.date_of_birth)} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Weight</label>
                                    <input type="number" step="0.01" {...register("weight")} className={getInputClass(errors.weight)} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Status</label>
                                    <select {...register("status")} className={getSelectClass(errors.status)}>
                                        <option>Healthy</option><option>Treatment</option><option>Overdue</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-slate-200 dark:bg-dark-border" />

                        <section>
                            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-zinc-100">Owner Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Full Name *</label>
                                    <input {...register("owner_name")} className={getInputClass(errors.owner_name)} />
                                    {errors.owner_name && <p className="mt-1 text-xs text-red-500">{errors.owner_name.message}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Phone</label>
                                    <input {...register("owner_phone")} className={getInputClass(errors.owner_phone)} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Email Address</label>
                                    <input type="email" {...register("owner_email")} className={getInputClass(errors.owner_email)} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Street Address *</label>
                                    <input {...register("owner_address")} className={getInputClass(errors.owner_address)} />
                                    {errors.owner_address && <p className="mt-1 text-xs text-red-500">{errors.owner_address.message}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">City *</label>
                                    <input {...register("owner_city")} className={getInputClass(errors.owner_city)} />
                                    {errors.owner_city && <p className="mt-1 text-xs text-red-500">{errors.owner_city.message}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Province *</label>
                                        <input {...register("owner_province")} className={getInputClass(errors.owner_province)} />
                                        {errors.owner_province && <p className="mt-1 text-xs text-red-500">{errors.owner_province.message}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Zip *</label>
                                        <input {...register("owner_zip")} className={getInputClass(errors.owner_zip)} />
                                        {errors.owner_zip && <p className="mt-1 text-xs text-red-500">{errors.owner_zip.message}</p>}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </form>
                </div>

                <div className="border-t bg-slate-50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200">
                        Cancel
                    </button>
                    <button type="submit" form="edit-patient-form" disabled={isSubmitting} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EditPatientModal;
