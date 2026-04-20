import { useState, useEffect, useCallback, useMemo } from "react";
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
import ManualSendModal from "../notifications/ManualSendModal";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { date: "", time: "", pet_id: preSelectedPetId || "", service_id: "", vet_id: "", notes: "" }
  });

  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [vets, setVets] = useState([]);
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

  const [formDataLoaded, setFormDataLoaded] = useState(false);
  useEffect(() => {
    if (!isDrawerOpen || formDataLoaded || !user?.token) return;
    Promise.allSettled([
      api.get('/api/owners', { cache: true }),
      api.get('/api/pets', { cache: true }),
      api.get('/api/services', { cache: true }),
      api.get('/api/vets', { cache: true }),
    ]).then(([o, p, s, v]) => {
      // Handle potential pagination in all dropdown sources
      const oData = o.value?.data || o.value || [];
      const pData = p.value?.data || p.value || [];
      const sData = s.value?.data || s.value || [];
      const vData = v.value?.data || v.value || [];

      setOwners(Array.isArray(oData) ? oData : []);
      setPets(Array.isArray(pData) ? pData : []);
      setServices(Array.isArray(sData) ? sData : []);
      setVets(Array.isArray(vData) ? vData : []);
      
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
    return () => echo.leave('admin.appointments');
  }, [user?.token, currentDate]);

  const handleParamChange = (newParams) => setParams(prev => ({ ...prev, ...newParams, page: newParams.page || 1 }));

  const onSubmit = async (data) => {
    try {
      await api.post("/api/appointments", data);
      toast.success("Scheduled!");
      setIsDrawerOpen(false); fetchAppointments();
    } catch (err) { toast.error("Failed to schedule."); }
  };

  const handleAppointmentClick = (e, appt) => { e.stopPropagation(); setSelectedAppointment(appt); setActivePanel("details"); setIsDrawerOpen(true); };
  
  const handleStatusAction = async (action) => {
    if (action === 'decline') { setDeclineModal({ open: true, reason: "", error: "", submitting: false }); return; }
    try {
      await api.post(`/api/appointments/${selectedAppointment.id}/${action}`);
      
      // Invalidate dashboard caches to ensure real-time accuracy across tabs
      localStorage.removeItem('dashboard_stats_cache');
      localStorage.removeItem('dashboard_notifications_cache');
      api.invalidateCache?.();

      toast.success(`Success: ${action}`);
    } catch (err) { toast.error("Action failed."); }
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
                    {summary && summary.count > 0 && <div className="mt-1 flex gap-0.5">{Array.from({ length: Math.min(summary.count, 3) }).map((_, j) => <div key={j} className={clsx("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-emerald-500")} />)}</div>}
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
          <div className="overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white shadow-2xl dark:border-dark-border dark:bg-dark-card">
            <div className="flex flex-wrap items-center justify-between gap-6 border-b border-zinc-100 p-8 bg-zinc-50/30 dark:bg-dark-surface/30">
              <div className="flex-1 min-w-[300px]">
                <h3 className="text-3xl font-black italic flex items-center gap-3">
                  <span className="text-emerald-600">/</span> {params.date ? formatDateLocal(params.date) : `${format(currentDate, "MMMM")} Appointments`}
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="text" placeholder="Search patient/owner..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200 bg-white focus:border-emerald-500 dark:bg-dark-surface text-xs font-bold" />
                  </div>
                  <input type="date" value={params.date} onChange={(e) => handleParamChange({ date: e.target.value })} className="h-10 px-3 rounded-xl border border-zinc-200 bg-white dark:bg-dark-surface text-xs font-bold" />
                  <button onClick={() => { setSearchTerm(""); handleParamChange({ date: "", status: "all" }); }} className="h-10 px-4 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-all flex items-center justify-center" title="Clear Filters"><FiRefreshCcw className={clsx(isLoading && "animate-spin")} /></button>
                </div>
              </div>
              <button onClick={() => { reset(); setSelectedAppointment(null); setSelectedOwnerId(""); setActivePanel("booking"); setIsDrawerOpen(true); }} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-6 py-3.5 text-sm font-black uppercase text-white shadow-xl hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 transition-all"><FiPlusCircle /> Book Now</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-50">
                    <th className="px-8 py-5">Status</th><th className="px-8 py-5">Patient & Guardian</th><th className="px-8 py-5">Clinical Service</th><th className="px-8 py-5">Schedule</th><th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-dark-border">
                  {isLoading ? Array(5).fill(0).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={5} className="px-8 py-10"><div className="h-4 bg-zinc-100 rounded-full w-full"></div></td></tr>) : 
                   (params.date ? appointments : monthAppointments).map(appt => (
                    <tr key={appt.id} onClick={(e) => handleAppointmentClick(e, appt)} className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 cursor-pointer transition-all">

                      <td className="px-8 py-6">
                        <span className={clsx("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border", appt.status === 'approved' || appt.status === 'completed' ? "bg-emerald-100 text-emerald-700 border-emerald-200" : (appt.status === 'declined' || appt.status === 'cancelled') ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-100 text-amber-700 border-amber-200")}>{appt.status}</span>
                      </td>
                      <td className="px-8 py-6"><p className="font-black italic">{appt.pet?.name}</p><p className="text-[10px] font-bold text-zinc-400 uppercase">Guardian: {appt.pet?.owner?.name}</p></td>
                      <td className="px-8 py-6"><p className="font-black uppercase text-xs">{appt.title}</p><p className="text-[10px] font-bold text-emerald-600 uppercase">{appt.service?.name}</p></td>
                      <td className="px-8 py-6"><div className="flex items-center gap-2 font-black italic"><FiClock className="text-emerald-500" />{appt.time?.substring(0, 5)}</div>{!params.date && <p className="text-[10px] font-bold text-zinc-400 uppercase">{formatDateLocal(appt.date, "MMM d, yyyy")}</p>}</td>
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

      <div className={clsx("fixed inset-0 z-[60] transition-opacity duration-500", isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
        <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
        <aside className={clsx("absolute inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-dark-card shadow-2xl transition-transform duration-500 overflow-y-auto", isDrawerOpen ? "translate-x-0" : "translate-x-full")}>
          {activePanel === "booking" ? (
            <section className="p-8">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-3xl font-black italic uppercase"><span className="text-emerald-600">/</span> Schedule</h3>
                <button onClick={() => setIsDrawerOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-all"><FiX /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-5 rounded-[2rem] border-2 border-zinc-100 bg-zinc-50/30 p-8 dark:border-dark-border">
                  <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Client / Owner</label>
                    <select value={selectedOwnerId} onChange={(e) => { setSelectedOwnerId(e.target.value); setValue("pet_id", ""); }} className={qInputBase}><option value="">Select Owner</option>{Array.isArray(owners) && owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                  </div>
                  <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Pet</label>
                    <select {...register("pet_id")} className={qInputBase}><option value="">Select Pet</option>{Array.isArray(pets) && pets.filter(p => String(p.owner_id) === String(selectedOwnerId)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  </div>
                  <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Service</label>
                    <select {...register("service_id")} className={qInputBase}><option value="">Select Service</option>{Array.isArray(services) && services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Date</label><input type="date" {...register("date")} className={qInputBase} /></div>
                  <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Time</label><input type="time" {...register("time")} className={qInputBase} /></div>
                </div>
                <div><label className="mb-3 block text-[10px] font-black uppercase text-zinc-400">Notes</label><textarea {...register("notes")} className={clsx(qInputBase, "min-h-[120px] py-4")} placeholder="Describe the reason for visit..." rows={3}></textarea></div>
                <button type="submit" disabled={isSubmitting} className="h-16 w-full rounded-2xl bg-emerald-600 text-sm font-black uppercase text-white shadow-2xl hover:bg-emerald-700 transition-all">{isSubmitting ? "Syncing..." : "Finalize"}</button>
              </form>
            </section>
          ) : (
            <section className="p-0">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 p-8 bg-white/80 dark:bg-dark-card/80 backdrop-blur-lg">
                <h3 className="text-3xl font-black italic uppercase"><span className="text-emerald-600">/</span> Details</h3>
                <button onClick={() => setIsDrawerOpen(false)} className="rounded-2xl bg-zinc-100 p-3 text-zinc-500 transition-all"><FiX /></button>
              </div>
              <div className="p-8 space-y-10">
                <div className="flex items-start gap-6">
                  <div className="h-20 w-20 flex items-center justify-center rounded-[2rem] bg-emerald-50 text-emerald-600 shadow-xl"><FiInfo className="h-10 w-10" /></div>
                  <div><h4 className="text-3xl font-black italic leading-tight">{selectedAppointment?.title}</h4>
                    <div className={clsx("mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-black uppercase shadow-lg", selectedAppointment?.status === "approved" || selectedAppointment?.status === "completed" ? "bg-emerald-100 text-emerald-700" : (selectedAppointment?.status === "declined" || selectedAppointment?.status === "cancelled") ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>{selectedAppointment?.status || "pending"}</div>
                  </div>
                </div>
                <div className="grid gap-6 rounded-[2.5rem] border-2 border-zinc-100 bg-zinc-50/20 p-8">
                  <div className="flex items-center gap-5"><FiCalendar className="h-6 w-6 text-emerald-500" /><div><p className="text-[10px] font-black text-zinc-400">DATE</p><p className="text-lg font-black">{formatDateLocal(selectedAppointment?.date)}</p></div></div>
                  <div className="flex items-center gap-5"><FiClock className="h-6 w-6 text-emerald-500" /><div><p className="text-[10px] font-black text-zinc-400">TIME</p><p className="text-lg font-black italic">{selectedAppointment?.time?.substring(0, 5)}</p></div></div>
                  <div className="flex items-center gap-5"><FiUser className="h-6 w-6 text-emerald-500" /><div><p className="text-[10px] font-black text-zinc-400">PATIENT</p><p className="text-lg font-black">{selectedAppointment?.pet?.name} | Guardian ID #{selectedAppointment?.pet?.owner_id}</p></div></div>
                </div>
                {selectedAppointment?.notes && <div><label className="mb-4 block text-[10px] font-black text-zinc-400">NOTES</label><div className="rounded-3xl bg-zinc-50 p-6 italic border-l-8 border-emerald-500/20">"{selectedAppointment.notes}"</div></div>}
                <div className="pt-6 space-y-4">
                  {selectedAppointment?.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleStatusAction('approve')} className="h-16 rounded-2xl bg-emerald-600 text-white font-black uppercase">Approve</button>
                      <button onClick={() => handleStatusAction('decline')} className="h-16 rounded-2xl bg-rose-600 text-white font-black uppercase">Decline</button>
                    </div>
                  )}
                  {selectedAppointment?.status === 'approved' && (
                    <button onClick={() => handleStatusAction('completed')} className="h-16 w-full rounded-2xl bg-emerald-600 text-white font-black uppercase">Complete</button>
                  )}
                  {/* Archive button is only shown for pending appointments */}
                  {selectedAppointment?.status === 'pending' && (
                    <button onClick={() => { if(window.confirm("Archive this appointment?")) api.delete(`/api/appointments/${selectedAppointment.id}`).then(() => { toast.success("Archived"); setIsDrawerOpen(false); fetchAppointments(); }); }} className="h-16 w-full rounded-2xl border-2 border-rose-100 text-rose-600 font-black uppercase">Archive</button>
                  )}
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
      {declineModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8">
            <h3 className="text-xl font-black text-rose-600 mb-2">Decline Appointment</h3>
            <textarea value={declineModal.reason} onChange={(e) => setDeclineModal(prev => ({ ...prev, reason: e.target.value }))} rows={5} className="w-full rounded-xl border p-3" placeholder="Reason (min 10 chars)..." />
            <div className="flex justify-end gap-3 mt-6"><button onClick={() => setDeclineModal({ open: false, reason: "", error: "", submitting: false })} className="px-6 py-2.5 font-bold">Cancel</button><button onClick={submitDecline} disabled={declineModal.submitting || declineModal.reason.length < 10} className="px-6 py-2.5 bg-rose-600 text-white font-black rounded-xl">Confirm Decline</button></div>
          </div>
        </div>
      )}
      <ManualSendModal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} owner={Array.isArray(owners) ? owners.find(o => o.id === selectedAppointment?.pet?.owner_id) : null} relatedObject={selectedAppointment} relatedType="App\Models\Appointment" />
    </div>
  );
}

export default AppointmentsView;
