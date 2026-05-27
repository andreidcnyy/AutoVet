import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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
  FiThumbsDown,
  FiList
} from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { generateCalendarGrid, generateWeekGrid, generateDayGrid } from "../../utils/calendarUtils";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../context/AuthContext";
import { useNewItems } from "../../context/NewItemsContext";
import ManualSendModal from "../notifications/ManualSendModal";

const APPT_STAMP_KEY = "lv_appointments";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

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
});

function AppointmentsView() {
  const toast = useToast();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preSelectedPetId = queryParams.get("petId") || queryParams.get("patientId");

  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]); 
  const [calendarSummaries, setCalendarSummaries] = useState([]); 
  const [aiForecast, setAiForecast] = useState(null);
  const { user } = useAuth();
  const { refreshCounts } = useNewItems();

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [activePanel, setActivePanel] = useState("booking");
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [declineModal, setDeclineModal] = useState({ open: false, reason: "", error: "", submitting: false });
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  // Capture the previous visit stamp before the page clears it, so we can highlight new appointments
  const [prevVisitStamp] = useState(() => localStorage.getItem(APPT_STAMP_KEY));
  const [newBannerDismissed, setNewBannerDismissed] = useState(false);

  // Walk-in specific state
  const [walkInOwnerMode, setWalkInOwnerMode] = useState("new"); // "new" | "existing"
  const [walkInOwner, setWalkInOwner] = useState({ name: "", phone: "", address: "", city: "", province: "" });
  const [walkInPet, setWalkInPet] = useState({ name: "", species_id: "", breed_id: "" });
  const [walkInIsEmergency, setWalkInIsEmergency] = useState(false);
  const [walkInErrors, setWalkInErrors] = useState({});
  const [walkInDupeWarning, setWalkInDupeWarning] = useState(null);
  const [species, setSpecies] = useState([]);
  const [breeds, setBreeds] = useState([]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { date: "", time: "", pet_id: preSelectedPetId || "", service_id: "", vet_id: "", notes: "" }
  });

  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [vets, setVets] = useState([]);

  const adminBookingRequiresDoctor = selectedServiceIds.some(id => {
    const svc = services.find(s => String(s.id) === id);
    return svc?.requires_doctor === true;
  });
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [availability, setAvailability] = useState([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const watchDate = watch("date");
  const watchVetId = watch("vet_id");

  useEffect(() => {
    if (watchDate && user?.token) {
      setIsCheckingAvailability(true);
      api.get('/api/appointments/availability', { params: { date: watchDate, vet_id: watchVetId } })
        .then(data => setAvailability(Array.isArray(data) ? data : []))
        .finally(() => setIsCheckingAvailability(false));
    }
  }, [watchDate, watchVetId, user?.token]);

  const fetchCalendarSummaries = useCallback((signal) => {
    if (!user?.token) return;
    const dateFrom = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const dateTo = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    api.get('/api/appointments/summary', { params: { date_from: dateFrom, date_to: dateTo }, signal })
      .then(data => setCalendarSummaries(Array.isArray(data) ? data : []));
  }, [user?.token, currentDate]);

  const fetchAppointments = useCallback((signal) => {
    if (!user?.token) return;
    setIsLoading(true);
    
    const fetchParams = { 
      page: params.page, 
      per_page: params.date ? 15 : 100, 
      search: debouncedSearch, 
      status: params.status, 
      date: params.date 
    };

    if (!params.date) {
        fetchParams.date_from = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        fetchParams.date_to = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    }

    api.get('/api/appointments', { params: fetchParams, signal }).then((data) => {
      if (data && data.data) {
        setAppointments(data.data);
        setPagination({ current_page: data.current_page, last_page: data.last_page, total: data.total });
      }
    }).finally(() => setIsLoading(false));
  }, [user?.token, params, debouncedSearch, currentDate]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchCalendarSummaries(ctrl.signal);
    fetchAppointments(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchCalendarSummaries, fetchAppointments]);

  // Re-fetch when tab regains focus (fallback when WebSocket is unavailable)
  useEffect(() => {
    if (!user?.token) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchAppointments();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.token, fetchAppointments]);

  const [formDataLoaded, setFormDataLoaded] = useState(false);
  useEffect(() => {
    if (!isDrawerOpen || formDataLoaded || !user?.token) return;
    Promise.allSettled([
      api.get('/api/owners', { cache: true }),
      api.get('/api/pets', { cache: true }),
      api.get('/api/services', { cache: true }),
      api.get('/api/vets', { cache: true }),
      api.get('/api/species', { cache: true }),
      api.get('/api/breeds', { cache: true }),
    ]).then(([o, p, s, v, sp, br]) => {
      // Handle potential pagination in all dropdown sources
      const oData = o.value?.data || o.value || [];
      const pData = p.value?.data || p.value || [];
      const sData = s.value?.data || s.value || [];
      const vData = v.value?.data || v.value || [];
      const spData = sp.value?.data || sp.value || [];
      const brData = br.value?.data || br.value || [];

      setOwners(Array.isArray(oData) ? oData : []);
      setPets(Array.isArray(pData) ? pData : []);
      setServices(Array.isArray(sData) ? sData : []);
      setVets(Array.isArray(vData) ? vData : []);
      setSpecies(Array.isArray(spData) ? spData : []);
      setBreeds(Array.isArray(brData) ? brData : []);

      setFormDataLoaded(true);
    });
  }, [isDrawerOpen, formDataLoaded, user?.token]);

  useEffect(() => {
    if (!user?.token) return;
    api.get('/api/dashboard/appointment-forecast', { cache: true }).then(data => setAiForecast(data));
    const channel = echo.private('admin.appointments')
      .listen('.appointment.created', (e) => {
        const apptDate = new Date(e.appointment.date.replace(/-/g, '/'));
        if (isSameMonth(apptDate, currentDate)) {
            setAppointments(prev => {
                const exists = prev.find(a => a.id === e.appointment.id);
                if (exists) return prev;
                return [e.appointment, ...prev];
            });
        }
        toast.info(`New Appointment: ${e.appointment.pet?.name || 'Unknown Pet'}`);
      })
      .listen('.appointment.status.updated', (e) => {
        setAppointments(prev => prev.map(a => a.id === e.appointment.id ? e.appointment : a));
        if (selectedAppointment?.id === e.appointment.id) setSelectedAppointment(e.appointment);
        toast.info(`Appointment Updated: ${e.appointment.pet?.name} is now ${e.appointment.status}`);
      })
      .listen('.appointment.deleted', (e) => {
        setAppointments(prev => prev.filter(a => a.id !== e.appointmentId));
        if (selectedAppointment?.id === e.appointmentId) {
            setIsDrawerOpen(false);
            setSelectedAppointment(null);
        }
        toast.info(`Appointment archived.`);
      });
    const poll = setInterval(() => fetchAppointments(), 5000);
    return () => {
      clearInterval(poll);
      echo.leave('admin.appointments');
    };
  }, [user?.token, currentDate]);

  const handleParamChange = (newParams) => setParams(prev => ({ ...prev, ...newParams, page: newParams.page || 1 }));

  const onSubmit = async (data) => {
    if (selectedServiceIds.length === 0) { toast.error("Please select at least one service."); return; }
    try {
      const payload = { ...data, service_id: selectedServiceIds[0], service_ids: selectedServiceIds, is_walk_in: isWalkIn };
      await api.post("/api/appointments", payload);
      toast.success(isWalkIn ? "Walk-in registered!" : "Scheduled!");
      setIsDrawerOpen(false);
      setSelectedServiceIds([]);
      setIsWalkIn(false);
      fetchAppointments();
      refreshCounts();
    } catch (err) { toast.error(err?.response?.data?.message || "Failed to schedule."); }
  };

  // Debounced duplicate check for walk-in owner phone
  useEffect(() => {
    if (walkInOwnerMode !== "new" || walkInOwner.phone.length < 11) { setWalkInDupeWarning(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/owners/check-duplicate', { params: { phone: walkInOwner.phone } });
        if (res?.exists) setWalkInDupeWarning(`An owner with phone ${walkInOwner.phone} already exists: ${res.name}. Use "Existing Owner" mode or confirm this is a different person.`);
        else setWalkInDupeWarning(null);
      } catch (_) { setWalkInDupeWarning(null); }
    }, 600);
    return () => clearTimeout(timer);
  }, [walkInOwner.phone, walkInOwnerMode]);

  const resetWalkInForm = () => {
    setWalkInOwnerMode("new");
    setWalkInOwner({ name: "", phone: "", address: "", city: "", province: "" });
    setWalkInPet({ name: "", species_id: "", breed_id: "" });
    setWalkInIsEmergency(false);
    setWalkInErrors({});
    setWalkInDupeWarning(null);
  };

  const [walkInSubmitting, setWalkInSubmitting] = useState(false);

  const onWalkInSubmit = async () => {
    const errors = {};
    if (selectedServiceIds.length === 0) errors.service = "Select at least one service.";
    if (walkInOwnerMode === "new") {
      if (!walkInOwner.name.trim()) errors.ownerName = "Owner name is required.";
      if (!walkInOwner.phone.trim()) errors.ownerPhone = "Phone is required.";
    } else {
      if (!selectedOwnerId) errors.ownerId = "Please select an existing owner.";
    }
    if (!walkInPet.name.trim()) errors.petName = "Pet name is required.";
    if (!walkInPet.species_id) errors.petSpecies = "Species is required.";
    const watchedDate = watch("date");
    const watchedTime = watch("time");
    if (!watchedDate) errors.date = "Date is required.";
    if (!watchedTime) errors.time = "Time is required.";
    if (Object.keys(errors).length > 0) { setWalkInErrors(errors); toast.error("Please fill in all required fields."); return; }
    setWalkInErrors({});
    setWalkInSubmitting(true);
    try {
      const payload = {
        is_walk_in: true,
        is_emergency: walkInIsEmergency,
        service_id: selectedServiceIds[0],
        service_ids: selectedServiceIds,
        date: watchedDate,
        time: watchedTime,
        notes: watch("notes") || "",
        ...(walkInOwnerMode === "new"
          ? { new_owner: { name: walkInOwner.name, phone: walkInOwner.phone, address: walkInOwner.address, city: walkInOwner.city, province: walkInOwner.province } }
          : { owner_id: selectedOwnerId }),
        new_pet: { name: walkInPet.name, species_id: walkInPet.species_id, breed_id: walkInPet.breed_id || null },
      };
      await api.post("/api/walk-in", payload);
      toast.success(walkInIsEmergency ? "Emergency walk-in registered!" : "Walk-in registered and added to queue!");
      setIsDrawerOpen(false);
      setSelectedServiceIds([]);
      setIsWalkIn(false);
      resetWalkInForm();
      fetchAppointments();
      refreshCounts();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to register walk-in.";
      const fieldErrors = err?.response?.data?.errors || {};
      if (fieldErrors.phone) setWalkInErrors(prev => ({ ...prev, ownerPhone: fieldErrors.phone[0] }));
      toast.error(msg);
    } finally { setWalkInSubmitting(false); }
  };

  const handleAppointmentClick = (e, appt) => { e.stopPropagation(); setSelectedAppointment(appt); setActivePanel("details"); setIsDrawerOpen(true); };
  
  const handleStatusAction = async (action) => {
    if (action === 'decline') { setDeclineModal({ open: true, reason: "", error: "", submitting: false }); return; }
    if (actionSubmitting) return;
    setActionSubmitting(true);
    try {
      if (action === 'no_show') {
        await api.patch(`/api/appointments/${selectedAppointment.id}`, { status: 'no_show' });
        const updated = { ...selectedAppointment, status: 'no_show' };
        setSelectedAppointment(updated);
        setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
        toast.success("Marked as no-show.");
      } else {
        await api.post(`/api/appointments/${selectedAppointment.id}/${action}`);
        localStorage.removeItem('dashboard_stats_cache');
        localStorage.removeItem('dashboard_notifications_cache');
        api.invalidateCache?.();
        const newStatus = action === 'approve' ? 'approved' : action === 'complete' ? 'completed' : action;
        const updated = { ...selectedAppointment, status: newStatus };
        setSelectedAppointment(updated);
        setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
        toast.success(`Appointment ${newStatus}.`);
      }
    } catch (err) { toast.error("Action failed."); }
    finally { setActionSubmitting(false); }
  };

  const submitDecline = async () => {
    if (declineModal.reason.length < 10) return;
    setDeclineModal(prev => ({ ...prev, submitting: true }));
    try {
      await api.post(`/api/appointments/${selectedAppointment.id}/decline`, { reason: declineModal.reason });
      
      // Invalidate dashboard caches
      localStorage.removeItem('dashboard_stats_cache');
      localStorage.removeItem('dashboard_notifications_cache');
      api.invalidateCache?.();

      const updated = { ...selectedAppointment, status: 'declined' };
      setSelectedAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
      toast.success("Declined.");
      setDeclineModal({ open: false, reason: "", error: "", submitting: false });
    } catch (err) { setDeclineModal(prev => ({ ...prev, submitting: false, error: "Failed to decline." })); }
  };

  const handlePrev = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNext = () => setCurrentDate(addMonths(currentDate, 1));

  const calendarDays = generateCalendarGrid(currentDate);
  const qInputBase = "h-11 w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:border-dark-border";

  const monthAppointments = useMemo(() => {
    return appointments.filter(a => isSameMonth(new Date(a.date.replace(/-/g, '/')), currentDate));
  }, [appointments, currentDate]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col xl:flex-row gap-8">
        <aside className="w-full xl:w-[400px] shrink-0 space-y-6">
          <section className="overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white shadow-xl dark:border-dark-border dark:bg-dark-card">
            <div className="flex items-center justify-between border-b border-zinc-100 p-6 dark:border-dark-border">
              <button onClick={handlePrev} className="p-2.5 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-dark-border transition-all"><FiChevronLeft /></button>
              <h2 className="text-lg font-black italic">{format(currentDate, "MMMM yyyy")}</h2>
              <button onClick={handleNext} className="p-2.5 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-dark-border transition-all"><FiChevronRight /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-zinc-50 bg-zinc-50/30 dark:bg-dark-surface/30">
              {weekDays.map(d => <div key={d} className="px-2 py-3 text-center text-[10px] font-black uppercase text-zinc-400">{d[0]}</div>)}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-zinc-50 dark:divide-dark-border/50">
              {calendarDays.map((entry, i) => {
                const isSelected = entry.dateString === params.date;
                const summary = calendarSummaries.find(s => s.date === entry.dateString);
                if (!entry.inMonth) return <div key={i} className="aspect-square bg-zinc-50/10 dark:bg-dark-surface/5" />;
                return (
                  <button key={entry.dateString} onClick={() => handleParamChange({ date: entry.dateString })} className={clsx("group aspect-square flex flex-col items-center justify-center transition-all", isSelected ? "bg-emerald-600 text-white rounded-2xl" : "hover:bg-emerald-50 dark:hover:bg-emerald-500/5")}>
                    <span className="text-xs font-black">{entry.day}</span>
                    {summary && summary.count > 0 && (
                      <div className={clsx(
                        "mt-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black border",
                        isSelected ? "bg-white text-emerald-600 border-white" : "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20"
                      )}>
                        {summary.count}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {format(currentDate, "MMMM yyyy") === "April 2026" && (
            <section className="rounded-[2.5rem] border border-emerald-100 bg-emerald-50/30 p-8 dark:border-emerald-600/20 dark:bg-emerald-600/5 shadow-sm">
              <div className="mb-4 inline-flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xl shadow-emerald-500/40"><LuSparkles className="h-5 w-5" /></div>
                <p className="text-xs font-black uppercase tracking-[0.2em] italic">April Performance Matrix</p>
              </div>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-emerald-300/80 font-bold italic">{aiForecast?.insight || "Analyzing April clinic data..."}</p>
            </section>
          )}
        </aside>

        <section className="flex-1 min-w-0 space-y-8">
          {/* New appointment requests banner */}
          {!newBannerDismissed && prevVisitStamp && (() => {
            const newAppts = appointments.filter(a => a.created_at && new Date(a.created_at) > new Date(prevVisitStamp) && a.status === 'pending');
            if (newAppts.length === 0) return null;
            return (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-600/30 dark:bg-amber-600/10 px-6 py-4 flex items-start gap-4">
                <FiBell className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-2">
                    {newAppts.length} New Appointment Request{newAppts.length > 1 ? 's' : ''}
                  </p>
                  <ul className="space-y-1">
                    {newAppts.map(a => (
                      <li key={a.id} className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>{a.pet?.name}</span>
                        <span className="text-amber-500 font-normal">•</span>
                        <span>{formatDateLocal(a.date, "MMM d")} at {formatTime(a.time)}</span>
                        <span className="text-amber-500 font-normal">•</span>
                        <span className="text-amber-500">Requested {format(new Date(a.created_at), "MMM d, h:mm a")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => setNewBannerDismissed(true)} className="text-amber-500 hover:text-amber-700 shrink-0"><FiX className="h-4 w-4" /></button>
              </div>
            );
          })()}
          <div className="overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white shadow-2xl dark:border-dark-border dark:bg-dark-card">
            <div className="flex flex-wrap items-center justify-between gap-6 border-b border-zinc-100 p-8 bg-zinc-50/30 dark:bg-dark-surface/30">
              <div className="flex-1 min-w-[300px]">
                <h3 className="text-3xl font-black italic flex items-center gap-3">
                  <span className="text-emerald-600">/</span> {params.date ? formatDateLocal(params.date) : `${format(currentDate, "MMMM")} Appointments`}
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="text" placeholder="Search patient/owner..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-9 rounded-xl border border-zinc-200 bg-white focus:border-emerald-500 dark:bg-dark-surface text-xs font-bold" />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                        <FiX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <input type="date" value={params.date} onChange={(e) => handleParamChange({ date: e.target.value })} className="h-10 px-3 rounded-xl border border-zinc-200 bg-white dark:bg-dark-surface text-xs font-bold" />
                  <button onClick={() => { setSearchTerm(""); handleParamChange({ date: "", status: "all" }); }} className="h-10 px-4 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-all flex items-center justify-center" title="Clear Filters"><FiRefreshCcw className={clsx(isLoading && "animate-spin")} /></button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-50">
                    <th className="px-8 py-5">Status</th><th className="px-8 py-5">Patient & Guardian</th><th className="px-8 py-5">Clinical Service</th><th className="px-8 py-5">Schedule</th><th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={clsx("divide-y divide-zinc-50 dark:divide-dark-border transition-opacity duration-200", isLoading && (params.date ? appointments : monthAppointments).length > 0 && "opacity-50 pointer-events-none")}>
                  {isLoading && (params.date ? appointments : monthAppointments).length === 0 ? Array(5).fill(0).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={5} className="px-8 py-10"><div className="h-4 bg-zinc-100 rounded-full w-full"></div></td></tr>) :
                   (params.date ? appointments : monthAppointments).map(appt => (
                    <tr key={appt.id} onClick={(e) => handleAppointmentClick(e, appt)} className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 cursor-pointer transition-all">

                      <td className="px-8 py-6">
                        <span className={clsx("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border",
                          ['approved','completed'].includes(appt.status?.toLowerCase()) ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                          appt.status?.toLowerCase() === 'no_show' ? "bg-zinc-100 text-zinc-600 border-zinc-300" :
                          ['declined','cancelled'].includes(appt.status?.toLowerCase()) ? "bg-rose-100 text-rose-700 border-rose-200" :
                          "bg-amber-100 text-amber-700 border-amber-200"
                        )}>{appt.status?.toLowerCase() === 'no_show' ? 'No Show' : appt.status}</span>
                        {appt.is_walk_in && <span className="ml-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-sky-100 text-sky-700 border border-sky-200">Walk-in</span>}
                      </td>
                      <td className="px-8 py-6"><p className="font-black italic">{appt.pet?.name}</p><p className="text-[10px] font-bold text-zinc-400 uppercase">Guardian: {appt.pet?.owner?.name}</p></td>
                      <td className="px-8 py-6">
                        <p className="font-black uppercase text-xs">{appt.title}</p>
                        {appt.services && appt.services.length > 1
                          ? <p className="text-[10px] font-bold text-emerald-600 uppercase">{appt.services.map(s => s.name).join(' + ')}</p>
                          : <p className="text-[10px] font-bold text-emerald-600 uppercase">{appt.service?.name}</p>
                        }
                      </td>
                      <td className="px-8 py-6"><div className="flex items-center gap-2 font-black italic"><FiClock className="text-emerald-500" />{formatTime(appt.time)}</div>{!params.date && <p className="text-[10px] font-bold text-zinc-400 uppercase">{formatDateLocal(appt.date, "MMM d, yyyy")}</p>}</td>
                      <td className="px-8 py-6 text-right opacity-0 group-hover:opacity-100 transition-all"><button className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"><FiChevronRight /></button></td>
                    </tr>
                  ))}
                  {((params.date ? appointments : monthAppointments).length === 0) && !isLoading && <tr><td colSpan={5} className="px-8 py-32 text-center text-zinc-400 font-black italic uppercase">No records found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {createPortal(
      <div className={clsx("fixed inset-0 z-[60] flex items-center justify-center p-4 transition-opacity duration-300", isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
        <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
        <aside className={clsx("relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden bg-white dark:bg-dark-card shadow-2xl rounded-3xl transition-all duration-300", isDrawerOpen ? "scale-100 opacity-100" : "scale-95 opacity-0")}>
          {activePanel === "booking" ? (
            <>
              <div className="shrink-0 flex items-center justify-between border-b border-zinc-100 dark:border-dark-border px-8 py-6">
                <h3 className="text-3xl font-black italic uppercase"><span className="text-emerald-600">/</span> {isWalkIn ? 'Walk-in' : 'Schedule'}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsWalkIn(v => !v); resetWalkInForm(); }}
                    className={clsx("px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all", isWalkIn ? "bg-sky-600 text-white border-sky-600" : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200")}
                  >Walk-in</button>
                  <button onClick={() => { setIsDrawerOpen(false); setIsWalkIn(false); setSelectedServiceIds([]); resetWalkInForm(); }} className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-all"><FiX /></button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-8">
                {isWalkIn ? (
                  /* ── Walk-in Registration Form ── */
                  <div className="space-y-6">
                    {/* Emergency toggle */}
                    <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-600/30 dark:bg-rose-600/10 px-4 py-3">
                      <input type="checkbox" id="emergency" checked={walkInIsEmergency} onChange={e => setWalkInIsEmergency(e.target.checked)} className="h-4 w-4 accent-rose-600" />
                      <label htmlFor="emergency" className="text-xs font-black uppercase text-rose-700 dark:text-rose-400 cursor-pointer">Mark as Emergency / Urgent Priority</label>
                    </div>

                    {/* Owner section */}
                    <div className="rounded-[2rem] border-2 border-zinc-100 bg-zinc-50/30 p-6 dark:border-dark-border space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black uppercase text-zinc-400">Owner Information</p>
                        <div className="flex gap-1">
                          {["new","existing"].map(m => (
                            <button key={m} type="button" onClick={() => setWalkInOwnerMode(m)} className={clsx("px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all", walkInOwnerMode === m ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-dark-surface border-zinc-200 dark:border-dark-border text-zinc-500 hover:border-emerald-400")}>{m === "new" ? "New Owner" : "Link Existing"}</button>
                          ))}
                        </div>
                      </div>
                      {walkInOwnerMode === "new" ? (
                        <>
                          {walkInDupeWarning && <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{walkInDupeWarning}</p>}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Full Name <span className="text-rose-500">*</span></label>
                              <input value={walkInOwner.name} onChange={e => setWalkInOwner(p => ({...p, name: e.target.value}))} className={clsx(qInputBase, walkInErrors.ownerName && "border-rose-400")} placeholder="e.g. Juan Dela Cruz" />
                              {walkInErrors.ownerName && <p className="text-xs text-rose-500 mt-1">{walkInErrors.ownerName}</p>}
                            </div>
                            <div>
                              <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Phone <span className="text-rose-500">*</span></label>
                              <input value={walkInOwner.phone} onChange={e => setWalkInOwner(p => ({...p, phone: e.target.value}))} className={clsx(qInputBase, walkInErrors.ownerPhone && "border-rose-400")} placeholder="09XXXXXXXXX" maxLength={11} />
                              {walkInErrors.ownerPhone && <p className="text-xs text-rose-500 mt-1">{walkInErrors.ownerPhone}</p>}
                            </div>
                            <div>
                              <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">City</label>
                              <input value={walkInOwner.city} onChange={e => setWalkInOwner(p => ({...p, city: e.target.value}))} className={qInputBase} placeholder="City" />
                            </div>
                            <div className="col-span-2">
                              <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Address</label>
                              <input value={walkInOwner.address} onChange={e => setWalkInOwner(p => ({...p, address: e.target.value}))} className={qInputBase} placeholder="Street / Barangay" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Select Existing Owner <span className="text-rose-500">*</span></label>
                          <select value={selectedOwnerId} onChange={e => setSelectedOwnerId(e.target.value)} className={clsx(qInputBase, walkInErrors.ownerId && "border-rose-400")}>
                            <option value="">— Select Owner —</option>
                            {owners.map(o => <option key={o.id} value={o.id}>{o.name} ({o.phone})</option>)}
                          </select>
                          {walkInErrors.ownerId && <p className="text-xs text-rose-500 mt-1">{walkInErrors.ownerId}</p>}
                        </div>
                      )}
                    </div>

                    {/* Pet section */}
                    <div className="rounded-[2rem] border-2 border-zinc-100 bg-zinc-50/30 p-6 dark:border-dark-border space-y-3">
                      <p className="text-[10px] font-black uppercase text-zinc-400 mb-2">Pet Information</p>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Pet Name <span className="text-rose-500">*</span></label>
                        <input value={walkInPet.name} onChange={e => setWalkInPet(p => ({...p, name: e.target.value}))} className={clsx(qInputBase, walkInErrors.petName && "border-rose-400")} placeholder="e.g. Buddy" />
                        {walkInErrors.petName && <p className="text-xs text-rose-500 mt-1">{walkInErrors.petName}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Species <span className="text-rose-500">*</span></label>
                          <select value={walkInPet.species_id} onChange={e => setWalkInPet(p => ({...p, species_id: e.target.value, breed_id: ""}))} className={clsx(qInputBase, walkInErrors.petSpecies && "border-rose-400")}>
                            <option value="">— Select —</option>
                            {species.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          {walkInErrors.petSpecies && <p className="text-xs text-rose-500 mt-1">{walkInErrors.petSpecies}</p>}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Breed</label>
                          <select value={walkInPet.breed_id} onChange={e => setWalkInPet(p => ({...p, breed_id: e.target.value}))} className={qInputBase}>
                            <option value="">— Select —</option>
                            {breeds.filter(b => !walkInPet.species_id || String(b.species_id) === String(walkInPet.species_id)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    <div className="rounded-[2rem] border-2 border-zinc-100 bg-zinc-50/30 p-6 dark:border-dark-border space-y-3">
                      <p className="text-[10px] font-black uppercase text-zinc-400 mb-2">Reason / Services <span className="text-rose-500">*</span></p>
                      {walkInErrors.service && <p className="text-xs text-rose-500">{walkInErrors.service}</p>}
                      <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {services.map(s => {
                          const checked = selectedServiceIds.includes(String(s.id));
                          return (
                            <label key={s.id} className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-bold", checked ? "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-600 dark:text-emerald-400" : "bg-white border-zinc-200 text-zinc-700 dark:bg-dark-surface dark:border-dark-border dark:text-zinc-300 hover:border-emerald-300")}>
                              <input type="checkbox" className="sr-only" checked={checked} onChange={() => setSelectedServiceIds(prev => checked ? prev.filter(id => id !== String(s.id)) : [...prev, String(s.id)])} />
                              <span className={clsx("w-4 h-4 rounded shrink-0 border flex items-center justify-center", checked ? "bg-emerald-500 border-emerald-500" : "border-zinc-300")}>{checked && <FiCheckCircle className="w-3 h-3 text-white" />}</span>
                              {s.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Date <span className="text-rose-500">*</span></label>
                        <input type="date" {...register("date")} className={clsx(qInputBase, walkInErrors.date && "border-rose-400")} />
                        {walkInErrors.date && <p className="text-xs text-rose-500 mt-1">{walkInErrors.date}</p>}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Time <span className="text-rose-500">*</span></label>
                        <input type="time" {...register("time")} className={clsx(qInputBase, walkInErrors.time && "border-rose-400")} />
                        {walkInErrors.time && <p className="text-xs text-rose-500 mt-1">{walkInErrors.time}</p>}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-black uppercase text-zinc-400">Notes / Chief Complaint</label>
                      <textarea {...register("notes")} className={clsx(qInputBase, "min-h-[80px] py-3")} placeholder="Describe reason for visit..." rows={3} />
                    </div>

                    <button type="button" onClick={onWalkInSubmit} disabled={walkInSubmitting} className={clsx("h-16 w-full rounded-2xl text-sm font-black uppercase text-white shadow-2xl transition-all", walkInIsEmergency ? "bg-rose-600 hover:bg-rose-700" : "bg-sky-600 hover:bg-sky-700")}>
                      {walkInSubmitting ? "Registering..." : walkInIsEmergency ? "Register Emergency Walk-in" : "Register Walk-in & Add to Queue"}
                    </button>
                  </div>
                ) : (
                  /* ── Regular Scheduling Form ── */
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-5 rounded-[2rem] border-2 border-zinc-100 bg-zinc-50/30 p-8 dark:border-dark-border">
                      <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Client / Owner</label>
                        <select value={selectedOwnerId} onChange={(e) => { setSelectedOwnerId(e.target.value); setValue("pet_id", ""); }} className={qInputBase}><option value="">Select Owner</option>{Array.isArray(owners) && owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                      </div>
                      <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Pet</label>
                        <select {...register("pet_id")} className={qInputBase}><option value="">Select Pet</option>{Array.isArray(pets) && pets.filter(p => String(p.owner_id) === String(selectedOwnerId)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                      </div>
                      <div>
                        <label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Services (select one or more)</label>
                        <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {Array.isArray(services) && services.map(s => {
                            const checked = selectedServiceIds.includes(String(s.id));
                            return (
                              <label key={s.id} className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-bold", checked ? "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-600 dark:text-emerald-400" : "bg-white border-zinc-200 text-zinc-700 dark:bg-dark-surface dark:border-dark-border dark:text-zinc-300 hover:border-emerald-300")}>
                                <input type="checkbox" className="sr-only" checked={checked} onChange={() => setSelectedServiceIds(prev => checked ? prev.filter(id => id !== String(s.id)) : [...prev, String(s.id)])} />
                                <span className={clsx("w-4 h-4 rounded shrink-0 border flex items-center justify-center", checked ? "bg-emerald-500 border-emerald-500" : "border-zinc-300")}>{checked && <FiCheckCircle className="w-3 h-3 text-white" />}</span>
                                {s.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Date</label><input type="date" {...register("date")} className={qInputBase} /></div>
                      <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Time</label><input type="time" {...register("time")} className={qInputBase} /></div>
                    </div>
                    {adminBookingRequiresDoctor && (
                      <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Preferred Doctor</label>
                        <select {...register("vet_id")} className={qInputBase}><option value="">Any Available Doctor</option>{Array.isArray(vets) && vets.map(v => <option key={v.id} value={v.id}>Dr. {v.name}</option>)}</select>
                      </div>
                    )}
                    <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Notes</label><textarea {...register("notes")} className={clsx(qInputBase, "min-h-[120px] py-4")} placeholder="Describe the reason for visit..." rows={3}></textarea></div>
                    <button type="submit" disabled={isSubmitting} className="h-16 w-full rounded-2xl text-sm font-black uppercase text-white shadow-2xl transition-all bg-emerald-600 hover:bg-emerald-700">{isSubmitting ? "Syncing..." : "Finalize"}</button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="shrink-0 flex items-center justify-between border-b border-zinc-100 dark:border-dark-border px-8 py-6 bg-white dark:bg-dark-card">
                <h3 className="text-3xl font-black italic uppercase"><span className="text-emerald-600">/</span> Details</h3>
                <button onClick={() => setIsDrawerOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 transition-all border border-zinc-200 dark:border-zinc-600"><FiX className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-10">
                <div className="flex items-start gap-6">
                  <div className="h-20 w-20 flex items-center justify-center rounded-[2rem] bg-emerald-50 text-emerald-600 shadow-xl"><FiInfo className="h-10 w-10" /></div>
                  <div><h4 className="text-3xl font-black italic leading-tight">{selectedAppointment?.title}</h4>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={clsx("inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-black uppercase shadow-lg",
                        ['approved','completed'].includes(selectedAppointment?.status?.toLowerCase()) ? "bg-emerald-100 text-emerald-700" :
                        selectedAppointment?.status?.toLowerCase() === "no_show" ? "bg-zinc-100 text-zinc-600" :
                        ['declined','cancelled'].includes(selectedAppointment?.status?.toLowerCase()) ? "bg-rose-100 text-rose-700" :
                        "bg-amber-100 text-amber-700"
                      )}>{selectedAppointment?.status?.toLowerCase() === 'no_show' ? 'No Show' : (selectedAppointment?.status || "pending")}</span>
                      {selectedAppointment?.is_walk_in && <span className="inline-flex items-center rounded-full px-4 py-2 text-xs font-black uppercase bg-sky-100 text-sky-700">Walk-in</span>}
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 rounded-[2.5rem] border-2 border-zinc-100 bg-zinc-50/20 p-8">
                  <div className="flex items-center gap-5"><FiCalendar className="h-6 w-6 text-emerald-500" /><div><p className="text-[10px] font-black text-zinc-400">DATE</p><p className="text-lg font-black">{formatDateLocal(selectedAppointment?.date)}</p></div></div>
                  <div className="flex items-center gap-5"><FiClock className="h-6 w-6 text-emerald-500" /><div><p className="text-[10px] font-black text-zinc-400">TIME</p><p className="text-lg font-black italic">{formatTime(selectedAppointment?.time)}</p></div></div>
                  <div className="flex items-center gap-5"><FiUser className="h-6 w-6 text-emerald-500" /><div><p className="text-[10px] font-black text-zinc-400">PATIENT</p><p className="text-lg font-black">{selectedAppointment?.pet?.name} | Guardian ID #{selectedAppointment?.pet?.owner_id}</p></div></div>
                  {selectedAppointment?.created_at && (
                    <div className="flex items-center gap-5"><FiClock className="h-6 w-6 text-amber-400" /><div><p className="text-[10px] font-black text-zinc-400">REQUESTED ON</p><p className="text-sm font-black text-amber-600 dark:text-amber-400">{format(new Date(selectedAppointment.created_at), "MMMM d, yyyy 'at' h:mm a")}</p></div></div>
                  )}
                  <div className="flex items-center gap-5"><FiList className="h-6 w-6 text-emerald-500" /><div><p className="text-[10px] font-black text-zinc-400">SERVICES</p>
                    {selectedAppointment?.services?.length > 0
                      ? <div className="flex flex-wrap gap-1.5 mt-1">{selectedAppointment.services.map(s => <span key={s.id} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">{s.name}</span>)}</div>
                      : <p className="text-lg font-black">{selectedAppointment?.service?.name || '—'}</p>
                    }
                  </div></div>
                </div>
                {selectedAppointment?.notes && (
                  <div>
                    <p className="mb-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notes</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-50 dark:bg-dark-surface rounded-xl px-4 py-3 border border-zinc-100 dark:border-dark-border">
                      {selectedAppointment.notes}
                    </p>
                  </div>
                )}
                <div className="pt-6 space-y-4">
                  {selectedAppointment?.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleStatusAction('approve')} disabled={actionSubmitting} className="h-16 rounded-2xl bg-emerald-600 text-white font-black uppercase disabled:opacity-60 disabled:cursor-not-allowed transition-opacity">
                        {actionSubmitting ? "..." : "Approve"}
                      </button>
                      <button onClick={() => handleStatusAction('decline')} disabled={actionSubmitting} className="h-16 rounded-2xl bg-rose-600 text-white font-black uppercase disabled:opacity-60 disabled:cursor-not-allowed transition-opacity">
                        Decline
                      </button>
                    </div>
                  )}
                  {selectedAppointment?.status === 'approved' && (
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleStatusAction('complete')} disabled={actionSubmitting} className="h-12 rounded-2xl bg-emerald-600 text-white font-black uppercase text-sm disabled:opacity-60 transition-all hover:bg-emerald-700">
                        {actionSubmitting ? "..." : "Mark as Completed"}
                      </button>
                      <button onClick={() => handleStatusAction('no_show')} disabled={actionSubmitting} className="h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-black uppercase text-sm disabled:opacity-60 transition-all hover:bg-zinc-300">
                        {actionSubmitting ? "..." : "No-Show"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>,
      document.body
      )}
      {createPortal(
      <div className={clsx("fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-200", declineModal.open ? "opacity-100" : "opacity-0 pointer-events-none")}>
        <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-dark-card p-8">
          <h3 className="text-xl font-black text-rose-600 mb-2">Decline Appointment</h3>
          <textarea value={declineModal.reason} onChange={(e) => setDeclineModal(prev => ({ ...prev, reason: e.target.value }))} rows={5} className="w-full rounded-xl border dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 p-3" placeholder="Reason (min 10 chars)..." />
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setDeclineModal({ open: false, reason: "", error: "", submitting: false })} className="px-6 py-2.5 font-bold dark:text-zinc-300">Cancel</button><button onClick={submitDecline} disabled={declineModal.submitting || declineModal.reason.length < 10} className="px-6 py-2.5 bg-rose-600 text-white font-black rounded-xl disabled:opacity-50">Confirm Decline</button></div>
        </div>
      </div>,
      document.body
      )}
      <ManualSendModal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} owner={Array.isArray(owners) ? owners.find(o => o.id === selectedAppointment?.pet?.owner_id) : null} relatedObject={selectedAppointment} relatedType="App\Models\Appointment" />
    </div>
  );
}

export default AppointmentsView;
