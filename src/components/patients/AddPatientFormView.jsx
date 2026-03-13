import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { FiCalendar, FiChevronDown, FiCheckCircle, FiAlertCircle, FiCamera } from "react-icons/fi";
import { LuFilePlus2, LuPawPrint } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const steps = ["Pet Information", "Owner Details", "Medical History"];

const inputBase =
  "h-12 w-full rounded-xl border bg-slate-50 px-4 text-base text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800";

const selectBase =
  "h-12 w-full rounded-xl border bg-slate-50 px-4 text-base text-slate-700 focus:bg-white focus:outline-none appearance-none pr-10 dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800";

const getInputClass = (error) => clsx(inputBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-300 dark:border-dark-border dark:focus:border-blue-500");
const getSelectClass = (error) => clsx(selectBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-300 dark:border-dark-border dark:focus:border-blue-500");

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
  species: z.string().min(1, "Species is required").max(255),
  breed: z.string().max(255).optional(),
  date_of_birth: z.string().optional().or(z.literal("")),
  gender: z.string().max(50).optional(),
  color: z.string().max(255).optional(),
  weight: z.coerce.number().min(0, "Weight must be valid").optional().or(z.literal("")),
  status: z.string().max(50).optional(),
  owner_name: z.string().min(1, "Owner name is required").max(255),
  owner_phone: z.string().regex(/^([0-9\s\-\+\(\)]*)$/, "Invalid phone format").max(50).optional().or(z.literal("")),
  owner_email: z.string().email("Invalid email address").max(255).optional().or(z.literal("")),
  owner_address: z.string().min(1, "Street address is required").max(255),
  owner_city: z.string().min(1, "City is required").max(255),
  owner_province: z.string().min(1, "Province is required").max(255),
  owner_zip: z.string().min(1, "Zip Code is required").max(20),
  allergies: z.string().max(255).optional(),
  medication: z.string().max(255).optional(),
  notes: z.string().optional(),
  photo: z.string().optional()
});

