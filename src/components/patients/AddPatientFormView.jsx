import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { FiCalendar, FiChevronDown, FiCheckCircle, FiAlertCircle, FiCamera, FiUserPlus, FiUserCheck } from "react-icons/fi";
import { LuFilePlus2, LuPawPrint } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import { useAuth } from "../../context/AuthContext";

const steps = ["Pet Information", "Owner Details", "Medical History"];

const inputBase =
  "h-12 w-full rounded-xl border bg-slate-50 px-4 text-base text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800";
const selectBase =
  "h-12 w-full rounded-xl border bg-slate-50 px-4 text-base text-slate-700 focus:bg-white focus:outline-none appearance-none pr-10 dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800";

const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-300 dark:border-dark-border");
const getSelectClass = (error) => clsx(selectBase, error ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-300 dark:border-dark-border");

function StepPill({ label, index, active }) {
  return (
    <div className={clsx("inline-flex items-center gap-2 text-sm font-semibold", active ? "text-blue-600" : "text-slate-500 dark:text-zinc-400")}>
      <span className={clsx("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-dark-surface dark:text-zinc-300")}>
        {index + 1}
      </span>
      {label}
    </div>
  );
}

const patientSchema = z.object({
  name: z.string().min(1, "Pet name is required").max(255),
  species_id: z.string().min(1, "Species is required"),
  breed_id: z.string().optional(),
  date_of_birth: z.string().optional().or(z.literal("")),
  sex: z.string().max(50).optional(),
  age_group: z.string().optional().or(z.literal("")),
  color: z.string().max(255).optional(),
  weight: z.coerce.number().min(0.01, "Weight is required to determine pet size").max(500, "Weight exceeds valid range"),
  weight_unit: z.enum(["kg", "lbs"]).default("kg"),
  size_category_id: z.string().optional().or(z.literal("")),
  status: z.string().max(50).optional(),
  owner_id: z.string().optional(),
  owner_name: z.string().optional(),
  owner_phone: z.string()
    .min(1, "Phone number is required")
    .regex(/^(09|\+639)\d{9,10}$/, "Invalid phone number format. Use 09XXXXXXXXX or +639XXXXXXXXX")
    .refine(val => {
      if (val.startsWith('09')) return val.length === 11;
      if (val.startsWith('+639')) return val.length === 13;
      return false;
    }, "Phone number must start with 09 (11 digits) or +639 (13 characters)"),
  owner_email: z.string().max(255).optional().or(z.literal("")),
  owner_address: z.string().optional(),
  owner_city: z.string().optional(),
  owner_province: z.string().optional(),
  owner_zip: z.string().max(20).optional(),
  allergies: z.string().max(255).optional(),
  medication: z.string().max(255).optional(),
  notes: z.string().optional(),
  photo: z.string().optional()
}).refine(data => {
  if (!data.owner_id && !data.owner_name?.trim()) return false;
  return true;
}, { message: "Either select an existing owner or provide a new owner name", path: ["owner_name"] });

function AddPatientFormView({ onCancel, onSave, ownerId: initialOwnerId }) {
  const [error, setError] = useState(null);
  const photoInputRef = useRef(null);
  const [speciesList, setSpeciesList] = useState([]);
  const [sizeCategories, setSizeCategories] = useState([]);
  const [ownersList, setOwnersList] = useState([]);
  const [isNewOwner, setIsNewOwner] = useState(!initialOwnerId);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.token) return;
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${user.token}`
    };

    fetch("/api/species", { headers }).then(res => res.json()).then(setSpeciesList).catch(console.error);
    fetch("/api/pet-size-categories", { headers }).then(res => res.json()).then(data => setSizeCategories(data.data || data)).catch(console.error);
    if (!initialOwnerId) {
      fetch("/api/owners", { headers }).then(res => res.json()).then(setOwnersList).catch(console.error);
    }
  }, [initialOwnerId, user?.token]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: "", species_id: "", breed_id: "", date_of_birth: "",
      sex: "Male", age_group: "Adult", color: "", weight: "", weight_unit: "kg",
      status: "Healthy",
      owner_id: initialOwnerId || "", owner_name: "", owner_phone: "", owner_email: "",
      owner_address: "", owner_city: "", owner_province: "", owner_zip: "",
      allergies: "", medication: "", notes: "", photo: "",
    }
  });

  const photoValue = watch("photo");
  const speciesIdValue = watch("species_id");
  const weightValue = watch("weight");
  
  const selectedSpecies = speciesList.find(s => s.id.toString() === speciesIdValue);
  const availableBreeds = selectedSpecies?.breeds || [];

  const calculateSize = (w) => {
    if (!w || isNaN(w)) return "N/A";
    const val = parseFloat(w);
    if (val <= 5) return "Small";
    if (val <= 10) return "Medium";
    if (val <= 20) return "Large";
    return "Giant";
  };

  const calculatedSize = calculateSize(weightValue);

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
      let finalOwnerId = initialOwnerId || data.owner_id;

      if (!initialOwnerId && isNewOwner) {
        if (!data.owner_name) throw new Error("Owner name is required for a new owner.");
        const ownerRes = await fetch("/api/owners", {
          method: "POST",
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
          }),
        });
        if (!ownerRes.ok) {
          const err = await ownerRes.json();
          throw new Error(err.message || "Failed to create new owner.");
        }
        const newOwner = await ownerRes.json();
        finalOwnerId = newOwner.id;
      }

      if (!finalOwnerId) throw new Error("No owner selected or created.");

      // Now create pet
      const petPayload = {
        owner_id: finalOwnerId,
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
        status: data.status,
        allergies: data.allergies,
        medication: data.medication,
        notes: data.notes,
        photo: data.photo
      };

      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(petPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save pet details.");
      }

      const savedPet = await res.json();
      
      onSave(savedPet);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            {initialOwnerId ? "Register New Pet" : "Add New Patient"}
          </h2>
          <p className="mt-1 text-base text-slate-500 dark:text-zinc-400">
            {initialOwnerId ? "Register a new pet to this owner." : "Register a new pet and link it to an owner."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200">
            Cancel
          </button>
          <button type="submit" form="add-patient-form" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <FiCheckCircle className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Pet Record"}
          </button>
        </div>
      </div>

      <section className="card-shell overflow-hidden">
        {!initialOwnerId && (
          <div className="flex flex-wrap items-center gap-8 border-b border-slate-200 px-6 py-4 dark:border-dark-border">
            {steps.map((step, index) => <StepPill key={step} index={index} label={step} active={index === 0} />)}
          </div>
        )}

        {error && (
          <div className="mx-6 mt-5 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
            <FiAlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form id="add-patient-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-6">
          {/* Pet Profile */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-zinc-50">
              <LuPawPrint className="h-6 w-6 text-blue-600" /> Pet Details
            </h3>

            <div className="flex items-center gap-5 pb-2">
              <button type="button" onClick={() => photoInputRef.current?.click()} className="group relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-blue-400">
                {photoValue ? (
                  <img src={getActualPetImageUrl(photoValue)} alt="Pet" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400"><FiCamera className="h-8 w-8" /></div>
                )}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Pet Photo</p>
                <p className="text-xs text-slate-500">JPG, PNG up to 5MB</p>
                {photoValue && <button type="button" onClick={() => setValue("photo", "")} className="text-xs text-red-500 mt-1">Remove</button>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Pet Name *</label>
                <input {...register("name")} className={getInputClass(errors.name)} placeholder="e.g. Daisy" />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Species *</label>
                  <div className="relative">
                    <select {...register("species_id")} className={getSelectClass(errors.species_id)}>
                      <option value="">Select Species...</option>
                      {speciesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {errors.species_id && <p className="mt-1 text-xs text-red-500">{errors.species_id.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Breed</label>
                  <div className="relative">
                    <select {...register("breed_id")} className={getSelectClass(errors.breed_id)} disabled={!speciesIdValue}>
                      <option value="">Select Breed...</option>
                      {availableBreeds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Sex</label>
                  <select {...register("sex")} className={getSelectClass(errors.sex)}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Male (Neutered)</option>
                    <option>Female (Spayed)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Age Group</label>
                  <select {...register("age_group")} className={getSelectClass(errors.age_group)}>
                    <option value="">Select Age Group...</option>
                    <option>Puppy/Kitten</option>
                    <option>Junior</option>
                    <option>Adult</option>
                    <option>Senior</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Date of Birth</label>
                  <input type="date" {...register("date_of_birth")} className={getInputClass(errors.date_of_birth)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Weight</label>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" {...register("weight")} className={getInputClass(errors.weight)} placeholder="0.00" />
                    <select {...register("weight_unit")} className="w-20 rounded-lg border border-slate-200 bg-white/50 p-2 text-sm dark:border-white/10 dark:bg-zinc-800">
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                  {errors.weight && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.weight.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Size Category</label>
                  <div className="flex h-[42px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 dark:border-white/5 dark:bg-zinc-900/50 dark:text-zinc-300">
                    {calculatedSize}
                    <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-slate-400">Auto</span>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {!initialOwnerId && (
            <>
              <div className="h-px bg-slate-200 dark:bg-dark-surface" />

              {/* Owner Details */}
              <section className="space-y-4">
                <h3 className="flex items-center justify-between text-2xl font-bold text-slate-900 dark:text-zinc-50">
                  <span className="flex items-center gap-2"><FiUser className="h-6 w-6 text-blue-600" /> Owner Details</span>
                </h3>
                
                <div className="flex gap-4 border-b border-slate-200 pb-4 dark:border-dark-border">
                  <button type="button" onClick={() => setIsNewOwner(true)} className={`flex items-center gap-2 pb-2 border-b-2 font-medium transition ${isNewOwner ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    <FiUserPlus /> Register New Owner
                  </button>
                  <button type="button" onClick={() => setIsNewOwner(false)} className={`flex items-center gap-2 pb-2 border-b-2 font-medium transition ${!isNewOwner ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    <FiUserCheck /> Select Existing Owner
                  </button>
                </div>

                {isNewOwner ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Full Name *</label>
                      <input {...register("owner_name")} className={getInputClass(errors.owner_name)} placeholder="e.g. Jordan Miller" />
                      {errors.owner_name && <p className="mt-1 text-xs text-red-500">{errors.owner_name.message}</p>}
                    </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Phone Number *</label>
                        <input 
                          {...register("owner_phone")} 
                          type="text"
                          className={getInputClass(errors.owner_phone)} 
                          placeholder="09XXXXXXXXX or +639XXXXXXXXX" 
                          onInput={(e) => {
                            e.target.value = e.target.value.replace(/[^0-9+]/g, '');
                            if (e.target.value.includes('+') && e.target.value.indexOf('+') !== 0) {
                              e.target.value = e.target.value.replace(/\+/g, '');
                            }
                          }}
                        />
                        {errors.owner_phone && <p className="mt-1 text-xs text-red-500">{errors.owner_phone.message}</p>}
                      </div>
                    <div className="lg:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Email Address</label>
                      <input type="email" {...register("owner_email")} className={getInputClass(errors.owner_email)} placeholder="owner@example.com" />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Street Address</label>
                      <input {...register("owner_address")} className={getInputClass(errors.owner_address)} placeholder="123 Main St" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Existing Owner *</label>
                    <div className="relative">
                      <select {...register("owner_id")} className={getSelectClass(errors.owner_id)}>
                        <option value="">Search and select an owner...</option>
                        {ownersList.map(o => <option key={o.id} value={o.id}>{o.name} ({o.email || o.phone || "No contact info"})</option>)}
                      </select>
                      <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {errors.owner_name && <p className="mt-1 text-xs text-red-500">{errors.owner_name.message}</p>}
                  </div>
                )}
              </section>
            </>
          )}

          <div className="h-px bg-slate-200 dark:bg-dark-surface" />

          {/* Medical History */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-zinc-50">
              <LuFilePlus2 className="h-6 w-6 text-blue-600" /> Medical Information
            </h3>
            
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Allergies</label>
                <input {...register("allergies")} className={getInputClass(errors.allergies)} placeholder="e.g. Penicillin, Pollen (Leave blank if none)" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Current Medication</label>
                <input {...register("medication")} className={getInputClass(errors.medication)} placeholder="e.g. Heartgard (Leave blank if none)" />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Additional Notes / History</label>
                <textarea {...register("notes")} rows="3" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500" placeholder="Any other important medical history or behavioral notes..."></textarea>
              </div>
            </div>
          </section>

        </form>
      </section>
    </div>
  );
}

export default AddPatientFormView;
