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

const eventToneStyles = {
  green: "border-green-500 bg-green-100/70 text-green-800 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600",
  amber: "border-amber-500 bg-amber-100/70 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600",
  indigo: "border-indigo-500 bg-indigo-100/70 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-600",
  rose: "border-rose-500 bg-rose-100/70 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-600",
  slate: "border-slate-400 bg-slate-200/80 text-slate-700 dark:bg-zinc-700/60 dark:text-zinc-300 dark:border-zinc-500",
};


const quickAddSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required").regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  tone: z.string().min(1, "Tone is required").max(50),
  patient_id: z.string().optional(),
});

function AppointmentsView() {
  const toast = useToast();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preSelectedPatientId = queryParams.get("patientId");

  const [activeViewMode, setActiveViewMode] = useState("Month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [aiForecast, setAiForecast] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      title: "",
      date: "",
      time: "",
      tone: "green",
      patient_id: preSelectedPatientId || ""
    }
  });

  // Update form if preSelectedPatientId changes
  useEffect(() => {
    if (preSelectedPatientId) {
      setValue("patient_id", preSelectedPatientId);
    }
  }, [preSelectedPatientId, setValue]);

  const fetchAppointments = () => {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => setAppointments(data))
      .catch((err) => console.error("Error fetching appointments:", err));
  };

  useEffect(() => {
    fetchAppointments();
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data) => setPatients(data))
      .catch((err) => console.error("Error fetching patients:", err));

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
      // Convert patient_id to number or remove if empty
      if (payload.patient_id) {
        payload.patient_id = Number(payload.patient_id);
      } else {
        delete payload.patient_id;
      }
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        if (err.errors) {
          throw new Error(Object.values(err.errors)[0][0]);
        }
        throw new Error(err.message || "Failed to schedule appointment.");
      }

      toast.success("Appointment Scheduled!");
      reset();
      fetchAppointments();
    } catch (err) {
      toast.error(err.message || "Error scheduling: " + err.message);
    }
  };

  const calendarDays = generateCalendarGrid(currentDate, appointments);

  // shared input class for Quick Add form
  const qInputBase = "h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500";
  const getQInputClass = (error) => clsx(qInputBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-500 dark:border-dark-border");

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[2.35fr_1fr]">
      {/* ── Calendar panel ── */}
      <section className="card-shell overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-dark-border">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-dark-surface">
            {viewModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveViewMode(mode)}
                className={clsx(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  activeViewMode === mode
                    ? "bg-white text-blue-600 shadow-sm dark:bg-dark-card dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <p className="min-w-[160px] text-center text-lg font-semibold text-slate-800 dark:text-zinc-100">
              {format(currentDate, "MMMM yyyy")}
            </p>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Week-day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface">
          {weekDays.map((day) => (
            <div
              key={day}
              className="border-r border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-500 last:border-r-0 dark:border-dark-border dark:text-zinc-400"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((entry, index) => (
            <div
              key={`${entry.day}-${index}`}
              className="min-h-[136px] border-b border-r border-slate-200 p-2 last:border-r-0 dark:border-dark-border"
            >
              <p className={clsx("text-sm font-medium", entry.inMonth ? "text-slate-700 dark:text-zinc-300" : "text-slate-400 dark:text-zinc-600")}>
                {entry.day}
              </p>
              <div className="mt-2 space-y-2">
                {entry.events.map((event) => (
                  <article
                    key={event.id}
                    className={clsx(
                      "rounded-lg border-l-2 px-2 py-1.5 text-xs font-medium",
                      eventToneStyles[event.tone] || eventToneStyles.slate
                    )}
                  >
                    <p className="font-semibold">{event.time}</p>
                    <p className="truncate">{event.title}</p>
                    {event.patient && (
                      <p className="truncate text-[10px] opacity-75">🐾 {event.patient.name}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sidebar panels ── */}
      <aside className="space-y-5">
        {/* Quick Add */}
        <section className="card-shell p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">QUICK ADD</h3>
            <button onClick={() => {
              reset();
              toast.info("Form cleared.");
            }} className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              Clear
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Book Appointment:</label>
              <input
                type="text"
                {...register("title")}
                placeholder="e.g. Bella - Vaccination"
                className={getQInputClass(errors.title)}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Date</label>
                <input type="date" {...register("date")} className={getQInputClass(errors.date)} />
                {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Time</label>
                <input type="time" {...register("time")} className={getQInputClass(errors.time)} />
                {errors.time && <p className="mt-1 text-xs text-red-500">{errors.time.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Event Color Tag</label>
              <div className="relative">
                <select
                  {...register("tone")}
                  className={clsx(getQInputClass(errors.tone), "appearance-none pr-9")}
                >
                  <option value="green">Green (General)</option>
                  <option value="blue">Blue (Wellness)</option>
                  <option value="indigo">Indigo (Checkup)</option>
                  <option value="amber">Amber (Warning)</option>
                  <option value="rose">Rose (Emergency)</option>
                  <option value="slate">Slate (Admin)</option>
                </select>
                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-400" />
              </div>
              {errors.tone && <p className="mt-1 text-xs text-red-500">{errors.tone.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Link Patient (optional)</label>
              <div className="relative">
                <select
                  {...register("patient_id")}
                  className={clsx(getQInputClass(false), "appearance-none pr-9")}
                >
                  <option value="">— No patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.species || "Unknown"}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <FiPlusCircle className="h-4 w-4" />
              {isSubmitting ? "Scheduling..." : "Schedule"}
            </button>
          </form>
        </section>


        {/* AI Forecast Alert */}
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-600/30 dark:bg-blue-600/10">
          <div className="mb-2 inline-flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <LuSparkles className="h-4 w-4" />
            <p className="text-sm font-bold uppercase tracking-wide">AI Forecast Alert</p>
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-300">
            {aiForecast?.insight || "Analyzing clinic data for scheduling trends and staffing recommendations..."}
          </p>
          <button
            onClick={handleReviewHints}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <FiBell className="h-4 w-4" />
            Review planning hints
          </button>
        </section>
      </aside>
    </div>
  );
}

export default AppointmentsView;
