import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import echo from "../../utils/echo";
import api from "../../api";
import {
  FiPlusCircle,
  FiClock,
  FiUser,
  FiCalendar,
  FiInfo,
  FiX,
  FiSearch,
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
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { generateCalendarGrid, generateWeekGrid, generateDayGrid } from "../../utils/calendarUtils";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../context/AuthContext";
import ManualSendModal from "../notifications/ManualSendModal";

const viewModes = ["Month", "Week", "Day", "List"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Fix for YYYY-MM-DD timezone shift: use slashes instead of dashes to force local time parsing
const formatDateLocal = (dateStr, formatStr = "MMMM d, yyyy") => {
  if (!dateStr) return "";
  const normalizedDate = typeof dateStr === 'string' && dateStr.includes('-') ? dateStr.replace(/-/g, '/') : dateStr;
  const d = new Date(normalizedDate);
  if (isNaN(d.getTime())) return "N/A";
  return format(d, formatStr);
};

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
  const [appointments, setAppointments] = useState([]); // Now used for paginated list
  const [calendarSummaries, setCalendarSummaries] = useState([]); // NEW: for dots on calendar
  const [aiForecast, setAiForecast] = useState(null);
  const [categories, setCategories] = useState([]);
  const { user } = useAuth();

  // Unified State for Filtering and Pagination
  const [params, setParams] = useState({
    page: 1,
    status: "all",
    date: format(new Date(), "yyyy-MM-dd"), // Default to today
    vet_id: "",
    service_id: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // New state for interactivity
  const [activePanel, setActivePanel] = useState("booking"); // 'booking' | 'details'
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [declineModal, setDeclineModal] = useState({ open: false, reason: "", error: "", submitting: false });

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
      const params = { date: selectedDate };
      if (selectedVetId) params.vet_id = selectedVetId;

      api.get('/api/appointments/availability', { params })
        .then(data => setAvailability(Array.isArray(data) ? data : []))
        .catch(console.error)
        .finally(() => setIsCheckingAvailability(false));
    }
  }, [selectedDate, selectedVetId, user?.token]);

  // Fetch Calendar Summaries (Dots/Counts)
  const fetchCalendarSummaries = useCallback((signal) => {
    if (!user?.token) return;
    setIsSummaryLoading(true);

    const dateFrom = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const dateTo = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    api.get('/api/appointments/summary', { params: { date_from: dateFrom, date_to: dateTo }, signal })
      .then((data) => {
        setCalendarSummaries(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error("Error fetching summaries:", err);
      })
      .finally(() => setIsSummaryLoading(false));
  }, [user?.token, currentDate]);

  // Fetch Paginated List
  const fetchAppointments = useCallback((signal) => {
    if (!user?.token) return;
    setIsLoading(true);

    const queryParams = {
      page: params.page,
      per_page: 10,
      search: debouncedSearch,
      status: params.status,
      date: params.date,
      vet_id: params.vet_id,
      service_id: params.service_id,
    };

    api.get('/api/appointments', { params: queryParams, signal })
      .then((data) => {
        if (data && data.data) {
          setAppointments(data.data);
          setPagination({
            current_page: data.current_page,
            last_page: data.last_page,
            total: data.total
          });
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error("Error fetching appointments:", err);
      })
      .finally(() => setIsLoading(false));
  }, [user?.token, params, debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCalendarSummaries(controller.signal);
    return () => controller.abort();
  }, [fetchCalendarSummaries]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAppointments(controller.signal);
    return () => controller.abort();
  }, [fetchAppointments]);

  const handleParamChange = (newParams) => {
    setParams(prev => ({ ...prev, ...newParams, page: newParams.page || 1 }));
  };

  const refreshAllData = () => {
    const controller = new AbortController();
    fetchCalendarSummaries(controller.signal);
    fetchAppointments(controller.signal);
  };

  // Track whether form data has been loaded yet
  const [formDataLoaded, setFormDataLoaded] = useState(false);

  // Lazy-load owners/pets/services/vets only when booking drawer first opens
  useEffect(() => {
    if (!isDrawerOpen || formDataLoaded || !user?.token) return;
    Promise.allSettled([
      api.get('/api/owners', { cache: true }),
      api.get('/api/pets', { cache: true }),
      api.get('/api/services', { cache: true }),
      api.get('/api/vets', { cache: true }),
    ]).then(([ownersRes, petsRes, servicesRes, vetsRes]) => {
      setOwners(Array.isArray(ownersRes.value) ? ownersRes.value : []);
      setPets(Array.isArray(petsRes.value) ? petsRes.value : []);
      setServices(Array.isArray(servicesRes.value) ? servicesRes.value : []);
      setVets(Array.isArray(vetsRes.value) ? vetsRes.value : []);
      setFormDataLoaded(true);
    });
  }, [isDrawerOpen, formDataLoaded, user?.token]);

  useEffect(() => {
    if (!user?.token) return;

    // Load non-critical data (settings + forecast) after a short delay
    // so the calendar renders first
    const timer = setTimeout(() => {
      Promise.allSettled([
        api.get('/api/settings', { cache: true }),
        api.get('/api/dashboard/appointment-forecast', { cache: true, ttl: 3 * 60 * 1000 }),
      ]).then(([settingsRes, forecastRes]) => {
        const settingsData = settingsRes.status === 'fulfilled' ? settingsRes.value : {};
        const forecastData = forecastRes.status === 'fulfilled' ? forecastRes.value : null;
        const inv = settingsData?.inventory_categories ? (typeof settingsData.inventory_categories === 'string' ? JSON.parse(settingsData.inventory_categories) : settingsData.inventory_categories) : [];
        const svc = settingsData?.service_categories ? (typeof settingsData.service_categories === 'string' ? JSON.parse(settingsData.service_categories) : settingsData.service_categories) : [];
        setCategories([...new Set([...inv, ...svc])]);
        if (forecastData) setAiForecast(forecastData);
      });
    }, 300);

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
      clearTimeout(timer);
      echo.leave('admin.appointments');
    };
  }, [user?.token]);

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
    // Decline requires a reason — open modal instead of firing immediately
    if (action === 'decline') {
      setDeclineModal({ open: true, reason: "", error: "", submitting: false });
      return;
    }

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

  const submitDecline = async () => {
    const reason = declineModal.reason.trim();
    if (reason.length < 10) {
      setDeclineModal(prev => ({ ...prev, error: "Decline reason must be at least 10 characters." }));
      return;
    }
    setDeclineModal(prev => ({ ...prev, submitting: true, error: "" }));
    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}/decline`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to decline appointment.");
      }

      toast.success("Appointment declined.");
      fetchAppointments();
      setSelectedAppointment(prev => prev ? { ...prev, status: 'declined', decline_reason: reason } : prev);
      setDeclineModal({ open: false, reason: "", error: "", submitting: false });
    } catch (err) {
      setDeclineModal(prev => ({ ...prev, submitting: false, error: err.message }));
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

  const calendarDays = generateCalendarGrid(currentDate); // Minimal grid, no events here

  const qInputBase = "h-11 w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500";
  const getQInputClass = (error) => clsx(qInputBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-zinc-200 focus:border-emerald-500 dark:border-dark-border");

  return (
    <div className="flex flex-col gap-8">
      {/* ── Top Filters ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-white dark:bg-dark-card p-6 rounded-[2rem] border border-zinc-200 dark:border-dark-border shadow-sm transition-all duration-300">
        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search pet/owner..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-zinc-200 bg-zinc-50/50 focus:outline-none focus:border-emerald-500 dark:border-dark-border dark:bg-dark-surface/50 text-sm font-bold"
          />
        </div>
        <select 
          value={params.status} 
          onChange={(e) => handleParamChange({ status: e.target.value })}
          className="h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 focus:outline-none focus:border-emerald-500 dark:border-dark-border dark:bg-dark-surface/50 text-sm font-bold appearance-none pr-10 relative"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="declined">Declined</option>
          <option value="upcoming">Upcoming (Not completed/cancelled)</option>
          <option value="past">Past Appointments</option>
        </select>
        <select 
          value={params.vet_id} 
          onChange={(e) => handleParamChange({ vet_id: e.target.value })}
          className="h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 focus:outline-none focus:border-emerald-500 dark:border-dark-border dark:bg-dark-surface/50 text-sm font-bold appearance-none pr-10 relative"
        >
          <option value="">All Veterinarians</option>
          {vets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select 
          value={params.service_id} 
          onChange={(e) => handleParamChange({ service_id: e.target.value })}
          className="h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 focus:outline-none focus:border-emerald-500 dark:border-dark-border dark:bg-dark-surface/50 text-sm font-bold appearance-none pr-10 relative"
        >
          <option value="">All Services</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input 
            type="date" 
            value={params.date} 
            onChange={(e) => handleParamChange({ date: e.target.value })}
            className="flex-1 h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 focus:outline-none focus:border-emerald-500 dark:border-dark-border dark:bg-dark-surface/50 text-sm font-bold"
          />
          <button onClick={() => { setSearchTerm(""); handleParamChange({ date: "", status: "all", vet_id: "", service_id: "" }); }} className="p-3 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-dark-surface dark:text-zinc-400 transition-all">
            <FiRefreshCcw className={clsx(isLoading && "animate-spin")} />
          </button>
        </div>
      </section>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* ── Left Column: Lightweight Calendar Navigator ── */}
        <aside className="w-full xl:w-[400px] shrink-0 space-y-6">
          <section className="overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white shadow-xl transition-colors duration-300 dark:border-dark-border dark:bg-dark-card">
            <div className="flex items-center justify-between border-b border-zinc-100 p-6 dark:border-dark-border">
              <button onClick={handlePrev} className="p-2.5 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface transition-all">
                <FiChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100 italic">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <button onClick={handleNext} className="p-2.5 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface transition-all">
                <FiChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-zinc-50 bg-zinc-50/30 dark:border-dark-border/50 dark:bg-dark-surface/30">
              {weekDays.map((day) => (
                <div key={day} className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {day[0]}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-zinc-50 dark:divide-dark-border/50">
              {calendarDays.map((entry, index) => {
                const todayStr = format(new Date(), "yyyy-MM-dd");
                const isToday = entry.dateString === todayStr;
                const isSelected = entry.dateString === params.date;
                const summary = calendarSummaries.find(s => s.date === entry.dateString);

                if (!entry.inMonth) return <div key={index} className="aspect-square bg-zinc-50/10 dark:bg-dark-surface/5" />;

                return (
                  <button
                    key={entry.dateString}
                    onClick={() => handleParamChange({ date: entry.dateString })}
                    className={clsx(
                      "group relative aspect-square flex flex-col items-center justify-center transition-all",
                      isSelected ? "bg-emerald-600 text-white shadow-inner scale-95 rounded-2xl" : "hover:bg-emerald-50 dark:hover:bg-emerald-500/5",
                      isToday && !isSelected && "bg-emerald-50/50 dark:bg-emerald-900/10"
                    )}
                  >
                    <span className={clsx("text-xs font-black", !isSelected && (isToday ? "text-emerald-600" : "text-zinc-700 dark:text-zinc-300"))}>
                      {entry.day}
                    </span>
                    {summary && summary.count > 0 && (
                      <div className={clsx(
                        "mt-1 flex gap-0.5",
                        isSelected ? "opacity-100" : "opacity-60"
                      )}>
                        {Array.from({ length: Math.min(summary.count, 3) }).map((_, i) => (
                          <div key={i} className={clsx("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-emerald-500")} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* AI Insights Card */}
          <section className="rounded-[2.5rem] border border-emerald-100 bg-emerald-50/30 p-8 dark:border-emerald-600/20 dark:bg-emerald-600/5 shadow-sm">
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

        {/* ── Main Content: Appointment Table ── */}
        <section className="flex-1 min-w-0">
          <div className="overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white shadow-2xl dark:border-dark-border dark:bg-dark-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 p-8 dark:border-dark-border bg-zinc-50/30 dark:bg-dark-surface/30">
              <div>
                <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 italic">
                  <span className="text-emerald-600 mr-2">/</span>
                  {params.date ? formatDateLocal(params.date) : "Recent Appointments"}
                </h3>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">
                  {pagination.total} Records Found
                </p>
              </div>
              <button
                onClick={() => { reset(); setSelectedAppointment(null); setSelectedOwnerId(""); setActivePanel("booking"); setIsDrawerOpen(true); }}
                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-xl hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white active:scale-95 transition-all"
              >
                <FiPlusCircle className="h-5 w-5" />
                Book Now
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-50 dark:border-dark-border">
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5">Patient & Guardian</th>
                    <th className="px-8 py-5">Clinical Service</th>
                    <th className="px-8 py-5">Schedule</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-dark-border">
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-8 py-10"><div className="h-4 bg-zinc-100 dark:bg-dark-surface rounded-full w-full"></div></td>
                      </tr>
                    ))
                  ) : appointments.length > 0 ? appointments.map(appt => (
                    <tr 
                      key={appt.id} 
                      onClick={(e) => handleAppointmentClick(e, appt)}
                      className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 cursor-pointer transition-all duration-200"
                    >
                      <td className="px-8 py-6">
                        <span className={clsx(
                          "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border",
                          appt.status === 'approved' || appt.status === 'completed' ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50" :
                          appt.status === 'declined' || appt.status === 'cancelled' ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50" :
                          "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50"
                        )}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-dark-surface flex items-center justify-center text-lg shadow-inner group-hover:scale-110 transition-transform">🐾</div>
                          <div>
                            <p className="font-black text-zinc-900 dark:text-zinc-100 italic">{appt.pet?.name}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Guardian: {appt.pet?.owner?.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="font-black text-zinc-800 dark:text-zinc-200 uppercase text-xs tracking-tight">{appt.title}</p>
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">{appt.service?.name}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-black text-sm italic">
                          <FiClock className="text-emerald-500 shrink-0 h-4 w-4" />
                          {appt.time?.substring(0, 5)}
                        </div>
                        {!params.date && (
                          <p className="text-[10px] font-bold text-zinc-400 uppercase mt-1">{formatDateLocal(appt.date, "MMM d, yyyy")}</p>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all">
                           <button className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:bg-emerald-900/30 dark:text-emerald-400 transition-all shadow-lg shadow-emerald-500/10">
                             <FiChevronRight className="h-5 w-5" />
                           </button>
                         </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-32 text-center">
                        <div className="max-w-xs mx-auto">
                          <div className="w-20 h-20 rounded-[2rem] bg-zinc-50 dark:bg-dark-surface flex items-center justify-center mx-auto mb-6">
                            <FiCalendar className="w-10 h-10 text-zinc-200" />
                          </div>
                          <p className="text-zinc-900 dark:text-zinc-50 font-black italic text-lg uppercase tracking-tight">No records found</p>
                          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-2">Adjust your filters or pick another date from the navigator.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.last_page > 1 && (
              <div className="flex items-center justify-between p-8 border-t border-zinc-50 dark:border-dark-border bg-zinc-50/20 dark:bg-dark-surface/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Showing Page <span className="text-zinc-900 dark:text-zinc-100">{pagination.current_page}</span> of <span className="text-zinc-900 dark:text-zinc-100">{pagination.last_page}</span>
                </p>
                <div className="flex gap-3">
                  <button 
                    disabled={pagination.current_page === 1}
                    onClick={() => handleParamChange({ page: pagination.current_page - 1 })}
                    className="h-12 px-6 rounded-2xl border border-zinc-200 dark:border-dark-border text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-dark-surface disabled:opacity-30 transition-all"
                  >
                    Prev
                  </button>
                  <button 
                    disabled={pagination.current_page === pagination.last_page}
                    onClick={() => handleParamChange({ page: pagination.current_page + 1 })}
                    className="h-12 px-6 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-black uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-30 transition-all shadow-xl"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
                      <p className="text-lg font-black text-zinc-800 dark:text-zinc-100">{formatDateLocal(selectedAppointment?.date)}</p>
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

      {declineModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-dark-card shadow-2xl border border-zinc-200 dark:border-dark-border p-8">
            <h3 className="text-xl font-black uppercase tracking-tight text-rose-600 mb-2">Decline Appointment</h3>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">
              Provide a reason (visible to the client, min 10 characters)
            </p>
            <textarea
              value={declineModal.reason}
              onChange={(e) => setDeclineModal(prev => ({ ...prev, reason: e.target.value, error: "" }))}
              rows={5}
              autoFocus
              className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-3 text-sm focus:outline-none focus:border-rose-500"
              placeholder="e.g. Vet is unavailable at this time; please reschedule for a later slot."
            />
            <div className="flex items-center justify-between mt-2">
              <span className={clsx(
                "text-[10px] font-bold uppercase tracking-widest",
                declineModal.reason.trim().length < 10 ? "text-rose-500" : "text-emerald-500"
              )}>
                {declineModal.reason.trim().length}/10+ chars
              </span>
              {declineModal.error && (
                <span className="text-[10px] font-bold text-rose-500">{declineModal.error}</span>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeclineModal({ open: false, reason: "", error: "", submitting: false })}
                disabled={declineModal.submitting}
                className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-dark-border text-zinc-600 dark:text-zinc-300 font-bold text-xs uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-dark-surface"
              >
                Cancel
              </button>
              <button
                onClick={submitDecline}
                disabled={declineModal.submitting || declineModal.reason.trim().length < 10}
                className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50"
              >
                {declineModal.submitting ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppointmentsView;
