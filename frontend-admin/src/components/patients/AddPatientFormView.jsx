import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { FiCalendar, FiChevronDown, FiCheckCircle, FiAlertCircle, FiCamera, FiUserPlus, FiUserCheck, FiPhone, FiMap, FiMapPin } from "react-icons/fi";
import { LuFilePlus2, LuPawPrint } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import { useAuth } from "../../context/AuthContext";
import { VET_AND_ADMIN } from "../../constants/roles";
import { getAgeGroup } from "../../utils/petAgeGroups";
import { PH_LOCATION_DATA } from "../../utils/phLocationData";

const steps = ["Pet Information", "Owner Details", "Medical History"];

const inputBase =
  "h-12 w-full rounded-xl border bg-zinc-50 px-4 text-base text-zinc-700 placeholder:text-zinc-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800";
const selectBase =
  "h-12 w-full rounded-xl border bg-zinc-50 px-4 text-base text-zinc-700 focus:bg-white focus:outline-none appearance-none pr-10 dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800";

const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-emerald-300 dark:border-dark-border");
const getSelectClass = (error) => clsx(selectBase, error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-emerald-300 dark:border-dark-border");

function StepPill({ label, index, active }) {
  return (
    <div className={clsx("inline-flex items-center gap-2 text-sm font-semibold", active ? "text-emerald-600" : "text-zinc-500 dark:text-zinc-400")}>
      <span className={clsx("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", active ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-600 dark:bg-dark-surface dark:text-zinc-300")}>
        {index + 1}
      </span>
      {label}
    </div>
  );
}

const patientSchema = z.object({
  name: z.string().min(1, "Pet name is required").max(255),
  species_id: z.coerce.string().min(1, "Species is required"),
  breed_id: z.coerce.string().optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  sex: z.string().max(50).optional(),
  age_group: z.string().optional().or(z.literal("")),
  color: z.string().max(255).optional(),
  weight: z.coerce.number().min(0.01, "Weight is required to determine pet size").max(500, "Weight exceeds valid range"),
  weight_unit: z.enum(["kg", "lbs"]).default("kg"),
  size_category_id: z.coerce.string().optional().or(z.literal("")),
  owner_id: z.coerce.string().optional(),
  owner_name: z.string().optional(),
  owner_phone: z.string().optional().or(z.literal("")),
  owner_email: z.string().max(255).optional().or(z.literal("")),
  owner_address: z.string().optional(),
  owner_city: z.string().optional(),
  owner_province: z.string().optional(),
  owner_zip: z.string().max(20).optional(),
  allergies: z.string().max(255).optional(),
  medication: z.string().max(255).optional(),
  notes: z.string().optional(),
  photo: z.string().optional(),
  // Clinical fields
  vet_id: z.coerce.string().optional().or(z.literal("")),
  chief_complaint: z.string().optional().or(z.literal("")),
  findings: z.string().optional().or(z.literal("")),
  diagnosis: z.string().optional().or(z.literal("")),
  treatment_plan: z.string().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (!data.owner_id || data.owner_id === "") {
    if (!data.owner_name?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Owner name is required", path: ["owner_name"] });
    }
    if (!data.owner_phone?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Contact number is required", path: ["owner_phone"] });
    } else if (data.owner_phone.length !== 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Contact number must be exactly 11 digits", path: ["owner_phone"] });
    }
    if (!data.owner_province) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Province is required", path: ["owner_province"] });
    }
    if (!data.owner_city) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "City is required", path: ["owner_city"] });
    }
    if (!data.owner_address?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Address is required", path: ["owner_address"] });
    }
  }
});

