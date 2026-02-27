import { useState, useRef } from "react";
import clsx from "clsx";
import { FiCalendar, FiChevronDown, FiCheckCircle, FiAlertCircle, FiCamera } from "react-icons/fi";
import { LuFilePlus2, LuPawPrint } from "react-icons/lu";
import { FiUser } from "react-icons/fi";

const steps = ["Pet Information", "Owner Details", "Medical History"];

const inputBase =
  "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-800";

const selectBase =
  "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none appearance-none pr-10 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:focus:border-blue-500 dark:focus:bg-gray-800";

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

const INITIAL_FORM = {
  name: "", species: "Canine", breed: "", date_of_birth: "",
  gender: "Male", color: "", weight: "",
  status: "Healthy",
  owner_name: "", owner_phone: "", owner_email: "",
  allergies: "", medication: "", notes: "",
  photo: "",
};

function AddPatientFormView({ onCancel, onSave }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const photoInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, photo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
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
    } finally {
      setIsSubmitting(false);
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

        <form id="add-patient-form" onSubmit={handleSubmit} className="space-y-8 p-6">
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
                {form.photo ? (
                  <img src={form.photo} alt="Pet preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1 text-slate-400 group-hover:text-blue-500">
                    <FiCamera className="h-7 w-7" />
                    <span className="text-xs font-medium">Add Photo</span>
                  </div>
                )}
                {form.photo && (
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
                {form.photo && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, photo: "" }))}
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
                <input required name="name" value={form.name} onChange={handleChange} className={inputBase} placeholder="e.g. Daisy" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Species *</label>
                <div className="relative">
                  <select name="species" value={form.species} onChange={handleChange} className={selectBase}>
                    <option>Canine</option>
                    <option>Feline</option>
                    <option>Avian</option>
                    <option>Reptile</option>
                    <option>Exotic</option>
                    <option>Other</option>
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Breed</label>
                <input name="breed" value={form.breed} onChange={handleChange} className={inputBase} placeholder="e.g. Golden Retriever" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Date of Birth</label>
                  <div className="relative">
                    <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} className={clsx(inputBase, "pr-10")} />
                    <FiCalendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Gender</label>
                  <div className="relative">
                    <select name="gender" value={form.gender} onChange={handleChange} className={selectBase}>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Male (Neutered)</option>
                      <option>Female (Spayed)</option>
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Weight</label>
                <input name="weight" value={form.weight} onChange={handleChange} className={inputBase} placeholder="e.g. 12.5 kg" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Color / Markings</label>
                <input name="color" value={form.color} onChange={handleChange} className={inputBase} placeholder="e.g. White with brown patches" />
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
                <input required name="owner_name" value={form.owner_name} onChange={handleChange} className={inputBase} placeholder="e.g. Jordan Miller" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Phone Number</label>
                <input name="owner_phone" value={form.owner_phone} onChange={handleChange} className={inputBase} placeholder="(555) 000-0000" />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Email Address</label>
                <input type="email" name="owner_email" value={form.owner_email} onChange={handleChange} className={inputBase} placeholder="owner@example.com" />
              </div>
            </div>
          </section>

          <div className="h-px bg-slate-200" />

          {/* Medical Data */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-zinc-50">
              <LuFilePlus2 className="h-6 w-6 text-blue-600" />
              Initial Medical Data
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Allergies</label>
                <input name="allergies" value={form.allergies} onChange={handleChange} className={inputBase} placeholder="Enter known allergies" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Current Medication</label>
                <input name="medication" value={form.medication} onChange={handleChange} className={inputBase} placeholder="List active medications" />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-800"
                  rows={4}
                  placeholder="Add initial notes about this patient..."
                />
              </div>
            </div>
          </section>
        </form>
      </section>
    </div>
  );
}

export default AddPatientFormView;
