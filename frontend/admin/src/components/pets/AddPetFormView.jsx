import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { FiCalendar, FiChevronDown, FiCheckCircle, FiAlertCircle, FiCamera, FiUserPlus, FiUserCheck, FiPhone, FiMap, FiMapPin, FiTrash2, FiPlus } from "react-icons/fi";
import { LuFilePlus2, LuPawPrint } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import { useAuth } from "../../context/AuthContext";
import { useNewItems } from "../../context/NewItemsContext";
import { VET_AND_ADMIN } from "../../constants/roles";
import { getAgeGroup } from "../../utils/petAgeGroups";
import { PH_LOCATION_DATA } from "../../utils/phLocationData";

const inputBase =
  "h-12 w-full rounded-xl border bg-zinc-50 px-4 text-base text-zinc-700 placeholder:text-zinc-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800";
const selectBase =
  "h-12 w-full rounded-xl border bg-zinc-50 px-4 text-base text-zinc-700 focus:bg-white focus:outline-none appearance-none pr-10 dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800";

const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-emerald-300 dark:border-dark-border");
const getSelectClass = (error) => clsx(selectBase, error ? "border-red-400 focus:border-red-500" : "border-zinc-200 focus:border-emerald-300 dark:border-dark-border");

const petSchema = z.object({
  name: z.string().min(1, "Pet name is required").max(255),
  species_id: z.coerce.string().min(1, "Species is required"),
  breed_id: z.coerce.string().optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  sex: z.string().max(50).optional(),
  age_group: z.string().optional().or(z.literal("")),
  color: z.string().max(255).optional(),
  weight: z.coerce.number().min(0.01, "Required").max(500, "Too large"),
  weight_unit: z.enum(["kg", "lbs"]).default("kg"),
  size_category_id: z.coerce.string().optional().or(z.literal("")),
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
});