function AddPatientFormView({ onCancel, onSave }) {
  const [error, setError] = useState(null);
  const photoInputRef = useRef(null);
  const [speciesList, setSpeciesList] = useState(["Canine", "Feline", "Avian", "Reptile", "Exotic", "Other"]);

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data.species_list) {
          setSpeciesList(JSON.parse(data.species_list));
        }
      })
      .catch(console.error);
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: "", species: "Canine", breed: "", date_of_birth: "",
      gender: "Male", color: "", weight: "",
      status: "Healthy",
      owner_name: "", owner_phone: "", owner_email: "",
      owner_address: "", owner_city: "", owner_province: "", owner_zip: "",
      allergies: "", medication: "", notes: "",
      photo: "",
    }
  });

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
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        const firstError = err.errors ? Object.values(err.errors)[0][0] : (err.message || "Failed to save patient.");
        throw new Error(firstError);
      }

      const savedPatient = await response.json();
      onSave(savedPatient);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Add New Patient</h2>
          <p className="mt-1 text-lg text-slate-500 dark:text-zinc-400">Register a new animal profile into your clinic records.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200 dark:hover:border-zinc-500">
            Cancel
          </button>
          <button
            type="submit"
            form="add-patient-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <FiCheckCircle className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Patient"}
          </button>
        </div>
      </div>

      <section className="card-shell overflow-hidden">
        <div className="flex flex-wrap items-center gap-8 border-b border-slate-200 px-6 py-4 dark:border-dark-border">
          {steps.map((step, index) => <StepPill key={step} index={index} label={step} active={index === 0} />)}
        </div>

        {error && (
          <div className="mx-6 mt-5 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <FiAlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form id="add-patient-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-6">
          {/* Pet Profile */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-zinc-50">
              <LuPawPrint className="h-6 w-6 text-blue-600" />
              Pet Profile
            </h3>

            {/* Photo Upload */}
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="group relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 transition-colors dark:border-dark-border dark:bg-dark-surface dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
              >
                {photoValue ? (
                  <img src={photoValue} alt="Pet preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1 text-slate-400 group-hover:text-blue-500">
                    <FiCamera className="h-7 w-7" />
                    <span className="text-xs font-medium">Add Photo</span>
                  </div>
                )}
                {photoValue && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FiCamera className="h-6 w-6 text-white" />
                  </div>
                )}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Pet Photo</p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">Click the box to upload a photo of the pet.</p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">JPG, PNG, GIF up to 5MB</p>
                {photoValue && (
                  <button
                    type="button"
                    onClick={() => setValue("photo", "")}
                    className="mt-2 text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Pet Name *</label>
                <input {...register("name")} className={getInputClass(errors.name)} placeholder="e.g. Daisy" />
                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Species *</label>
                <div className="relative">
                  <select {...register("species")} className={getSelectClass(errors.species)}>
                    {speciesList.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                {errors.species && <p className="mt-1 text-sm text-red-500">{errors.species.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Breed</label>
                <input {...register("breed")} className={getInputClass(errors.breed)} placeholder="e.g. Golden Retriever" />
                {errors.breed && <p className="mt-1 text-sm text-red-500">{errors.breed.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Date of Birth</label>
                  <div className="relative">
                    <input type="date" {...register("date_of_birth")} className={clsx(getInputClass(errors.date_of_birth), "pr-10")} />
                    <FiCalendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  {errors.date_of_birth && <p className="mt-1 text-sm text-red-500">{errors.date_of_birth.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Gender</label>
                  <div className="relative">
                    <select {...register("gender")} className={getSelectClass(errors.gender)}>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Male (Neutered)</option>
                      <option>Female (Spayed)</option>
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  {errors.gender && <p className="mt-1 text-sm text-red-500">{errors.gender.message}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Weight</label>
                <input type="number" step="0.01" min="0" {...register("weight")} className={getInputClass(errors.weight)} placeholder="e.g. 12.5 kg" />
                {errors.weight && <p className="mt-1 text-sm text-red-500">{errors.weight.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Color / Markings</label>
                <input {...register("color")} className={getInputClass(errors.color)} placeholder="e.g. White with brown patches" />
                {errors.color && <p className="mt-1 text-sm text-red-500">{errors.color.message}</p>}
              </div>
            </div>
          </section>

          <div className="h-px bg-slate-200 dark:bg-dark-surface" />

          {/* Primary Owner */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-zinc-50">
              <FiUser className="h-6 w-6 text-blue-600" />
              Primary Owner
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Full Name *</label>
                <input {...register("owner_name")} className={getInputClass(errors.owner_name)} placeholder="e.g. Jordan Miller" />
                {errors.owner_name && <p className="mt-1 text-sm text-red-500">{errors.owner_name.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Phone Number</label>
                <input {...register("owner_phone")} className={getInputClass(errors.owner_phone)} placeholder="(555) 000-0000" />
                {errors.owner_phone && <p className="mt-1 text-sm text-red-500">{errors.owner_phone.message}</p>}
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Email Address</label>
                <input type="email" {...register("owner_email")} className={getInputClass(errors.owner_email)} placeholder="owner@example.com" />
                {errors.owner_email && <p className="mt-1 text-sm text-red-500">{errors.owner_email.message}</p>}
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Street Address *</label>
                <input {...register("owner_address")} className={getInputClass(errors.owner_address)} placeholder="123 Main St" />
                {errors.owner_address && <p className="mt-1 text-sm text-red-500">{errors.owner_address.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">City *</label>
                <input {...register("owner_city")} className={getInputClass(errors.owner_city)} placeholder="City" />
                {errors.owner_city && <p className="mt-1 text-sm text-red-500">{errors.owner_city.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Province *</label>
                  <input {...register("owner_province")} className={getInputClass(errors.owner_province)} placeholder="State/Province" />
                  {errors.owner_province && <p className="mt-1 text-sm text-red-500">{errors.owner_province.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Zip Code *</label>
                  <input {...register("owner_zip")} className={getInputClass(errors.owner_zip)} placeholder="Zip" />
                  {errors.owner_zip && <p className="mt-1 text-sm text-red-500">{errors.owner_zip.message}</p>}
                </div>
              </div>
            </div>
          </section>

          <div className="h-px bg-slate-200 dark:bg-dark-surface" />

          {/* Medical Data */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-zinc-50">
              <LuFilePlus2 className="h-6 w-6 text-blue-600" />
              Initial Medical Data
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Allergies</label>
                <input {...register("allergies")} className={getInputClass(errors.allergies)} placeholder="Enter known allergies" />
                {errors.allergies && <p className="mt-1 text-sm text-red-500">{errors.allergies.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Current Medication</label>
                <input {...register("medication")} className={getInputClass(errors.medication)} placeholder="List active medications" />
                {errors.medication && <p className="mt-1 text-sm text-red-500">{errors.medication.message}</p>}
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Notes</label>
                <textarea
                  {...register("notes")}
                  className={clsx("w-full rounded-xl border bg-slate-50 px-4 py-3 text-base text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:bg-gray-800", errors.notes ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-300 dark:border-dark-border dark:focus:border-blue-500")}
                  rows={4}
                  placeholder="Add initial notes about this patient..."
                />
                {errors.notes && <p className="mt-1 text-sm text-red-500">{errors.notes.message}</p>}
              </div>
            </div>
          </section>
        </form>
      </section>
    </div>
  );
}

export default AddPatientFormView;
