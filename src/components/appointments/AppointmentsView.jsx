import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  FiBell,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiPlusCircle,
} from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { format, addMonths, subMonths } from "date-fns";
import { generateCalendarGrid } from "../../utils/calendarUtils";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const viewModes = ["Month", "Week", "Day"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const quickAddSchema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required").regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  pet_id: z.string().min(1, "Please select a pet"),
  service_id: z.string().min(1, "Please select a service"),
  vet_id: z.string().optional(),
  notes: z.string().optional(),
});

function AppointmentsView() {
  const toast = useToast();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preSelectedPetId = queryParams.get("petId") || queryParams.get("patientId");

  const [activeViewMode, setActiveViewMode] = useState("Month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [aiForecast, setAiForecast] = useState(null);
  const [categories, setCategories] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      date: "",
      time: "",
      pet_id: preSelectedPetId || "",
      service_id: "",
      vet_id: "",
      notes: ""
    }
  });

  const watchPetId = watch("pet_id");

  // Update form if preSelectedPetId changes
  useEffect(() => {
    if (preSelectedPetId) {
      setValue("pet_id", preSelectedPetId);
    }
  }, [preSelectedPetId, setValue]);

  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [vets, setVets] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  const fetchAppointments = () => {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => setAppointments(data))
      .catch((err) => console.error("Error fetching appointments:", err));
  };

  useEffect(() => {
    fetchAppointments();
    
    fetch("/api/owners")
      .then((res) => res.json())
      .then((data) => setOwners(data))
      .catch((err) => console.error("Error fetching owners:", err));

    fetch("/api/pets")
      .then((res) => res.json())
      .then((data) => setPets(data))
      .catch((err) => console.error("Error fetching pets:", err));

    fetch("/api/services")
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error("Error fetching services:", err));

    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setVets(data))
      .catch((err) => console.error("Error fetching vets:", err));

    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        const inv = data.inventory_categories ? JSON.parse(data.inventory_categories) : [];
        const svc = data.service_categories ? JSON.parse(data.service_categories) : [];
        setCategories([...new Set([...inv, ...svc])]);
      })
      .catch(() => setCategories([]));

    // Fetch initial AI forecast
    fetch("/api/dashboard/appointment-forecast")
      .then(res => res.json())
      .then(data => setAiForecast(data))
      .catch(() => { });
  }, []);

  const handleReviewHints = () => {
    if (aiForecast) {
      toast.info(
        <div className="text-left">
          <p className="font-bold border-b border-blue-200 dark:border-blue-800 pb-1 mb-2">AI Planning Hints:</p>
          <ul className="list-disc pl-4 space-y-1 text-sm">
            {aiForecast.hints.map((hint, i) => <li key={i}>{hint}</li>)}
          </ul>
        </div>,
        { duration: 6000 }
      );
    } else {
      toast.info("AI Analysis is still processing historical data.");
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = { ...data };
      if (payload.pet_id) payload.pet_id = Number(payload.pet_id);
      if (payload.service_id) payload.service_id = Number(payload.service_id);
      if (payload.vet_id) payload.vet_id = Number(payload.vet_id);

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to schedule appointment.");
      }

      toast.success("Appointment Scheduled!");
      reset();
      fetchAppointments();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const calendarDays = generateCalendarGrid(currentDate, appointments);
  const qInputBase = "h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500";
  const getQInputClass = (error) => clsx(qInputBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-500 dark:border-dark-border");

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[2.35fr_1fr]">
      {/* ── Calendar panel ── */}
      <section className="card-shell overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-dark-border">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-dark-surface">
            {viewModes.map((mode) => (
              <button key={mode} onClick={() => setActiveViewMode(mode)} className={clsx("rounded-lg px-4 py-2 text-sm font-semibold transition-colors", activeViewMode === mode ? "bg-white text-blue-600 shadow-sm dark:bg-dark-card dark:text-blue-400" : "text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200")}>
                {mode}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface">
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <p className="min-w-[160px] text-center text-lg font-semibold text-slate-800 dark:text-zinc-100">{format(currentDate, "MMMM yyyy")}</p>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface">
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface">
          {weekDays.map((day) => (
            <div key={day} className="border-r border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-500 last:border-r-0 dark:border-dark-border dark:text-zinc-400">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((entry, index) => (
            <div key={`${entry.day}-${index}`} className="min-h-[136px] border-b border-r border-slate-200 p-2 last:border-r-0 dark:border-dark-border">
              <p className={clsx("text-sm font-medium", entry.inMonth ? "text-slate-700 dark:text-zinc-300" : "text-slate-400 dark:text-zinc-600")}>{entry.day}</p>
              <div className="mt-2 space-y-2">
                {entry.events.map((event) => (
                  <article key={event.id} className="rounded-lg border-l-2 border-blue-500 bg-blue-50/50 px-2 py-1.5 text-xs font-medium dark:bg-blue-900/20 dark:text-blue-200">
                    <p className="font-semibold">{event.time}</p>
                    <p className="truncate">{event.title}</p>
                    {event.pet && <p className="truncate text-[10px] opacity-75">🐾 {event.pet.name}</p>}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sidebar panels ── */}
      <aside className="space-y-5">
        <section className="card-shell p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">BOOK APPOINTMENT</h3>
            <button onClick={() => reset()} className="text-sm font-semibold text-blue-600 dark:text-blue-400">Clear</button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-dark-border dark:bg-dark-surface/50">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">Client / Owner</label>
                <div className="relative">
                  <select value={selectedOwnerId} onChange={(e) => { setSelectedOwnerId(e.target.value); setValue("pet_id", ""); }} className={clsx(getQInputClass(false), "appearance-none pr-9")}>
                    <option value="">— Select Owner —</option>
                    {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">Patient / Pet *</label>
                <div className="relative">
                  <select {...register("pet_id")} disabled={!selectedOwnerId} className={clsx(getQInputClass(errors.pet_id), "appearance-none pr-9")}>
                    <option value="">— Select Pet —</option>
                    {pets.filter(p => p.owner_id.toString() === selectedOwnerId.toString()).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species?.name})</option>)}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                {errors.pet_id && <p className="mt-1 text-xs text-red-500">{errors.pet_id.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">Service *</label>
                <div className="relative">
                  <select {...register("service_id")} className={clsx(getQInputClass(errors.service_id), "appearance-none pr-9")}>
                    <option value="">— Select Service —</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                {errors.service_id && <p className="mt-1 text-xs text-red-500">{errors.service_id.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">Date</label>
                <input type="date" {...register("date")} className={getQInputClass(errors.date)} />
                {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">Time</label>
                <input type="time" {...register("time")} className={getQInputClass(errors.time)} />
                {errors.time && <p className="mt-1 text-xs text-red-500">{errors.time.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">Assign Vet</label>
              <div className="relative">
                <select {...register("vet_id")} className={clsx(getQInputClass(false), "appearance-none pr-9")}>
                  <option value="">— Select Vet —</option>
                  {vets.map(v => <option key={v.id} value={v.id}>Dr. {v.name}</option>)}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">Notes / Reason</label>
              <textarea {...register("notes")} className={getQInputClass(false)} placeholder="e.g. Limping on back leg..." rows={2}></textarea>
            </div>

            <button type="submit" disabled={isSubmitting} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all">
              <FiPlusCircle className="h-5 w-5" />
              {isSubmitting ? "Bookings..." : "Book Appointment"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-600/30 dark:bg-blue-600/10">
          <div className="mb-2 inline-flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <LuSparkles className="h-4 w-4" />
            <p className="text-sm font-bold uppercase tracking-wide">AI Forecast Alert</p>
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-300">{aiForecast?.insight || "Analyzing clinic data for scheduling trends and staffing recommendations..."}</p>
          <button onClick={handleReviewHints} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
            <FiBell className="h-4 w-4" />
            Review planning hints
          </button>
        </section>
      </aside>
    </div>
  );
}

export default AppointmentsView;
