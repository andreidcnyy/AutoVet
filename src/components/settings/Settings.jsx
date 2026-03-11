import clsx from "clsx";
import { useState, useEffect } from "react";
import { FiHome, FiSave, FiSettings, FiTrash2, FiUserPlus, FiUsers } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const tabs = [
  { id: "clinic", label: "Clinic Profile", icon: FiHome },
  { id: "users", label: "User Management", icon: FiUsers },
  { id: "data", label: "Data Management", icon: FiSettings },
  { id: "system", label: "System & AI Preferences", icon: FiSettings },
];

const staffMembers = [
  { id: "u-1", name: "Dr. Sarah Jenkins", role: "Admin", status: "Active" },
  { id: "u-2", name: "Dr. Michael Ross", role: "Veterinarian", status: "Active" },
  { id: "u-3", name: "Emma Carter", role: "Staff", status: "Active" },
  { id: "u-4", name: "Kevin Patel", role: "Staff", status: "Inactive" },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={clsx(
        "relative inline-flex h-6 w-11 items-center rounded-full transition",
        checked ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-600"
      )}
    >
      <span
        className={clsx(
          "inline-block h-4 w-4 transform rounded-full bg-white transition",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

const clinicSchema = z.object({
  clinic_name: z.string().min(1, "Clinic Name is required").max(255),
  primary_email: z.string().min(1, "Primary Email is required").email("Invalid email address").max(255),
  phone_number: z.string().regex(/^([0-9\s\-\+\(\)]*)$/, "Invalid phone format").max(50).nullable().optional().or(z.literal("")),
  address: z.string().max(500).nullable().optional(),
  tax_rate: z.coerce.number().min(0, "Tax rate cannot exceed negative").max(100, "Tax rate cannot exceed 100").nullable().optional(),
  currency: z.string().max(50).nullable().optional(),
  invoice_notes_template: z.string().nullable().optional(),
  clinic_logo: z.string().nullable().optional()
});

function ClinicProfileTab() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      clinic_name: "",
      primary_email: "",
      phone_number: "",
      address: "",
      tax_rate: 8.0,
      currency: "USD ($)",
      invoice_notes_template: "",
      clinic_logo: ""
    }
  });

  const logoValue = watch("clinic_logo");

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setValue("clinic_logo", reader.result, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        reset(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching settings:", err);
        toast.error("Failed to load clinic settings.");
        setLoading(false);
      });
  }, [reset, toast]);

  const onSubmit = async (data) => {
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ settings: data })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to save settings");
      }

      const result = await response.json();
      reset(result.settings);
      toast.success("Clinic profile changes saved securely.");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const inputBase = "w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-700 dark:bg-dark-surface dark:text-zinc-200 focus:outline-none";
  const getInputClass = (error, isTextarea = false) => clsx(inputBase, isTextarea ? "py-2.5" : "h-11", error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-500 dark:border-dark-border");

  if (loading) {
    return <div className="p-6 text-slate-500">Loading settings...</div>;
  }

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Clinic Profile</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage core clinic details and billing defaults.</p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Clinic Logo</label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface shrink-0">
              {logoValue ? (
                <img src={logoValue} alt="Clinic Logo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                  <FiHome className="h-6 w-6" />
                </div>
              )}
            </div>
            <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:bg-dark-surface">
              Upload Logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
            {logoValue && (
              <button type="button" onClick={() => setValue("clinic_logo", "", { shouldDirty: true })} className="text-sm font-semibold text-red-500 hover:text-red-700">Remove</button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Clinic Name *</label>
            <input
              {...register("clinic_name")}
              className={getInputClass(errors.clinic_name)}
            />
            {errors.clinic_name && <p className="mt-1 text-sm text-red-500">{errors.clinic_name.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Primary Email *</label>
            <input
              {...register("primary_email")}
              type="email"
              className={getInputClass(errors.primary_email)}
            />
            {errors.primary_email && <p className="mt-1 text-sm text-red-500">{errors.primary_email.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Phone Number</label>
            <input
              {...register("phone_number")}
              className={getInputClass(errors.phone_number)}
            />
            {errors.phone_number && <p className="mt-1 text-sm text-red-500">{errors.phone_number.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Address</label>
            <input
              {...register("address")}
              className={getInputClass(errors.address)}
            />
            {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address.message}</p>}
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 dark:border-dark-border">
          <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Billing Settings</h4>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Default Tax Rate (%)</label>
              <input
                {...register("tax_rate")}
                type="number"
                step="0.01"
                min="0"
                className={getInputClass(errors.tax_rate)}
              />
              {errors.tax_rate && <p className="mt-1 text-sm text-red-500">{errors.tax_rate.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Currency</label>
              <input
                {...register("currency")}
                className={getInputClass(errors.currency)}
              />
              {errors.currency && <p className="mt-1 text-sm text-red-500">{errors.currency.message}</p>}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Default Invoice Note Template</label>
            <textarea
              {...register("invoice_notes_template")}
              rows="3"
              className={getInputClass(errors.invoice_notes_template, true)}
              placeholder="Use placeholders like {clinic_name}, {pet_name}, {owner_name}..."
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
              Available variables: {`{clinic_name}, {pet_name}, {owner_name}`}
            </p>
            {errors.invoice_notes_template && <p className="mt-1 text-sm text-red-500">{errors.invoice_notes_template.message}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <FiSave className="h-4 w-4" />
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section >
  );
}

function UserManagementTab() {
  const toast = useToast();
  return (
    <section className="card-shell p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">User Management</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Role-based access for clinic staff.</p>
        </div>
        <button onClick={() => toast.info("User creation form opened.")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          <FiUserPlus className="h-4 w-4" />
          Add New User
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {staffMembers.map((member) => (
              <tr key={member.id} className="border-b border-slate-200/80 dark:border-dark-border">
                <td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-zinc-50">{member.name}</td>
                <td className="px-4 py-4 text-sm text-slate-700 dark:text-zinc-300">{member.role}</td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                      member.status === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-100 text-slate-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400"
                    )}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toast.info(`Edit details for ${member.name}`)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface">Edit</button>
                    <button onClick={() => toast.warning(`Requested deletion for ${member.name}`)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30">
                      <FiTrash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SystemPreferencesTab() {
  const toast = useToast();
  const [aiForecasting, setAiForecasting] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [cloudSync, setCloudSync] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setMaintenanceMode(data.maintenance_mode === 'true' || data.maintenance_mode === true);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  }, []);

  const toggleMaintenance = async () => {
    const newValue = !maintenanceMode;
    setMaintenanceMode(newValue);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ settings: { maintenance_mode: newValue ? 'true' : 'false' } })
      });
      toast.success(newValue ? "Maintenance Mode enabled." : "Maintenance Mode disabled.");
    } catch {
      toast.error("Failed to update maintenance settings.");
      setMaintenanceMode(!newValue);
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading system preferences...</div>;

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">System &amp; AI Preferences</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Adjust automation and notification behavior.</p>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Enable AI Inventory Forecasting</p>
          <Toggle checked={aiForecasting} onChange={() => setAiForecasting((value) => !value)} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Low Stock Email Alerts</p>
          <Toggle checked={lowStockAlerts} onChange={() => setLowStockAlerts((value) => !value)} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">System Maintenance Mode</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Temporarily blocks users from accessing the clinic system.</p>
          </div>
          <Toggle checked={maintenanceMode} onChange={toggleMaintenance} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Auto-sync with Cloud Server</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Syncs offline local data when internet is available.</p>
          </div>
          <Toggle checked={cloudSync} onChange={() => setCloudSync((value) => !value)} />
        </div>
      </div>

      <button
        onClick={() => toast.info("Manual database backup initiated...")}
        className="mt-7 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:bg-dark-surface"
      >
        Perform Manual Backup
      </button>
    </section>
  );
}

function DataManagementTab() {
  const toast = useToast();
  const [speciesList, setSpeciesList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newSpecies, setNewSpecies] = useState("");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        try {
          setSpeciesList(data.species_list ? JSON.parse(data.species_list) : ["Canine", "Feline", "Avian", "Reptile", "Exotic", "Other"]);
          setCategoryList(data.inventory_categories ? JSON.parse(data.inventory_categories) : ["Vaccines", "Antibiotics", "Supplies", "Diagnostics"]);
        } catch {
          setSpeciesList(["Canine", "Feline", "Avian", "Reptile", "Exotic", "Other"]);
          setCategoryList(["Vaccines", "Antibiotics", "Supplies", "Diagnostics"]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          settings: {
            species_list: JSON.stringify(speciesList),
            inventory_categories: JSON.stringify(categoryList)
          }
        })
      });
      toast.success("Data lists updated securely.");
    } catch {
      toast.error("Failed to update lists.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSpecies = (e) => {
    e.preventDefault();
    const name = newSpecies.trim();
    if (name && !speciesList.includes(name)) {
      setSpeciesList([...speciesList, name]);
      setNewSpecies("");
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (name && !categoryList.includes(name)) {
      setCategoryList([...categoryList, name]);
      setNewCategory("");
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading data management...</div>;

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Data Management</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage dynamic list values used across the clinic system.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Species List</h4>
          </div>
          <form onSubmit={handleAddSpecies} className="flex gap-2">
            <input
              type="text"
              value={newSpecies}
              onChange={(e) => setNewSpecies(e.target.value)}
              placeholder="e.g. Amphibian"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {speciesList.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {s} <button onClick={() => setSpeciesList(speciesList.filter(i => i !== s))} className="ml-1 text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Inventory Categories</h4>
          </div>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Preventatives"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categoryList.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {c} <button onClick={() => setCategoryList(categoryList.filter(i => i !== c))} className="ml-1 text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <FiSave className="h-4 w-4" />
        {isSaving ? "Saving..." : "Save List Changes"}
      </button>
    </section>
  );
}

function Settings() {
  const [activeTab, setActiveTab] = useState("clinic");

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr]">
      <aside className="card-shell h-fit p-3">
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                  active ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main>
        {activeTab === "clinic" && <ClinicProfileTab />}
        {activeTab === "users" && <UserManagementTab />}
        {activeTab === "data" && <DataManagementTab />}
        {activeTab === "system" && <SystemPreferencesTab />}
      </main>
    </div>
  );
}

export default Settings;
