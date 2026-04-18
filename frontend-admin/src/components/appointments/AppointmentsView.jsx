import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import echo from "../../utils/echo";
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
  FiBell,
  FiRefreshCcw,
  FiThumbsUp,
  FiThumbsDown
} from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { generateCalendarGrid, generateWeekGrid, generateDayGrid } from "../../utils/calendarUtils";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../context/AuthContext";
import ManualSendModal from "../notifications/ManualSendModal";

const viewModes = ["Month", "Week", "Day"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const quickAddSchema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required").regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  pet_id: z.string().min(1, "Please select a pet"),
  service_id: z.string().min(1, "Please select a service"),
  vet_id: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  if (data.date < todayStr) return false;
  if (data.date === todayStr) {
    const currentTime = format(now, "HH:mm");
    return data.time >= currentTime;
  }
  return true;
}, {
  message: "Cannot schedule appointments in the past.",
  path: ["time"],
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
  const { user } = useAuth();

  // New state for interactivity
  const [activePanel, setActivePanel] = useState("booking"); // 'booking' | 'details'
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

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
  const [availability, setAvailability] = useState([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const selectedDate = watch("date");
  const selectedVetId = watch("vet_id");

  useEffect(() => {
    if (selectedDate && user?.token) {
      setIsCheckingAvailability(true);
      const headers = {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      };
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedVetId) params.append('vet_id', selectedVetId);

      fetch(`/api/appointments/availability?${params.toString()}`, { headers })
        .then(res => res.json())
        .then(data => setAvailability(Array.isArray(data) ? data : []))
        .catch(console.error)
        .finally(() => setIsCheckingAvailability(false));
    }
  }, [selectedDate, selectedVetId, user?.token]);

  const fetchAppointments = () => {
    if (!user?.token) return;
    fetch("/api/appointments", {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
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
    if (!user?.token) return;

    fetchAppointments();

    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${user.token}`
    };

    fetch("/api/owners", { headers })
      .then((res) => res.json())
      .then((data) => setOwners(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching owners:", err));

    fetch("/api/pets", { headers })
      .then((res) => res.json())
      .then((data) => setPets(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching pets:", err));

    fetch("/api/services", { headers })
      .then((res) => res.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching services:", err));

    fetch("/api/vets", { headers })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVets(data);
        } else {
          setVets([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching vets:", err);
        setVets([]);
      });

    fetch("/api/settings", { headers })
      .then(res => res.json())
      .then(data => {
        const inv = data.inventory_categories ? JSON.parse(data.inventory_categories) : [];
        const svc = data.service_categories ? JSON.parse(data.service_categories) : [];
        setCategories([...new Set([...inv, ...svc])]);
      })
      .catch(() => setCategories([]));

    // Fetch initial AI forecast
    fetch("/api/dashboard/appointment-forecast", { headers })
      .then(res => res.json())
      .then(data => setAiForecast(data))
      .catch(() => { });

    // Real-time listeners
    const channel = echo.private('admin.appointments')
      .listen('.appointment.created', (e) => {
        setAppointments(prev => [e.appointment, ...prev]);
        toast.info(`New Appointment: ${e.appointment.pet?.name || 'Unknown Pet'}`);
      })
      .listen('.appointment.status.updated', (e) => {
        setAppointments(prev => prev.map(a => a.id === e.appointment.id ? e.appointment : a));
        if (selectedAppointment?.id === e.appointment.id) {
          setSelectedAppointment(e.appointment);
        }
        toast.info(`Appointment Updated: ${e.appointment.pet?.name} is now ${e.appointment.status}`);
      });

    return () => {
      echo.leave('admin.appointments');
    };
  }, [user?.token, selectedAppointment?.id, toast]);

  const handleReviewHints = () => {
    if (aiForecast) {
      toast.info(
        <div className="text-left">
          <p className="font-bold border-b border-emerald-200 dark:border-emerald-800 pb-1 mb-2">AI Planning Hints:</p>
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

      const url = selectedAppointment 
        ? `/api/appointments/${selectedAppointment.id}`
        : "/api/appointments";
      
      const method = selectedAppointment ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to save appointment.");
      }

      toast.success(selectedAppointment ? "Appointment Updated!" : "Appointment Scheduled!");
      reset();
      setSelectedAppointment(null);
      setIsDrawerOpen(false);
      fetchAppointments();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEditClick = () => {
    if (!selectedAppointment) return;
    
    // Set form values
    setValue("date", selectedAppointment.date);
    setValue("time", selectedAppointment.time?.substring(0, 5));
    setValue("pet_id", String(selectedAppointment.pet_id));
    setValue("service_id", String(selectedAppointment.service_id));
    setValue("vet_id", selectedAppointment.vet_id ? String(selectedAppointment.vet_id) : "");
    setValue("notes", selectedAppointment.notes || "");
    
    // Set selected owner so pet list populates
    if (selectedAppointment.pet?.owner_id) {
      setSelectedOwnerId(String(selectedAppointment.pet.owner_id));
    }
    
    setActivePanel("booking");
  };

  const handleDayClick = (entry) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (entry.dateString < todayStr) return; // Prevent booking in the past

    reset({
      date: entry.dateString,
      time: "",
      pet_id: preSelectedPetId || "",
      service_id: "",
      vet_id: "",
      notes: ""
    });
    setSelectedAppointment(null);
    setSelectedOwnerId("");
    setActivePanel("booking");
    setIsDrawerOpen(true);
  };

  const handleAppointmentClick = (event, appointment) => {
    event.stopPropagation();
    setSelectedAppointment(appointment);
    setActivePanel("details");
    setIsDrawerOpen(true);
  };

  const handleStatusAction = async (action) => {
    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}/${action}`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || `Failed to ${action} appointment.`);
      }

      toast.success(`Appointment ${action} successfully.`);
      fetchAppointments();
      setSelectedAppointment(prev => ({ ...prev, status: action === 'approve' ? 'approved' : 'declined' }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSendReminder = () => {
    setIsSendModalOpen(true);
  };


  const handleDeleteAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to cancel/delete this appointment?")) return;
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      if (!response.ok) throw new Error("Failed to delete appointment");
      toast.success("Appointment Deleted");
      setActivePanel("booking");
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePrev = () => {
    if (activeViewMode === "Month") setCurrentDate(subMonths(currentDate, 1));
    else if (activeViewMode === "Week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (activeViewMode === "Month") setCurrentDate(addMonths(currentDate, 1));
    else if (activeViewMode === "Week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const calendarDays = activeViewMode === "Month"
    ? generateCalendarGrid(currentDate, appointments)
    : activeViewMode === "Week"
    ? generateWeekGrid(currentDate, appointments)
    : generateDayGrid(currentDate, appointments);

  const qInputBase = "h-11 w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500";
  const getQInputClass = (error) => clsx(qInputBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-zinc-200 focus:border-emerald-500 dark:border-dark-border");

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── Left Column: Calendar ── */}
      <div className="flex-1 min-w-0">
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition-colors duration-300 dark:border-dark-border dark:bg-dark-card">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-5 transition-colors duration-300 dark:border-dark-border">
            <div className="flex items-center gap-1.5 rounded-xl bg-zinc-100 p-1 dark:bg-dark-surface">
              {viewModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setActiveViewMode(mode)}
                  className={clsx(
                    "rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-tight transition-all",
                    activeViewMode === mode
                      ? "bg-white text-emerald-600 shadow-sm dark:bg-dark-card dark:text-emerald-400"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-zinc-50/50 dark:bg-dark-surface/30 rounded-2xl border border-zinc-100 dark:border-dark-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-400"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Declined/Cancelled/Past</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface"
                >
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="min-w-[140px] text-center text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 italic">
                  {activeViewMode === "Month" ? format(currentDate, "MMMM yyyy") : 
                   activeViewMode === "Week" ? `Week of ${format(currentDate, "MMM d")}` :
                   format(currentDate, "MMMM d, yyyy")}
                </h2>
                <button
                  onClick={handleNext}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface"
                >
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/50 dark:border-dark-border/50 dark:bg-dark-surface/30">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className={clsx(
            "grid divide-x divide-y divide-zinc-100 transition-colors duration-300 dark:divide-dark-border/50",
            activeViewMode === "Month" || activeViewMode === "Week" ? "grid-cols-7" : "grid-cols-1"
          )}>
            {calendarDays.map((entry, index) => {
              const todayStr = format(new Date(), "yyyy-MM-dd");
              const isToday = entry.dateString === todayStr;
              const isPast = entry.dateString < todayStr;

              if (activeViewMode === "Month" && !entry.inMonth) {
                return <div key={`empty-${index}`} className="min-h-[140px] bg-zinc-50/10 dark:bg-dark-surface/5" />;
              }

              return (
                <div
                  key={`${entry.dateString}-${index}`}
                  onClick={() => handleDayClick(entry)}
                  className={clsx(
                    "group relative min-h-[140px] p-2 transition-all cursor-pointer",
                    !entry.inMonth && "bg-zinc-50/20 dark:bg-dark-surface/10 opacity-40",
                    isToday && "bg-emerald-50/50 dark:bg-emerald-900/10",
                    isPast && "bg-zinc-100/50 dark:bg-zinc-800/40 grayscale-sm cursor-default",
                    !isPast && "hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={clsx(
                        "inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all",
                        isToday
                          ? "bg-emerald-600 text-white shadow-lg"
                          : (isPast ? "text-zinc-400 dark:text-zinc-600" : (entry.inMonth ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"))
                      )}
                    >
                      {entry.day}
                    </span>
                    {entry.events.length > 0 && (
                      <span className={clsx(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-md italic",
                        isPast ? "text-zinc-400 bg-zinc-100 dark:bg-zinc-800" : "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      )}>
                        {entry.events.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {entry.events.map((event) => {
                      // Status logic:
                      // Grey: Pending
                      // Green: Approved / Completed
                      // Red: Declined / Cancelled / Past its time if still pending
                      const isPast = new Date(`${event.date}T${event.time}`) < new Date();
                      
                      let statusColorClass = "";
                      let statusText = event.status;

                      if (event.status === 'approved' || event.status === 'completed') {
                        statusColorClass = "border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300";
                        if (event.status === 'approved') statusText = 'Approved';
                        if (event.status === 'completed') statusText = 'Completed';
                      } else if (event.status === 'declined' || event.status === 'cancelled' || (event.status === 'pending' && isPast)) {
                        statusColorClass = "border-rose-400/50 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300";
                        if (event.status === 'declined') statusText = 'Declined';
                        if (event.status === 'cancelled') statusText = 'Cancelled';
                        if (event.status === 'pending' && isPast) statusText = 'Past/No Show';
                      } else {
                        // Default pending
                        statusColorClass = "border-zinc-400/50 bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
                        statusText = 'Pending';
                      }

                      return (
                        <article
                          key={event.id}
                          onClick={(e) => handleAppointmentClick(e, event)}
                          className={clsx(
                            "rounded-lg border-l-4 px-2 py-1 text-[10px] font-bold shadow-sm transition-all hover:translate-x-1 group/appt",
                            statusColorClass
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

      {/* ── Slide-Over Drawer ── */}
      <div
        className={clsx(
          "fixed inset-0 z-[60] transition-opacity duration-500 ease-in-out",
          isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          onClick={() => { setIsDrawerOpen(false); setSelectedAppointment(null); }}
        />

        {/* Dynamic Panel Content */}
        <aside
          className={clsx(
            "absolute inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-dark-card shadow-[-20px_0_50px_-10px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.3,1)] overflow-y-auto",
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {activePanel === "booking" ? (
            <section className="p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic">
                    <span className="text-emerald-600 dark:text-emerald-400 mr-2">/</span>Schedule
                  </h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Add new clinical entry</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reset()} className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-600 transition-colors">Clear</button>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-dark-border transition-all"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-5 rounded-[2rem] border-2 border-zinc-100 bg-zinc-50/30 p-8 dark:border-dark-border dark:bg-dark-surface/30">
                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Client / Owner Record</label>
                    <div className="relative">
                      <select value={selectedOwnerId} onChange={(e) => { setSelectedOwnerId(e.target.value); setValue("pet_id", ""); }} className={clsx(getQInputClass(false), "appearance-none pr-10 font-bold bg-white dark:bg-dark-card")}>
                        <option value="">— Select Owner —</option>
                        {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Patient / Pet Identification *</label>
                    <div className="relative">
                      <select {...register("pet_id")} disabled={!selectedOwnerId} className={clsx(getQInputClass(errors.pet_id), "appearance-none pr-10 font-bold bg-white dark:bg-dark-card")}>
                        <option value="">— Select Pet —</option>
                        {pets.filter(p => p.owner_id.toString() === selectedOwnerId.toString()).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species?.name})</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    </div>
                    {errors.pet_id && <p className="mt-2 text-xs text-red-500 font-black italic">{errors.pet_id.message}</p>}
                  </div>

                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Clinical Service *</label>
                    <div className="relative">
                      <select {...register("service_id")} className={clsx(getQInputClass(errors.service_id), "appearance-none pr-10 font-bold bg-white dark:bg-dark-card")}>
                        <option value="">— Select Service —</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    </div>
                    {errors.service_id && <p className="mt-2 text-xs text-red-500 font-black italic">{errors.service_id.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Date</label>
                    <input type="date" {...register("date")} className={clsx(getQInputClass(errors.date), "font-bold bg-white dark:bg-dark-card")} />
                    {errors.date && <p className="mt-1 text-xs text-red-500 font-bold">{errors.date.message}</p>}
                  </div>
                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Time</label>
                    <input type="time" {...register("time")} className={clsx(getQInputClass(errors.time), "font-bold bg-white dark:bg-dark-card")} />
                    {errors.time && <p className="mt-1 text-xs text-red-500 font-bold">{errors.time.message}</p>}
                  </div>
                </div>

                {/* Availability List */}
                {selectedDate && (
                  <div className="rounded-2xl bg-zinc-50 dark:bg-dark-surface/50 p-4 border border-zinc-100 dark:border-dark-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Already Booked Slots</p>
                    <div className="flex flex-wrap gap-2">
                      {isCheckingAvailability ? (
                        <span className="text-xs text-zinc-400 animate-pulse font-bold">Synchronizing availability...</span>
                      ) : availability.length > 0 ? (
                        availability.map((a) => (
                          <span key={a.id} className="px-3 py-1.5 rounded-xl bg-white dark:bg-dark-card text-zinc-600 dark:text-zinc-300 text-[11px] font-black border border-zinc-200 dark:border-dark-border shadow-sm">
                            {a.time.substring(0, 5)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-black uppercase italic">No overlaps — All slots free</span>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Assigned Veterinarian</label>
                  <div className="relative">
                    <select {...register("vet_id")} className={clsx(getQInputClass(false), "appearance-none pr-10 font-bold bg-white dark:bg-dark-card")}>
                      <option value="">— Select Vet —</option>
                      {vets.map(v => <option key={v.id} value={v.id}>Dr. {v.name}</option>)}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-401" />
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Notes / Clinical Reason</label>
                  <textarea {...register("notes")} className={clsx(getQInputClass(false), "bg-white dark:bg-dark-card min-h-[120px] py-4")} placeholder="Describe the reason for visit..." rows={3}></textarea>
                </div>

                <button type="submit" disabled={isSubmitting} className="inline-flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-emerald-500/40 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all mt-4">
                  <FiPlusCircle className="h-6 w-6" />
                  {isSubmitting ? "Syncing..." : "Finalize Appointment"}
                </button>
              </form>
            </section>
          ) : (
            <section className="p-0">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 p-8 dark:border-dark-border bg-white/80 dark:bg-dark-card/80 backdrop-blur-lg">
                <div>
                  <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic">
                    <span className="text-emerald-600 dark:text-emerald-400 mr-2">/</span>Clinical Details
                  </h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Internal record view</p>
                </div>
                <div className="flex gap-2">
                  {selectedAppointment?.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusAction('approve')}
                        className="rounded-2xl bg-emerald-100 p-3 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-800/50 transition-all active:scale-90"
                        title="Approve Appointment"
                      >
                        <FiThumbsUp className="h-6 w-6" />
                      </button>
                      <button
                        onClick={() => handleStatusAction('decline')}
                        className="rounded-2xl bg-rose-100 p-3 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-800/50 transition-all active:scale-90"
                        title="Decline Appointment"
                      >
                        <FiThumbsDown className="h-6 w-6" />
                      </button>
                    </>
                  )}
                  {selectedAppointment?.status === 'approved' && (
                    <button
                      onClick={handleSendReminder}
                      className="rounded-2xl bg-indigo-100 p-3 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-800/50 transition-all active:scale-90"
                      title="Send Reminder"
                    >
                      <FiBell className="h-6 w-6" />
                    </button>
                  )}
                  <button
                    onClick={() => { setIsDrawerOpen(false); setSelectedAppointment(null); }}
                    className="rounded-2xl bg-zinc-100 p-3 text-zinc-500 hover:bg-zinc-200 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-dark-border transition-all active:scale-90"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-10">
                <div className="flex items-start gap-6">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[2rem] bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-xl shadow-emerald-500/10">
                    <FiInfo className="h-10 w-10" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 truncate italic leading-tight">{selectedAppointment?.title}</h4>
                    <div className={clsx(
                      "mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-black uppercase tracking-widest shadow-lg",
                      selectedAppointment?.status === "approved" || selectedAppointment?.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      selectedAppointment?.status === "declined" || selectedAppointment?.status === "cancelled" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {selectedAppointment?.status === "approved" || selectedAppointment?.status === "completed" && <FiCheckCircle className="h-4 w-4" />}
                      {selectedAppointment?.status === "declined" || selectedAppointment?.status === "cancelled" && <FiXCircle className="h-4 w-4" />}
                      {selectedAppointment?.status === "pending" && <FiAlertCircle className="h-4 w-4" />}
                      {selectedAppointment?.status || "pending"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 rounded-[2.5rem] border-2 border-zinc-100 bg-zinc-50/20 p-8 dark:border-dark-border dark:bg-dark-surface/10">
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-dark-card flex items-center justify-center shadow-md dark:shadow-none border border-zinc-100 dark:border-dark-border">
                      <FiCalendar className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Date Scheduled</p>
                      <p className="text-lg font-black text-zinc-800 dark:text-zinc-100">{selectedAppointment?.date ? format(new Date(selectedAppointment.date), "MMMM d, yyyy") : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-dark-card flex items-center justify-center shadow-md dark:shadow-none border border-zinc-100 dark:border-dark-border">
                      <FiClock className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Arrival Time</p>
                      <p className="text-lg font-black text-zinc-800 dark:text-zinc-100 italic">{selectedAppointment?.time?.substring(0, 5)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-dark-card flex items-center justify-center shadow-md dark:shadow-none border border-zinc-100 dark:border-dark-border">
                      <FiUser className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Patient & Guardian</p>
                      <p className="text-lg font-black text-zinc-800 dark:text-zinc-100 truncate">
                        {selectedAppointment?.pet?.name} <span className="mx-2 text-zinc-300 font-normal">|</span> <span className="text-zinc-500 dark:text-zinc-400">ID #{selectedAppointment?.pet?.owner_id}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {selectedAppointment?.notes && (
                  <div>
                    <label className="mb-4 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Case Notes / Context</label>
                    <div className="rounded-3xl bg-zinc-50 p-6 text-md font-medium leading-relaxed text-zinc-600 dark:bg-dark-surface dark:text-zinc-400 italic border-l-8 border-emerald-500/20 dark:border-emerald-400/10">
                      "{selectedAppointment.notes}"
                    </div>
                  </div>
                )}

                <div className="pt-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 text-center mb-6">Security & Lifecycle Actions</p>

                  {(selectedAppointment?.status === 'approved' || selectedAppointment?.status === 'pending') && (
                    <button
                      onClick={handleSendReminder}
                      className="mb-4 w-full flex h-14 items-center justify-center gap-3 rounded-2xl bg-indigo-100 text-sm font-black uppercase tracking-widest text-indigo-700 shadow-xl shadow-indigo-200/50 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-800/50 transition-all active:scale-95"
                    >
                      <FiBell className="h-5 w-5" />
                      Send Reminder
                    </button>
                  )}

                  <button
                    onClick={handleEditClick}
                    className="mb-4 w-full flex h-14 items-center justify-center gap-3 rounded-2xl border-2 border-emerald-100 text-sm font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900/30 dark:hover:bg-emerald-900/10 transition-all active:scale-95"
                  >
                    <FiCalendar className="h-5 w-5" />
                    Edit Details
                  </button>

                  <div className="grid grid-cols-2 gap-4">
                    {selectedAppointment?.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusAction('approve')}
                          className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-95"
                        >
                          <FiThumbsUp className="h-6 w-6" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusAction('decline')}
                          className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-rose-600 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-rose-500/30 hover:bg-rose-700 transition-all active:scale-95"
                        >
                          <FiThumbsDown className="h-6 w-6" />
                          Decline
                        </button>
                      </>
                    )}
                    {(selectedAppointment?.status === 'approved' || selectedAppointment?.status === 'declined' || selectedAppointment?.status === 'completed') && (
                      <button
                        onClick={() => handleStatusAction('completed')}
                        className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-95 col-span-2"
                      >
                        <FiCheckCircle className="h-6 w-6" />
                        Mark as Completed
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteAppointment(selectedAppointment?.id)}
                    className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-rose-100 text-sm font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-900/10 transition-all active:scale-95 mt-4"
                  >
                    <FiTrash2 className="h-6 w-6" />
                    Archive Appointment
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* AI Insights in Drawer Footer */}
          <section className="mt-auto border-t border-zinc-100 bg-emerald-50/30 p-8 dark:border-dark-border dark:bg-emerald-600/5">
            <div className="mb-4 inline-flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xl shadow-emerald-500/40">
                <LuSparkles className="h-5 w-5" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.2em] italic">Forecaster Intelligence</p>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-emerald-300/80 font-bold italic">{aiForecast?.insight || "Analyzing clinic data for scheduling trends..."}</p>
            <button onClick={handleReviewHints} className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
              <FiBell className="h-4 w-4" />
              Access planning matrix
            </button>
          </section>
        </aside>
      </div>

      <ManualSendModal 
        isOpen={isSendModalOpen} 
        onClose={() => setIsSendModalOpen(false)} 
        owner={owners.find(o => o.id === selectedAppointment?.pet?.owner_id)}
        relatedObject={selectedAppointment}
        relatedType="App\Models\Appointment"
      />
    </div>
  );
}

export default AppointmentsView;