const petSchema = z.object({
  owner_id: z.coerce.string().optional(),
  owner_name: z.string().optional(),
  owner_phone: z.string().optional().or(z.literal("")),
  owner_email: z.string().max(255).optional().or(z.literal("")),
  owner_address: z.string().optional(),
  owner_city: z.string().optional(),
  owner_province: z.string().optional(),
  owner_zip: z.string().max(20).optional(),
  pets: z.array(petSchema).min(1, "At least one pet is required")
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

const emptyPet = {
  name: "", species_id: "", breed_id: "", date_of_birth: "",
  sex: "Male", age_group: "Adult", color: "", weight: "", weight_unit: "kg",
  allergies: "", medication: "", notes: "", photo: "",
  vet_id: "", chief_complaint: "", findings: "", diagnosis: "", treatment_plan: ""
};

function AddPetFormView({ onCancel, onSave, ownerId: initialOwnerId }) {
  const [error, setError] = useState(null);
  const [speciesList, setSpeciesList] = useState([]);
  const [ownersList, setOwnersList] = useState([]);
  const [vetsList, setVetsList] = useState([]);
  const [isNewOwner, setIsNewOwner] = useState(!initialOwnerId);
  const [availableCities, setAvailableCities] = useState([]);
  const { user } = useAuth();
  const { refreshCounts } = useNewItems();

  const { register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(petSchema),
    defaultValues: {
      owner_id: initialOwnerId || "", owner_name: "", owner_phone: "", owner_email: "",
      owner_address: "", owner_city: "", owner_province: "", owner_zip: "",
      pets: [emptyPet]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "pets"
  });

  const ownerProvince = watch("owner_province");
  const ownerCity = watch("owner_city");
  const petsWatch = watch("pets");

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
    
    fetch("/api/species?per_page=100", { headers })
      .then(res => res.json())
      .then(data => {
        const species = data.data || data;
        if (Array.isArray(species)) setSpeciesList(species);
      }).catch(console.error);

    fetch("/api/vets", { headers })
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) setVetsList(data);
      }).catch(console.error);

    if (!initialOwnerId) {
      fetch("/api/owners", { headers })
        .then(res => res.json())
        .then(data => {
           const owners = data.data || data;
           if (Array.isArray(owners)) setOwnersList(owners);
        }).catch(console.error);
    }
  }, [initialOwnerId, user?.token]);

  // Handle breed -> species update and age_group update per pet
  useEffect(() => {
    petsWatch.forEach((pet, index) => {
      // Automatic Species deduction based on selected breed
      if (pet.breed_id && speciesList.length > 0) {
        const selectedBreed = speciesList.flatMap(s => s.breeds || []).find(b => b.id.toString() === pet.breed_id.toString());
        if (selectedBreed) {
          const species = speciesList.find(s => s.breeds?.some(b => b.id.toString() === selectedBreed.id.toString()));
          if (species && pet.species_id !== species.id.toString()) {
            setValue(`pets.${index}.species_id`, species.id.toString(), { shouldValidate: true });
          }
        }
      }

      // Automatic age group
      if (pet.species_id && pet.date_of_birth) {
        const speciesName = speciesList.find(s => s.id.toString() === pet.species_id)?.name;
        const newAgeGroup = getAgeGroup(speciesName, pet.date_of_birth);
        if (pet.age_group !== newAgeGroup) {
          setValue(`pets.${index}.age_group`, newAgeGroup, { shouldValidate: true });
        }
      }
    });
  }, [petsWatch, speciesList, setValue]);

  const handlePhotoChange = (index, e) => {
    const reader = new FileReader();
    reader.onloadend = () => setValue(`pets.${index}.photo`, reader.result);
    if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
  };

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
        refreshCounts();
      }

      const promises = data.pets.map(petData => fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${user?.token}` },
        body: JSON.stringify({
          owner_id: finalOwnerId, 
          name: petData.name, 
          species_id: petData.species_id, 
          breed_id: petData.breed_id || null,
          date_of_birth: petData.date_of_birth || null, 
          sex: petData.sex, 
          age_group: petData.age_group, 
          color: petData.color || null,
          weight: petData.weight, 
          weight_unit: petData.weight_unit, 
          size_category_id: petData.size_category_id,
          allergies: petData.allergies || null, 
          medication: petData.medication || null,
          notes: petData.notes || null, 
          photo: petData.photo || null,
          vet_id: petData.vet_id || null,
          chief_complaint: petData.chief_complaint || null,
          findings: petData.findings || null,
          diagnosis: petData.diagnosis || null,
          treatment_plan: petData.treatment_plan || null
        }),
      }));

      const results = await Promise.all(promises);
      for (const res of results) {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || "Failed to save one or more pet records.");
        }
      }
      
      const firstPetResponse = await results[0].json();
      onSave(firstPetResponse);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{initialOwnerId ? "Register Pet" : "Add Pet Owner & Pets"}</h2>
          <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">Complete the details below to register.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 dark:bg-dark-card dark:text-zinc-200">Cancel</button>
          <button type="submit" form="add-pet-form" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <FiCheckCircle className="h-4 w-4" /> {isSubmitting ? "Saving..." : "Save Record"}
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

        <form id="add-pet-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-6">
          
          {!initialOwnerId && (
            <>
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50"><FiUser className="h-6 w-6 text-emerald-600" /> Owner Details</h3>
                <div className="flex gap-4 border-b border-zinc-200 pb-4 dark:border-dark-border">
                  <button type="button" onClick={() => setIsNewOwner(true)} className={`pb-2 border-b-2 font-bold text-sm uppercase tracking-wider transition ${isNewOwner ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-400'}`}>New Owner</button>
                  <button type="button" onClick={() => setIsNewOwner(false)} className={`pb-2 border-b-2 font-bold text-sm uppercase tracking-wider transition ${!isNewOwner ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-400'}`}>Existing Owner</button>
                </div>

                {isNewOwner ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Full Name *</label>
                      <input {...register("owner_name")} className={getInputClass(errors.owner_name)} />
                      {errors.owner_name && <p className="mt-1 text-xs text-red-500">{errors.owner_name.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Real Email *</label>
                      <input type="email" {...register("owner_email")} className={getInputClass(errors.owner_email)} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Contact Number (11 Digits) *</label>
                      <div className="flex gap-2">
                        <div className="flex h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-sm font-bold text-zinc-500 dark:bg-zinc-800">🇵🇭 +63</div>
                        <input {...register("owner_phone")} onChange={(e) => setValue("owner_phone", e.target.value.replace(/\D/g, "").slice(0, 11))} className={getInputClass(errors.owner_phone)} maxLength={11} />
                      </div>
                      {errors.owner_phone && <p className="mt-1 text-xs text-red-500">{errors.owner_phone.message}</p>}
                    </div>
                    <div className="lg:col-span-2">
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Street Address *</label>
                      <input {...register("owner_address")} className={getInputClass(errors.owner_address)} />
                      {errors.owner_address && <p className="mt-1 text-xs text-red-500">{errors.owner_address.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Province *</label>
                      <div className="relative">
                        <select {...register("owner_province")} className={getSelectClass(errors.owner_province)}>
                          <option value="">Select...</option>
                          {PH_LOCATION_DATA.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {errors.owner_province && <p className="mt-1 text-xs text-red-500">{errors.owner_province.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">City *</label>
                      <div className="relative">
                        <select {...register("owner_city")} className={getSelectClass(errors.owner_city)} disabled={!ownerProvince}>
                          <option value="">Select...</option>
                          {availableCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {errors.owner_city && <p className="mt-1 text-xs text-red-500">{errors.owner_city.message}</p>}
                    </div>
                    <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-emerald-600">Zip Code (Auto)</label><input {...register("owner_zip")} readOnly className="h-12 w-full rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 text-sm font-bold text-emerald-700 cursor-not-allowed dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400" /></div>
                  </div>
                ) : (
                  <div className="relative">
                    <select {...register("owner_id")} className={getSelectClass(errors.owner_id)}>
                      <option value="">Search and select...</option>
                      {ownersList.map(o => <option key={o.id} value={o.id}>{o.name} ({o.phone})</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    {errors.owner_id && <p className="mt-1 text-xs text-red-500">{errors.owner_id.message}</p>}
                  </div>
                )}
              </section>
              <div className="h-px bg-zinc-200 dark:bg-dark-surface" />
            </>
          )}

          <section className="space-y-6">
            <h3 className="flex items-center justify-between text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              <div className="flex items-center gap-2"><LuPawPrint className="h-6 w-6 text-emerald-600" /> Pet Details</div>
            </h3>

            {fields.map((field, index) => {
              const photoValue = petsWatch[index]?.photo;
              return (
                <div key={field.id} className="relative rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 shadow-sm dark:border-dark-border dark:bg-dark-surface/30 space-y-4">
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="absolute right-4 top-4 rounded-xl bg-white p-2 text-zinc-400 hover:text-red-500 shadow-sm transition-colors dark:bg-dark-card dark:hover:text-red-400">
                      <FiTrash2 className="h-5 w-5" />
                    </button>
                  )}
                  <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center dark:bg-emerald-900/30 dark:text-emerald-400">{index + 1}</span>
                    Pet Profile
                  </h4>
                  
                  <div className="flex items-center gap-5 pb-2">
                    <button type="button" onClick={() => document.getElementById(`photo-upload-${index}`).click()} className="group relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-white hover:border-emerald-400 dark:bg-dark-card dark:border-zinc-700">
                      {photoValue ? <img src={getActualPetImageUrl(photoValue)} alt="Pet" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-400"><FiCamera className="h-8 w-8" /></div>}
                    </button>
                    <input id={`photo-upload-${index}`} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(index, e)} />
                    <div><p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Pet Photo</p><p className="text-xs text-zinc-500">Up to 5MB</p></div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Pet Name *</label>
                      <input {...register(`pets.${index}.name`)} className={getInputClass(errors.pets?.[index]?.name)} />
                      {errors.pets?.[index]?.name && <p className="mt-1 text-xs text-red-500">{errors.pets[index].name.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Breed</label>
                      <div className="relative">
                        <select {...register(`pets.${index}.breed_id`)} className={getSelectClass(errors.pets?.[index]?.breed_id)}>
                          <option value="">Select...</option>
                          {speciesList.flatMap(s => (s.breeds || []).map(b => ({ ...b, speciesName: s.name }))).map(b => (
                            <option key={b.id} value={b.id}>{b.name} ({b.speciesName})</option>
                          ))}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="hidden" {...register(`pets.${index}.species_id`)} />
                      <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Sex</label>
                        <div className="relative">
                          <select {...register(`pets.${index}.sex`)} className={getSelectClass(errors.pets?.[index]?.sex)}>
                            <option>Male</option><option>Female</option><option>Male (Neutered)</option><option>Female (Spayed)</option>
                          </select>
                          <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Date of Birth</label>
                        <input type="date" {...register(`pets.${index}.date_of_birth`)} className={getInputClass(errors.pets?.[index]?.date_of_birth)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Weight *</label>
                        <div className="flex gap-2">
                          <input type="number" step="any" {...register(`pets.${index}.weight`)} className={getInputClass(errors.pets?.[index]?.weight)} placeholder="0.0" />
                          <div className="relative">
                            <select {...register(`pets.${index}.weight_unit`)} className="w-20 h-12 rounded-xl border border-zinc-200 bg-white p-2 text-sm dark:bg-zinc-800 dark:border-dark-border appearance-none pl-4 pr-8">
                              <option value="kg">kg</option><option value="lbs">lbs</option>
                            </select>
                            <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                        {errors.pets?.[index]?.weight && <p className="mt-1 text-xs text-red-500">{errors.pets[index].weight.message}</p>}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Age Group</label>
                        <div className="flex h-12 items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 dark:bg-dark-card dark:text-zinc-200 dark:border-dark-border">
                          {petsWatch[index]?.age_group || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {VET_AND_ADMIN.includes(user?.role) && (
                    <div className="pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
                      <h4 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                          <LuFilePlus2 className="h-4 w-4" /> Medical History (Optional)
                      </h4>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Allergies</label><input {...register(`pets.${index}.allergies`)} className={getInputClass(errors.pets?.[index]?.allergies)} placeholder="None recorded" /></div>
                        <div><label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Current Medication</label><input {...register(`pets.${index}.medication`)} className={getInputClass(errors.pets?.[index]?.medication)} placeholder="None recorded" /></div>
                        
                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Attending Veterinarian</label>
                          <div className="relative">
                            <select {...register(`pets.${index}.vet_id`)} className={getSelectClass(errors.pets?.[index]?.vet_id)}>
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
                          <input {...register(`pets.${index}.chief_complaint`)} className={getInputClass(errors.pets?.[index]?.chief_complaint)} placeholder="Reason for visit" />
                        </div>
                        
                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Clinical Findings</label>
                          <textarea {...register(`pets.${index}.findings`)} rows="2" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm focus:outline-none dark:bg-dark-card dark:border-dark-border dark:text-zinc-200" placeholder="Observations..."></textarea>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Diagnosis</label>
                          <textarea {...register(`pets.${index}.diagnosis`)} rows="2" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm focus:outline-none dark:bg-dark-card dark:border-dark-border dark:text-zinc-200" placeholder="Initial diagnosis..."></textarea>
                        </div>

                        <div className="lg:col-span-2">
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Treatment Plan</label>
                          <textarea {...register(`pets.${index}.treatment_plan`)} rows="2" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm focus:outline-none dark:bg-dark-card dark:border-dark-border dark:text-zinc-200" placeholder="Prescriptions, procedures, etc."></textarea>
                        </div>

                        <div className="lg:col-span-2">
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-zinc-500">Notes</label>
                          <textarea {...register(`pets.${index}.notes`)} rows="3" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm focus:outline-none dark:bg-dark-card dark:border-dark-border dark:text-zinc-200" placeholder="Additional notes..."></textarea>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            <button type="button" onClick={() => append(emptyPet)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 py-4 text-sm font-bold text-emerald-600 hover:bg-emerald-100 transition-colors dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:hover:bg-emerald-900/20">
              <FiPlus className="h-5 w-5" /> Add Another Pet
            </button>
          </section>
        </form>
      </section>
    </div>
  );
}

export default AddPetFormView;