function AddPatientFormView({ onCancel, onSave, ownerId: initialOwnerId }) {
  const [error, setError] = useState(null);
  const photoInputRef = useRef(null);
  const [speciesList, setSpeciesList] = useState([]);
  const [sizeCategories, setSizeCategories] = useState([]);
  const [weightRanges, setWeightRanges] = useState([]);
  const [ownersList, setOwnersList] = useState([]);
  const [vetsList, setVetsList] = useState([]);
  const [isNewOwner, setIsNewOwner] = useState(!initialOwnerId);
  const [breedSuggestedSizeId, setBreedSuggestedSizeId] = useState(null);
  
  const [availableCities, setAvailableCities] = useState([]);
  const { user } = useAuth();

  const {
    register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: "", species_id: "", breed_id: "", date_of_birth: "",
      sex: "Male", age_group: "Adult", color: "", weight: "", weight_unit: "kg",
      owner_id: initialOwnerId || "", owner_name: "", owner_phone: "", owner_email: "",
      owner_address: "", owner_city: "", owner_province: "", owner_zip: "",
      allergies: "", medication: "", notes: "", photo: "",
    }
  });

  const photoValue = watch("photo");
  const speciesIdValue = watch("species_id");
  const dobValue = watch("date_of_birth");
  const weightValue = watch("weight");
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

  useEffect(() => {
    if (!user?.token) return;
    const headers = { "Accept": "application/json", "Authorization": `Bearer ${user.token}` };
    
    // Fetch Species
    fetch("/api/species?per_page=100", { headers })
      .then(res => res.json())
      .then(data => {
        const species = data.data || data;
        if (Array.isArray(species)) setSpeciesList(species);
      }).catch(console.error);

    // Fetch Size Categories
    fetch("/api/pet-size-categories", { headers })
      .then(res => res.json())
      .then(data => {
        const cats = data.data || data;
        if (Array.isArray(cats)) setSizeCategories(cats);
      }).catch(console.error);

    // Fetch Weight Ranges
    fetch("/api/weight-ranges?per_page=100", { headers })
      .then(res => res.json())
      .then(data => {
        const ranges = data.data || data;
        if (Array.isArray(ranges)) setWeightRanges(ranges);
      }).catch(console.error);

    // Fetch Vets (Admins + Veterinarians)
    fetch("/api/vets", { headers })
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) setVetsList(data);
      }).catch(console.error);

    // Fetch Owners
    if (!initialOwnerId) {
      fetch("/api/owners", { headers })
        .then(res => res.json())
        .then(data => {
           const owners = data.data || data;
           if (Array.isArray(owners)) setOwnersList(owners);
        }).catch(console.error);
    }
  }, [initialOwnerId, user?.token]);

  const selectedSpecies = speciesList.find(s => s.id.toString() === speciesIdValue);
  const availableBreeds = selectedSpecies?.breeds || [];
  const breedIdValue = watch("breed_id");

  useEffect(() => {
    if (breedIdValue && speciesIdValue) {
      const selectedBreed = availableBreeds.find(b => b.id.toString() === breedIdValue.toString());
      if (selectedBreed?.default_size_category_id) {
        setBreedSuggestedSizeId(selectedBreed.default_size_category_id);
        if (!weightValue) setValue("size_category_id", selectedBreed.default_size_category_id.toString());
      } else {
        setBreedSuggestedSizeId(null);
      }
    }
  }, [breedIdValue, speciesIdValue, availableBreeds, setValue, weightValue]);

  const calculatedSizeId = (() => {
    if (!weightValue || !speciesIdValue) return null;
    const w = parseFloat(weightValue);
    const ranges = weightRanges.filter(r => r.species_id?.toString() === speciesIdValue.toString() && r.status === "Active");
    const match = ranges.find(r => w >= (r.min_weight || 0) && w <= (r.max_weight || Infinity));
    return match ? match.size_category_id : null;
  })();

  const calculatedSizeName = sizeCategories.find(c => c.id.toString() === calculatedSizeId?.toString())?.name || (weightValue && speciesIdValue ? "Unclassified" : "N/A");

  useEffect(() => {
    if (weightValue && speciesIdValue && calculatedSizeId) {
      setValue("size_category_id", calculatedSizeId.toString());
    }
  }, [calculatedSizeId, weightValue, speciesIdValue, setValue]);

  useEffect(() => {
    if (speciesIdValue && dobValue) {
      const speciesName = speciesList.find(s => s.id.toString() === speciesIdValue)?.name;
      setValue("age_group", getAgeGroup(speciesName, dobValue), { shouldValidate: true });
    }
  }, [speciesIdValue, dobValue, speciesList, setValue]);

  const onSubmit = async (data) => {
    setError(null);
    try {
      let finalOwnerId = initialOwnerId || data.owner_id;
      if (!initialOwnerId && isNewOwner) {
        const ownerRes = await fetch("/api/owners", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${user?.token}` },
          body: JSON.stringify({
            name: data.owner_name, phone: data.owner_phone, email: data.owner_email || null,
            address: data.owner_address, city: data.owner_city, province: data.owner_province, zip: data.owner_zip
          }),
        });
        if (!ownerRes.ok) {
          const errData = await ownerRes.json();
          throw new Error(errData.message || Object.values(errData.errors || {}).flat().join(" "));
        }
        const newOwner = await ownerRes.json();
        finalOwnerId = newOwner.id;
      }

      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${user?.token}` },
        body: JSON.stringify({
          owner_id: finalOwnerId, name: data.name, species_id: data.species_id, breed_id: data.breed_id || null,
          date_of_birth: data.date_of_birth || null, sex: data.sex, age_group: data.age_group, color: data.color || null,
          weight: data.weight, weight_unit: data.weight_unit, size_category_id: data.size_category_id,
          allergies: data.allergies || null, medication: data.medication || null,
          notes: data.notes || null, photo: data.photo || null,
          // Clinical fields
          vet_id: data.vet_id || null,
          chief_complaint: data.chief_complaint || null,
          findings: data.findings || null,
          diagnosis: data.diagnosis || null,
          treatment_plan: data.treatment_plan || null
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to save pet record.");
      }
      onSave(await res.json());
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{initialOwnerId ? "Register Pet" : "Add New Patient"}</h2>
          <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">Complete the details below to register the pet.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 dark:bg-dark-card dark:text-zinc-200">Cancel</button>
          <button type="submit" form="add-patient-form" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <FiCheckCircle className="h-4 w-4" /> {isSubmitting ? "Saving..." : "Save Pet Record"}
          </button>
        </div>
      </div>

      <section className="card-shell overflow-hidden">
        {error && (
          <div className="mx-6 mt-5 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
            <FiAlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form id="add-patient-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-6">
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50"><LuPawPrint className="h-6 w-6 text-emerald-600" /> Pet Details</h3>
            <div className="flex items-center gap-5 pb-2">
              <button type="button" onClick={() => photoInputRef.current?.click()} className="group relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 hover:border-emerald-400">
                {photoValue ? <img src={getActualPetImageUrl(photoValue)} alt="Pet" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-400"><FiCamera className="h-8 w-8" /></div>}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const reader = new FileReader();
                reader.onloadend = () => setValue("photo", reader.result);
                if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
              }} />
              <div><p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Pet Photo</p><p className="text-xs text-zinc-500">Up to 5MB</p></div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Pet Name *</label><input {...register("name")} className={getInputClass(errors.name)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Species *</label>
                  <div className="relative"><select {...register("species_id")} className={getSelectClass(errors.species_id)}><option value="">Select...</option>{speciesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Breed</label>
                  <div className="relative"><select {...register("breed_id")} className={getSelectClass(errors.breed_id)} disabled={!speciesIdValue}><option value="">Select...</option>{availableBreeds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Sex</label><select {...register("sex")} className={getSelectClass(errors.sex)}><option>Male</option><option>Female</option><option>Male (Neutered)</option><option>Female (Spayed)</option></select></div>
                <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Date of Birth</label><input type="date" {...register("date_of_birth")} className={getInputClass(errors.date_of_birth)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Weight</label><div className="flex gap-2"><input type="number" step="any" {...register("weight")} className={getInputClass(errors.weight)} placeholder="0.0" /><select {...register("weight_unit")} className="w-20 rounded-xl border border-zinc-200 bg-white/50 p-2 text-sm dark:bg-zinc-800"><option value="kg">kg</option><option value="lbs">lbs</option></select></div></div>
                <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Age Group</label><div className="flex h-12 items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 dark:bg-dark-surface dark:text-zinc-200">{watch("age_group")}</div></div>
              </div>
            </div>
          </section>

          {!initialOwnerId && (
            <>
              <div className="h-px bg-zinc-200 dark:bg-dark-surface" />
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50"><FiUser className="h-6 w-6 text-emerald-600" /> Owner Details</h3>
                <div className="flex gap-4 border-b border-zinc-200 pb-4 dark:border-dark-border">
                  <button type="button" onClick={() => setIsNewOwner(true)} className={`pb-2 border-b-2 font-bold text-sm uppercase tracking-wider transition ${isNewOwner ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-400'}`}>New Owner</button>
                  <button type="button" onClick={() => setIsNewOwner(false)} className={`pb-2 border-b-2 font-bold text-sm uppercase tracking-wider transition ${!isNewOwner ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-400'}`}>Existing Owner</button>
                </div>

                {isNewOwner ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2"><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Full Name *</label><input {...register("owner_name")} className={getInputClass(errors.owner_name)} /></div>
                    <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Real Email *</label><input type="email" {...register("owner_email")} className={getInputClass(errors.owner_email)} /></div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Contact Number (11 Digits) *</label>
                      <div className="flex gap-2">
                        <div className="flex h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-sm font-bold text-zinc-500 dark:bg-zinc-800">🇵🇭 +63</div>
                        <input {...register("owner_phone")} onChange={(e) => setValue("owner_phone", e.target.value.replace(/\D/g, "").slice(0, 11))} className={getInputClass(errors.owner_phone)} maxLength={11} />
                      </div>
                    </div>
                    <div className="lg:col-span-2"><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Street Address *</label><input {...register("owner_address")} className={getInputClass(errors.owner_address)} /></div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Province *</label>
                      <div className="relative"><select {...register("owner_province")} className={getSelectClass(errors.owner_province)}><option value="">Select...</option>{PH_LOCATION_DATA.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select><FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">City *</label>
                      <div className="relative"><select {...register("owner_city")} className={getSelectClass(errors.owner_city)} disabled={!ownerProvince}><option value="">Select...</option>{availableCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select><FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
                    </div>
                    <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-emerald-600">Zip Code (Auto)</label><input {...register("owner_zip")} readOnly className="h-12 w-full rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 text-sm font-bold text-emerald-700 cursor-not-allowed dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400" /></div>
                  </div>
                ) : (
                  <div className="relative"><select {...register("owner_id")} className={getSelectClass(errors.owner_id)}><option value="">Search and select...</option>{ownersList.map(o => <option key={o.id} value={o.id}>{o.name} ({o.phone})</option>)}</select><FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
                )}
              </section>
            </>
          )}

          {VET_AND_ADMIN.includes(user?.role) && (
            <>
              <div className="h-px bg-zinc-200 dark:bg-dark-surface" />
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50"><LuFilePlus2 className="h-6 w-6 text-emerald-600" /> Medical History</h3>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Allergies</label><input {...register("allergies")} className={getInputClass(errors.allergies)} placeholder="None recorded" /></div>
                  <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Current Medication</label><input {...register("medication")} className={getInputClass(errors.medication)} placeholder="None recorded" /></div>
                  
                  <div className="lg:col-span-2 pt-4 border-t border-zinc-100 dark:border-dark-border mt-2">
                    <h4 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                        Initial Medical Record (Optional)
                    </h4>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Attending Veterinarian</label>
                    <div className="relative">
                      <select {...register("vet_id")} className={getSelectClass(errors.vet_id)}>
                        <option value="">Select veterinarian...</option>
                        {vetsList.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.role === 'veterinarian' ? `Dr. ${v.name}` : v.name}
                          </option>
                        ))}
                      </select>
                      <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Chief Complaint</label>
                    <input {...register("chief_complaint")} className={getInputClass(errors.chief_complaint)} placeholder="Reason for visit" />
                  </div>
                  
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Clinical Findings</label>
                    <textarea {...register("findings")} rows="2" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-zinc-200" placeholder="Observations..."></textarea>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Diagnosis</label>
                    <textarea {...register("diagnosis")} rows="2" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-zinc-200" placeholder="Initial diagnosis..."></textarea>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Treatment Plan</label>
                    <textarea {...register("treatment_plan")} rows="2" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-zinc-200" placeholder="Prescriptions, procedures, etc."></textarea>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Notes</label>
                    <textarea {...register("notes")} rows="3" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-zinc-200" placeholder="Additional notes..."></textarea>
                  </div>
                </div>
              </section>
            </>
          )}
        </form>
      </section>
    </div>
  );
}

export default AddPatientFormView;
