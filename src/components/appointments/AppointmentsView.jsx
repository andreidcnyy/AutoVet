import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  FiPlusCircle,
  FiClock,
  FiUser,
  FiCalendar,
  FiInfo,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiXCircle,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiChevronUp,
  FiBell
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

  // New state for interactivity
  const [activePanel, setActivePanel] = useState("booking"); // 'booking' | 'details'
  const [selectedAppointment, setSelectedAppointment] = useState(null);

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
      .then((data) => {
        // Ensure data is an array
        if (Array.isArray(data)) {
          setAppointments(data);
        } else if (data && typeof data === "object" && Array.isArray(data.appointments)) {
          setAppointments(data.appointments);
        } else {
          setAppointments([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching appointments:", err);
        setAppointments([]);
      });
  };

  useEffect(() => {
    fetchAppointments();

    fetch("/api/owners")
      .then((res) => res.json())
      .then((data) => setOwners(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Error fetching owners:", err);
        setOwners([]);
      });

    fetch("/api/pets")
      .then((res) => res.json())
      .then((data) => setPets(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Error fetching pets:", err);
        setPets([]);
      });

    fetch("/api/services")
      .then((res) => res.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Error fetching services:", err);
        setServices([]);
      });

    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setVets(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Error fetching vets:", err);
        setVets([]);
      });

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

  const handleDayClick = (entry) => {
    setValue("date", entry.dateString);
    setActivePanel("booking");
    setSelectedAppointment(null);
  };

  const handleAppointmentClick = (event, appointment) => {
    event.stopPropagation();
    setSelectedAppointment(appointment);
    setActivePanel("details");
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedAppointment,
          status,
          pet_id: selectedAppointment.pet_id,
          service_id: selectedAppointment.service_id,
          date: selectedAppointment.date,
          time: selectedAppointment.time?.substring(0, 5), // Ensure HH:mm format
        }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      toast.success(`Appointment marked as ${status}`);
      fetchAppointments();
      // Update local state if needed
      setSelectedAppointment(prev => ({ ...prev, status }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to cancel/delete this appointment?")) return;
    try {
      const response = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete appointment");
      toast.success("Appointment Deleted");
      setActivePanel("booking");
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const calendarDays = generateCalendarGrid(currentDate, appointments);
  const qInputBase = "h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500";
  const getQInputClass = (error) => clsx(qInputBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-500 dark:border-dark-border");

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── Left Column: Calendar ── */}
      <div className="flex-1 min-w-0">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-dark-border dark:bg-dark-card">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 transition-colors duration-300 dark:border-dark-border">
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-dark-surface">
              {viewModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setActiveViewMode(mode)}
                  className={clsx(
                    "rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-tight transition-all",
                    activeViewMode === mode
                      ? "bg-white text-blue-600 shadow-sm dark:bg-dark-card dark:text-blue-400"
                      : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface"
                >
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="min-w-[140px] text-center text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100 italic">
                  {format(currentDate, "MMMM yyyy")}
                </h2>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface"
                >
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 dark:border-dark-border/50 dark:bg-dark-surface/30">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 transition-colors duration-300 dark:divide-dark-border/50">
            {calendarDays.map((entry, index) => {
              const isToday = entry.dateString === format(new Date(), "yyyy-MM-dd");
              return (
                <div
                  key={`${entry.day}-${index}`}
                  onClick={() => handleDayClick(entry)}
                  className={clsx(
                    "group relative min-h-[140px] p-2 transition-all hover:bg-blue-50/30 dark:hover:bg-blue-500/5 cursor-pointer",
                    !entry.inMonth && "bg-slate-50/20 dark:bg-dark-surface/10 opacity-40",
                    isToday && "bg-blue-50/50 dark:bg-blue-900/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={clsx(
                        "inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all",
                        isToday
                          ? "bg-blue-600 text-white shadow-lg"
                          : (entry.inMonth ? "text-slate-700 dark:text-zinc-300" : "text-slate-400 dark:text-zinc-600")
                      )}
                    >
                      {entry.day}
                    </span>
                    {entry.events.length > 0 && (
                      <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md dark:bg-blue-900/20 italic">
                        {entry.events.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {entry.events.map((event) => {
                      const statusColors = {
                        pending: "border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
                        completed: "border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
                        cancelled: "border-rose-400/50 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300",
                      };
                      const currentColor = statusColors[event.status] || "border-blue-400/50 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300";

                      return (
                        <article
                          key={event.id}
                          onClick={(e) => handleAppointmentClick(e, event)}
                          className={clsx(
                            "rounded-lg border-l-4 px-2 py-1 text-[10px] font-bold shadow-sm transition-all hover:translate-x-1 group/appt",
                            currentColor
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate flex-1 uppercase">{event.title}</span>
                            <span className="opacity-70 whitespace-nowrap">{event.time?.substring(0, 5)}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Right Column: Side Action Panel ── */}
      <aside className="w-full shrink-0 lg:w-[420px]">
        <div className="sticky top-[104px] overflow-hidden rounded-3xl border border-slate-200 bg-white transition-colors duration-300 dark:border-dark-border dark:bg-dark-card shadow-sm">
          {activePanel === "booking" ? (
            <section className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 uppercase">
                    Book Appointment
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    reset();
                    setSelectedOwnerId("");
                    setSelectedAppointment(null);
                  }} 
                  className="text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Clear
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 dark:border-dark-border/50 dark:bg-dark-surface/20">
                  <div>
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Client / Owner</label>
                    <div className="relative">
                      <select 
                        value={selectedOwnerId} 
                        onChange={(e) => { setSelectedOwnerId(e.target.value); setValue("pet_id", ""); }} 
                        className={clsx(getQInputClass(false), "appearance-none pr-10 bg-white dark:bg-dark-surface")}
                      >
                        <option value="">— Select Owner —</option>
                        {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Patient / Pet *</label>
                    <div className="relative">
                      <select 
                        {...register("pet_id")} 
                        disabled={!selectedOwnerId} 
                        className={clsx(getQInputClass(errors.pet_id), "appearance-none pr-10 bg-white dark:bg-dark-surface")}
                      >
                        <option value="">— Select Pet —</option>
                        {pets.filter(p => p.owner_id.toString() === selectedOwnerId.toString()).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species?.name})</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    {errors.pet_id && <p className="mt-1 text-[10px] text-red-500 font-medium italic">{errors.pet_id.message}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Service *</label>
                    <div className="relative">
                      <select 
                        {...register("service_id")} 
                        className={clsx(getQInputClass(errors.service_id), "appearance-none pr-10 bg-white dark:bg-dark-surface")}
                      >
                        <option value="">— Select Service —</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    {errors.service_id && <p className="mt-1 text-[10px] text-red-500 font-medium italic">{errors.service_id.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Date</label>
                    <input type="date" {...register("date")} className={clsx(getQInputClass(errors.date), "bg-white dark:bg-dark-surface")} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Time</label>
                    <input type="time" {...register("time")} className={clsx(getQInputClass(errors.time), "bg-white dark:bg-dark-surface")} />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Assign Vet</label>
                  <div className="relative">
                    <select {...register("vet_id")} className={clsx(getQInputClass(false), "appearance-none pr-10 bg-white dark:bg-dark-surface")}>
                      <option value="">— Select Vet —</option>
                      {vets.map(v => <option key={v.id} value={v.id}>Dr. {v.name}</option>)}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">Notes / Reason</label>
                  <textarea 
                    {...register("notes")} 
                    className={clsx(getQInputClass(false), "bg-white dark:bg-dark-surface min-h-[100px] py-3")} 
                    placeholder="e.g. Limping on back leg..." 
                    rows={3}
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[13px] font-bold uppercase tracking-wider text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
                >
                  <FiPlusCircle className="h-5 w-5" />
                  {isSubmitting ? "Syncing..." : "Book Appointment"}
                </button>
              </form>

              {aiForecast && (
                <div className="mt-8 rounded-2xl bg-blue-50/50 p-4 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
                    <LuSparkles className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Forecaster</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-blue-300/70 italic">
                    {aiForecast.insight}
                  </p>
                </div>
              )}
            </section>
          ) : (
            <section className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="border-b border-slate-100 p-6 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 uppercase">
                    Appointment Details
                  </h3>
                  <button
                    onClick={() => { setActivePanel("booking"); setSelectedAppointment(null); }}
                    className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 dark:bg-dark-surface dark:text-zinc-400"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <FiInfo className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 leading-tight">
                      {selectedAppointment?.title}
                    </h4>
                    <div className={clsx(
                      "mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                      selectedAppointment?.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        selectedAppointment?.status === "cancelled" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {selectedAppointment?.status || "pending"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/30 p-5 dark:border-dark-border/50 dark:bg-dark-surface/10">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border text-blue-500">
                      <FiCalendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Date</p>
                      <p className="font-bold text-slate-800 dark:text-zinc-100">
                        {selectedAppointment?.date ? format(new Date(selectedAppointment.date), "MMMM d, yyyy") : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border text-blue-500">
                      <FiClock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Time</p>
                      <p className="font-bold text-slate-800 dark:text-zinc-100">
                        {selectedAppointment?.time?.substring(0, 5)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border text-blue-500">
                      <FiUser className="h-5 w-5" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Patient</p>
                      <p className="font-bold text-slate-800 dark:text-zinc-100 truncate">
                        {selectedAppointment?.pet?.name} <span className="mx-2 opacity-30">|</span> <span className="opacity-60 text-sm">#{selectedAppointment?.pet?.owner_id}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {selectedAppointment?.notes && (
                  <div>
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Context</p>
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-dark-surface dark:text-zinc-400 italic">
                      "{selectedAppointment.notes}"
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleStatusUpdate(selectedAppointment?.id, "completed")}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all"
                    >
                      <FiCheckCircle className="h-4 w-4" />
                      Complete
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedAppointment?.id, "cancelled")}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200 dark:bg-dark-surface dark:text-zinc-400 transition-all"
                    >
                      <FiXCircle className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                  <button
                    onClick={() => handleDeleteAppointment(selectedAppointment?.id)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-100 text-xs font-bold uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-900/10 transition-all"
                  >
                    <FiTrash2 className="h-4 w-4" />
                    Delete Record
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

export default AppointmentsView;
