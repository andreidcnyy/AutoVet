import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { FiX, FiCamera, FiAlertCircle, FiChevronDown, FiMapPin, FiMap } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import { getAgeGroup } from "../../utils/petAgeGroups";
import { PH_LOCATION_DATA } from "../../utils/phLocationData";

const inputBase =
    "h-11 w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800";
const selectBase =
    "h-11 w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 focus:bg-white focus:outline-none appearance-none pr-10 dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800";

const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-emerald-300 dark:border-dark-border");
const getSelectClass = (error) => clsx(selectBase, error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-emerald-300 dark:border-dark-border");

const patientSchema = z.object({
    name: z.string().min(1, "Pet name is required").max(255),
    species_id: z.string().min(1, "Species is required"),
    breed_id: z.string().optional().or(z.literal("")),
    date_of_birth: z.string().optional().or(z.literal("")),
    sex: z.string().max(50).optional().or(z.literal("")),
    age_group: z.string().optional().or(z.literal("")),
    color: z.string().max(255).optional().or(z.literal("")),
    weight: z.coerce.number().min(0.01, "Weight is required to determine pet size").max(500, "Weight exceeds valid range"),
    weight_unit: z.enum(["kg", "lbs"]).default("kg"),
    size_category_id: z.string().optional().or(z.literal("")),
    owner_name: z.string().min(1, "Owner name is required").max(255),
    owner_phone: z.string()
        .min(1, "Phone number is required")
        .length(11, "Contact number must be exactly 11 digits"),
    owner_email: z.string().email("Invalid email address").max(255).optional().or(z.literal("")),
    owner_address: z.string().min(1, "Street address is required").max(255),
    owner_city: z.string().min(1, "City is required").max(255),
    owner_province: z.string().min(1, "Province is required").max(255),
    owner_zip: z.string().optional().or(z.literal("")),
    allergies: z.string().max(255).optional().or(z.literal("")),
    medication: z.string().max(255).optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
    photo: z.string().optional().or(z.literal(""))
});

function EditPatientModal({ isOpen, onClose, patient, onSaveSuccess }) {
    const toast = useToast();
    const { user } = useAuth();
    const [error, setError] = useState(null);
    const photoInputRef = useRef(null);
    const [speciesList, setSpeciesList] = useState([]);
    const [sizeCategories, setSizeCategories] = useState([]);
    const [weightRanges, setWeightRanges] = useState([]);
    const [breedSuggestedSizeId, setBreedSuggestedSizeId] = useState(null);
    const [availableCities, setAvailableCities] = useState([]);

    useEffect(() => {
        if (isOpen && user?.token) {
            const headers = { 
                "Accept": "application/json",
                "Authorization": `Bearer ${user.token}`
            };
            fetch("/api/species?per_page=100", { headers })
                .then(res => res.json())
                .then(data => {
                    const species = data.data || data;
                    if (Array.isArray(species)) setSpeciesList(species);
                })
                .catch(console.error);
            fetch("/api/pet-size-categories", { headers })
                .then(res => res.json())
                .then(data => setSizeCategories(data.data || data))
                .catch(console.error);
            fetch("/api/weight-ranges?per_page=100", { headers })
                .then(res => res.json())
                .then(data => {
                    const ranges = data.data || data;
                    if (Array.isArray(ranges)) setWeightRanges(ranges);
                })
                .catch(console.error);
        }
    }, [isOpen, user?.token]);

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
            name: "", species_id: "", breed_id: "", date_of_birth: "",
            sex: "Male", age_group: "Adult", color: "", weight: "", weight_unit: "kg",
            owner_name: "", owner_phone: "", owner_email: "",
            owner_address: "", owner_city: "", owner_province: "", owner_zip: "",
            allergies: "", medication: "", notes: "", photo: "",
        }
    });

    useEffect(() => {
        if (patient && isOpen) {
            reset({
                name: patient.name || "",
                species_id: patient.species_id ? patient.species_id.toString() : "",
                breed_id: patient.breed_id ? patient.breed_id.toString() : "",
                date_of_birth: patient.date_of_birth ? patient.date_of_birth.substring(0, 10) : "",
                sex: patient.sex || "Male",
                age_group: patient.age_group === "Puppy/Kitten" ? "Baby" : (patient.age_group === "Junior" ? "Young" : (patient.age_group || "Adult")),
                color: patient.color || "",
                weight: patient.weight || "",
                weight_unit: patient.weight_unit || "kg",
                size_category_id: patient.size_category_id ? patient.size_category_id.toString() : "",
                owner_name: patient.owner?.name || patient.ownerName || "",
                owner_phone: patient.owner?.phone || patient.ownerPhone || "",
                owner_email: patient.owner?.email || patient.ownerEmail || "",
                owner_address: patient.owner?.address || patient.owner_address || "",
                owner_city: patient.owner?.city || patient.owner_city || "",
                owner_province: patient.owner?.province || patient.owner_province || "",
                owner_zip: patient.owner?.zip || patient.owner_zip || "",
                allergies: patient.allergies || "",
                medication: patient.medication || "",
                notes: patient.notes || "",
                photo: patient.photo || patient.avatar || "",
            });
            setError(null);
        }
    }, [patient, isOpen, reset]);

    const photoValue = watch("photo");
    const speciesIdValue = watch("species_id");
    const selectedSpecies = speciesList.find(s => s.id.toString() === speciesIdValue);
    const availableBreeds = selectedSpecies?.breeds || [];

    const ownerProvince = watch("owner_province");
    const ownerCity = watch("owner_city");

    useEffect(() => {
        const provinceData = PH_LOCATION_DATA.find(p => p.name === ownerProvince);
        if (provinceData) {
            setAvailableCities(provinceData.cities);
        } else {
            setAvailableCities([]);
        }
    }, [ownerProvince]);

    useEffect(() => {
        const cityData = availableCities.find(c => c.name === ownerCity);
        if (cityData) {
            setValue("owner_zip", cityData.zip);
        }
    }, [ownerCity, availableCities, setValue]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setValue("photo", reader.result, { shouldDirty: true });
        };
        reader.readAsDataURL(file);
    };

    const weightValue = watch("weight");
    const breedIdValue = watch("breed_id");
    const dobValue = watch("date_of_birth");

    useEffect(() => {
        if (breedIdValue && speciesIdValue) {
            const selectedBreed = availableBreeds.find(b => b.id.toString() === breedIdValue.toString());
            if (selectedBreed?.default_size_category_id) {
                setBreedSuggestedSizeId(selectedBreed.default_size_category_id);
            } else {
                setBreedSuggestedSizeId(null);
            }
        }
    }, [breedIdValue, speciesIdValue, availableBreeds]);

    const calculateDynamicSize = (weight, speciesId) => {
        if (!weight || !speciesId) return null;
        const w = parseFloat(weight);
        const ranges = weightRanges.filter(r => r.species_id?.toString() === speciesId.toString() && r.status === "Active");
        
        if (ranges.length === 0) return null;

        const match = ranges.find(r => {
            const min = r.min_weight || 0;
            const max = r.max_weight || Infinity;
            return w >= min && w <= max;
        });

        return match ? match.size_category_id : null;
    };

    const calculatedSizeId = calculateDynamicSize(weightValue, speciesIdValue);
    const calculatedSizeName = sizeCategories.find(c => c.id.toString() === calculatedSizeId?.toString())?.name || (weightValue && speciesIdValue ? "Unclassified" : "N/A");

    useEffect(() => {
        // If weight and species are present, strictly prioritize the computed size
        if (weightValue && speciesIdValue) {
            if (calculatedSizeId) {
                setValue("size_category_id", calculatedSizeId.toString());
            } else {
                // If weight exists but no range matches, clear it to avoid contradicting manual data
                setValue("size_category_id", "");
            }
        }
    }, [calculatedSizeId, weightValue, speciesIdValue, setValue]);

    useEffect(() => {
        if (speciesIdValue && dobValue) {
            const speciesName = speciesList.find(s => s.id.toString() === speciesIdValue)?.name;
            const computedAgeGroup = getAgeGroup(speciesName, dobValue);
            setValue("age_group", computedAgeGroup, { shouldValidate: true });
        } else if (!dobValue || !speciesIdValue) {
            setValue("age_group", "Not yet determined");
        }
    }, [speciesIdValue, dobValue, speciesList, setValue]);

    const isMismatch = breedSuggestedSizeId && calculatedSizeId && breedSuggestedSizeId.toString() !== calculatedSizeId.toString();

    const onSubmit = async (data) => {
        setError(null);
        try {
            // First update owner if owner_id exists
            if (patient.owner_id) {
                const ownerRes = await fetch(`/api/owners/${patient.owner_id}`, {
                    method: "PUT",
                    headers: { 
                        "Content-Type": "application/json", 
                        "Accept": "application/json",
                        "Authorization": `Bearer ${user?.token}`
                    },
                    body: JSON.stringify({
                        name: data.owner_name,
                        phone: data.owner_phone,
                        email: data.owner_email,
                        address: data.owner_address,
                        city: data.owner_city,
                        province: data.owner_province,
                        zip: data.owner_zip
                    })
                });
                if (!ownerRes.ok) throw new Error("Failed to update owner details.");
            }

            // Next update the pet itself
            const petPayload = {
                owner_id: patient.owner_id,
                name: data.name,
                species_id: data.species_id || null,
                breed_id: data.breed_id || null,
                date_of_birth: data.date_of_birth,
                sex: data.sex,
                age_group: data.age_group,
                color: data.color,
                weight: data.weight,
                weight_unit: data.weight_unit,
                size_category_id: data.size_category_id || null,
                allergies: data.allergies,
                medication: data.medication,
                notes: data.notes,
                photo: data.photo
            };

            const petRes = await fetch(`/api/pets/${patient.id}`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json", 
                    "Accept": "application/json",
                    "Authorization": `Bearer ${user?.token}`
                },
                body: JSON.stringify(petPayload),
            });

            if (!petRes.ok) {
                const err = await petRes.json();
                throw new Error(err.message || "Failed to update pet.");
            }

            const updatedPet = await petRes.json();
            
            onSaveSuccess(updatedPet);
            onClose();
        } catch (err) {
            setError(err.message);
        }
    };

    if (!isOpen || !patient) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-dark-card border dark:border-dark-border">
                <div className="flex items-center justify-between border-b px-6 py-4 dark:border-dark-border">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Edit Profile</h2>
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

                    <form id="edit-patient-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <section>
                            <h3 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Pet Details</h3>
                            <div className="flex items-center gap-4 mb-4">
                                <button
                                    type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 hover:border-emerald-400 dark:border-dark-border dark:bg-dark-surface"
                                >
                                    {photoValue ? (
                                        <img src={getActualPetImageUrl(photoValue)} alt="Pet" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-zinc-400"><FiCamera className="h-6 w-6"/></div>
                                    )}
                                    <div className={clsx(
                                        "absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity",
                                        photoValue ? "opacity-0 group-hover:opacity-100" : "opacity-100 group-hover:bg-black/30"
                                    )}>
                                        <FiCamera className="h-5 w-5 text-white shadow-sm" />
                                    </div>
                                </button>
                                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Pet Name *</label>
                                    <input {...register("name")} className={getInputClass(errors.name)} />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Species *</label>
                                    <div className="relative">
                                        <select {...register("species_id")} className={getSelectClass(errors.species_id)}>
                                            <option value="">Select Species...</option>
                                            {speciesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Breed</label>
                                    <div className="relative">
                                        <select {...register("breed_id")} className={getSelectClass(errors.breed_id)} disabled={!speciesIdValue}>
                                            <option value="">Select Breed...</option>
                                            {availableBreeds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Date of Birth</label>
                                    <input type="date" {...register("date_of_birth")} className={getInputClass(errors.date_of_birth)} />
                                </div>
                                
                                <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Weight ({watch("weight_unit") || "kg"})</label>
                                        <div className="flex gap-1">
                                            <input type="number" step="any" {...register("weight")} className={getInputClass(errors.weight)} placeholder="0.0" />
                                            <select {...register("weight_unit")} className="w-16 rounded border border-zinc-200 bg-white/50 p-1 text-xs dark:border-white/10 dark:bg-zinc-800">
                                                <option value="kg">kg</option>
                                                <option value="lbs">lbs</option>
                                            </select>
                                        </div>
                                        {errors.weight && <p className="mt-1 text-[10px] text-rose-500 font-medium">{errors.weight.message}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Size Category</label>
                                        {weightValue ? (
                                            <div className={clsx(
                                                "flex flex-col justify-center rounded border px-3 py-1 text-xs font-medium transition-colors min-h-[34px]",
                                                isMismatch ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20" : "border-zinc-200 bg-zinc-50 dark:border-dark-border dark:bg-dark-surface"
                                            )}>
                                                <div className="flex items-center justify-between">
                                                    <span className={clsx(isMismatch ? "text-amber-700 dark:text-amber-400 font-bold" : "text-zinc-700 dark:text-zinc-300 font-bold")}>
                                                        {calculatedSizeName}
                                                    </span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Auto</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <select {...register("size_category_id")} className="h-[34px] w-full rounded border bg-zinc-50 px-2 text-[11px] text-zinc-700 focus:bg-white focus:outline-none appearance-none pr-6 dark:bg-dark-surface dark:text-zinc-200">
                                                    <option value="">Manual Fallback...</option>
                                                    {sizeCategories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                                <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                                            </div>
                                        )}
                                        {isMismatch && (
                                            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500/80 leading-tight">
                                                Breed default: {sizeCategories.find(c => c.id.toString() === breedSuggestedSizeId.toString())?.name}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Sex</label>
                                    <select {...register("sex")} className={getSelectClass(errors.sex)}>
                                        <option>Male</option><option>Female</option><option>Male (Neutered)</option><option>Female (Spayed)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Age Group</label>
                                    <div className="flex h-11 w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-[13px] font-bold text-zinc-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200">
                                        <span>{watch("age_group") || "Not yet determined"}</span>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Auto</span>
                                    </div>
                                    <input type="hidden" {...register("age_group")} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Color</label>
                                    <input {...register("color")} className={getInputClass(errors.color)} placeholder="e.g. Brindle, Merle, Black" />
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-zinc-200 dark:bg-dark-border" />

                        <section>
                            <h3 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Owner Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Full Name *</label>
                                    <input {...register("owner_name")} className={getInputClass(errors.owner_name)} />
                                    {errors.owner_name && <p className="mt-1 text-xs text-red-500">{errors.owner_name.message}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Phone *</label>
                                    <div className="flex gap-2">
                                        <div className="flex h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 px-2.5 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:border-dark-border">
                                            🇵🇭 +63
                                        </div>
                                        <input 
                                            {...register("owner_phone")} 
                                            type="text"
                                            className={getInputClass(errors.owner_phone)} 
                                            placeholder="09123456789" 
                                            onChange={(e) => setValue("owner_phone", e.target.value.replace(/\D/g, "").slice(0, 11), { shouldValidate: true })}
                                            maxLength={11}
                                        />
                                    </div>
                                    {errors.owner_phone && <p className="mt-1 text-xs text-red-500">{errors.owner_phone.message}</p>}
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Email Address</label>
                                    <input type="email" {...register("owner_email")} className={getInputClass(errors.owner_email)} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Street Address *</label>
                                    <input {...register("owner_address")} className={getInputClass(errors.owner_address)} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Province *</label>
                                    <div className="relative">
                                        <select {...register("owner_province")} className={getSelectClass(errors.owner_province)}>
                                            <option value="">Select Province...</option>
                                            {PH_LOCATION_DATA.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                        </select>
                                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                                    </div>
                                    {errors.owner_province && <p className="mt-1 text-xs text-red-500">{errors.owner_province.message}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">City *</label>
                                    <div className="relative">
                                        <select {...register("owner_city")} className={getSelectClass(errors.owner_city)} disabled={!ownerProvince}>
                                            <option value="">Select City...</option>
                                            {availableCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                                    </div>
                                    {errors.owner_city && <p className="mt-1 text-xs text-red-500">{errors.owner_city.message}</p>}
                                </div>
                                <div className="w-1/2">
                                    <label className="mb-1 block text-xs font-semibold text-emerald-600 dark:text-emerald-400">Zip (Auto)</label>
                                    <div className="relative">
                                        <FiMap className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                                        <input 
                                            {...register("owner_zip")} 
                                            readOnly 
                                            className="h-11 w-full rounded-xl border border-emerald-100 bg-emerald-50/50 pl-10 pr-3 text-sm font-bold text-emerald-700 cursor-not-allowed dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-zinc-200 dark:bg-dark-border" />

                        <section>
                            <h3 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Medical History</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Allergies</label>
                                    <input {...register("allergies")} className={getInputClass(errors.allergies)} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Current Medication</label>
                                    <input {...register("medication")} className={getInputClass(errors.medication)} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Additional Notes / Status</label>
                                    <textarea {...register("notes")} rows="3" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-emerald-300 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500"></textarea>
                                </div>
                            </div>
                        </section>
                    </form>
                </div>

                <div className="border-t bg-zinc-50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="rounded-xl border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200">
                        Cancel
                    </button>
                    <button type="submit" form="edit-patient-form" disabled={isSubmitting} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EditPatientModal;
