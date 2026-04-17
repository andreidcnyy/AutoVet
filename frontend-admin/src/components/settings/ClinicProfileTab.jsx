import clsx from "clsx";
import { useState, useEffect } from "react";
import { FiHome, FiSave } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../context/AuthContext";
import PhoneInput from "../common/PhoneInput";

const clinicSchema = z.object({
  clinic_name: z.string().min(1, "Clinic Name is required").max(255),
  primary_email: z.string().min(1, "Primary Email is required").email("Invalid email address").max(255),
  phone_number: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  invoice_notes_template: z.string().nullable().optional(),
  clinic_logo: z.string().nullable().optional()
});

export default function ClinicProfileTab() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      clinic_name: "",
      primary_email: "",
      phone_number: "",
      address: "",
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
    if (!user?.token) return;
    fetch("/api/settings", {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        // Data from backend is a flat object: { key1: value1, key2: value2 }
        const merged = {
          clinic_name: data.clinic_name || "",
          primary_email: data.primary_email || "",
          phone_number: data.phone_number || "",
          address: data.address || "",
          invoice_notes_template: data.invoice_notes_template || "",
          clinic_logo: data.clinic_logo || ""
        };
        
        reset(merged);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching settings:", err);
        toast.error("Failed to load clinic settings.");
        setLoading(false);
      });
  }, [reset, toast, user?.token]);

  const onSubmit = async (data) => {
    try {
      const response = await fetch("/api/settings", {
        method: "POST", // Controller handles POST to /settings as update
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify({ settings: data })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to save settings");
      }

      // Backend returns { message: '...', settings: { ... } }
      const newSettings = result.settings || {};
      const merged = {
        clinic_name: newSettings.clinic_name || "",
        primary_email: newSettings.primary_email || "",
        phone_number: newSettings.phone_number || "",
        address: newSettings.address || "",
        invoice_notes_template: newSettings.invoice_notes_template || "",
        clinic_logo: newSettings.clinic_logo || ""
      };

      reset(merged);
      toast.success("Clinic profile changes saved securely.");
    } catch (error) {
      console.error("Submit Error:", error);
      toast.error(error.message);
    }
  };

  const onInvalid = (errors) => {
    console.warn("Form Validation Failed:", errors);
    toast.error("Please check the form for errors.");
  };

  const inputBase = "w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 dark:bg-dark-surface dark:text-zinc-200 focus:outline-none";
  const getInputClass = (error, isTextarea = false) => clsx(inputBase, isTextarea ? "py-2.5" : "h-11", error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-zinc-200 focus:border-emerald-500 dark:border-dark-border");

  if (loading) {
    return <div className="p-6 text-zinc-500">Loading settings...</div>;
  }

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Clinic Profile</h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage core clinic details and invoice defaults.</p>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Clinic Logo</label>
          <div className="flex items-center gap-4">
            <div className="h-32 w-32 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-dark-border dark:bg-dark-surface shrink-0 shadow-sm">
              {logoValue ? (
                <img src={logoValue} alt="Clinic Logo" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-400">
                  <FiHome className="h-10 w-10" />
                </div>
              )}
            </div>
            <label className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:bg-dark-surface">
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
            <label className="mb-1.5 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Clinic Name *</label>
            <input
              {...register("clinic_name")}
              className={getInputClass(errors.clinic_name)}
            />
            {errors.clinic_name && <p className="mt-1 text-sm text-red-500">{errors.clinic_name.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Primary Email *</label>
            <input
              {...register("primary_email")}
              type="email"
              className={getInputClass(errors.primary_email)}
            />
            {errors.primary_email && <p className="mt-1 text-sm text-red-500">{errors.primary_email.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Phone Number</label>
            <Controller
              name="phone_number"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Enter clinic phone..."
                />
              )}
            />
            {errors.phone_number && <p className="mt-1 text-sm text-red-500">{errors.phone_number.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Address</label>
            <input
              {...register("address")}
              className={getInputClass(errors.address)}
            />
            {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address.message}</p>}
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-dark-border">
          <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Invoice Configuration</h4>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Default Invoice Note Template</label>
            <textarea
              {...register("invoice_notes_template")}
              rows="3"
              className={getInputClass(errors.invoice_notes_template, true)}
              placeholder="Use placeholders like {clinic_name}, {pet_name}, {owner_name}..."
            />
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Available variables: {`{clinic_name}, {pet_name}, {owner_name}`}
            </p>
            {errors.invoice_notes_template && <p className="mt-1 text-sm text-red-500">{errors.invoice_notes_template.message}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <FiSave className="h-4 w-4" />
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section >
  );
}
