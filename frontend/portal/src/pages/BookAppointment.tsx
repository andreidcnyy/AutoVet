import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { 
  FiArrowLeft, 
  FiCalendar, 
  FiClock, 
  FiUser, 
  FiInfo, 
  FiX, 
  FiChevronLeft, 
  FiChevronRight,
  FiPlusCircle,
  FiCheckCircle,
  FiAlertCircle,
  FiHeart
} from 'react-icons/fi';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { generateCalendarGrid, generateWeekGrid, generateDayGrid } from '../utils/calendarUtils';
import { getPets, getServices, getVets, createAppointment } from '../api';
import api from '../api';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DOCTOR_REQUIRED_CATEGORIES = ['Consultation', 'Laboratory', 'Surgery', 'Imaging'];

// Fix for YYYY-MM-DD timezone shift: use slashes instead of dashes to force local time parsing
const formatPortalDateLocal = (dateStr: string, formatStr = "MMMM d, yyyy") => {
  if (!dateStr) return "";
  const normalizedDate = dateStr.includes('-') ? dateStr.replace(/-/g, '/') : dateStr;
  const d = new Date(normalizedDate);
  if (isNaN(d.getTime())) return "N/A";
  
  // Custom formatters since we want to match the provided strings
  if (formatStr === "MMM d, yyyy") {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const bookingSchema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required").regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid format (HH:mm)"),
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
  message: "Cannot book appointments in the past.",
  path: ["time"],
});

type BookingForm = z.infer<typeof bookingSchema>;

export default function BookAppointment() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [vets, setVets] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [availability, setAvailability] = useState<any[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema)
  });

  const selectedPetId = watch("pet_id");
  const selectedDate = watch("date");
  const selectedVetId = watch("vet_id");
  const selectedTime = watch("time");
  const selectedServiceId = watch("service_id");

  const selectedService = services.find(s => s.id.toString() === selectedServiceId);
  const requiresDoctor = DOCTOR_REQUIRED_CATEGORIES.includes(selectedService?.category);

  // Generate standard clinic slots: 08:00–17:00 every 30 min
  const generateSlots = (): string[] => {
    const slots: string[] = [];
    for (let h = 8; h < 17; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  };
  const standardSlots = generateSlots();

  useEffect(() => {
    if (selectedDate && !isViewMode) {
      const controller = new AbortController();
      setIsCheckingAvailability(true);
      api.get('/appointments/availability', { params: { date: selectedDate, vet_id: selectedVetId }, signal: controller.signal, timeout: 30000 })
        .then(res => setAvailability(res.data))
        .catch(err => { if (err.name !== 'CanceledError') console.error(err); })
        .finally(() => setIsCheckingAvailability(false));
      return () => controller.abort();
    }
  }, [selectedDate, selectedVetId, isViewMode]);

  const CACHE_KEY = 'portal_book_appointments_cache';
  const CACHE_TTL = 5 * 60 * 1000;
  const [formDataLoaded, setFormDataLoaded] = useState(false);

  // Load calendar appointments for the visible month range
  useEffect(() => {
    const controller = new AbortController();
    const dateFrom = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const dateTo = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    const cacheKey = `${CACHE_KEY}_${dateFrom}_${dateTo}`;

    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.data)) {
        setAppointments(cached.data);
        setLoading(false);
      }
    } catch (_) {}

    setLoading(true);
    api.get('/appointments', { params: { date_from: dateFrom, date_to: dateTo, per_page: 100 }, signal: controller.signal, timeout: 30000 })
      .then(res => {
        const appointmentsArray = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setAppointments(appointmentsArray);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data: appointmentsArray, ts: Date.now() }));
        } catch (_) {}
      })
      .catch(err => { if (err.name !== 'CanceledError') console.error(err); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [currentDate]);

  // Lazy-load form data only when booking drawer first opens
  const FORM_CACHE_KEY = 'portal_book_form_cache';
  useEffect(() => {
    if (!isDrawerOpen || formDataLoaded) return;

    try {
      const cached = JSON.parse(localStorage.getItem(FORM_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL && cached.data) {
        setPets(cached.data.pets || []);
        setServices(cached.data.services || []);
        setVets(cached.data.vets || []);
        setFormDataLoaded(true);
        if ((cached.data.pets || []).length === 1) {
          setValue("pet_id", cached.data.pets[0].id.toString());
        }
      }
    } catch (_) {}

    Promise.all([getPets(), getServices(), getVets()])
      .then(([petsRes, servRes, vetsRes]) => {
        // Correctly handle paginated or array responses
        const petsArray = Array.isArray(petsRes.data) ? petsRes.data : (petsRes.data?.data || []);
        const servicesArray = (Array.isArray(servRes.data) ? servRes.data : (servRes.data?.data || []))
          .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        const vetsArray = Array.isArray(vetsRes.data) ? vetsRes.data : (vetsRes.data?.data || []);

        setPets(petsArray);
        setServices(servicesArray);
        setVets(vetsArray);
        setFormDataLoaded(true);
        try {
          localStorage.setItem(FORM_CACHE_KEY, JSON.stringify({
            data: { pets: petsArray, services: servicesArray, vets: vetsArray },
            ts: Date.now()
          }));
        } catch (_) {}
        if (petsArray.length === 1) {
          setValue("pet_id", petsArray[0].id.toString());
        }
      })
      .catch(console.error);
  }, [isDrawerOpen, formDataLoaded, setValue]);

  const handleDayClick = (entry: any) => {
    if (!entry.inMonth) return;
    
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (entry.dateString < todayStr) return; // Prevent booking in the past

    setSelectedDay(entry);
    setSelectedAppointment(null);
    setIsViewMode(false);
    setValue("date", entry.dateString);
    setValue("time", "");
    
    // Auto-select if only one pet, otherwise reset
    if (pets.length === 1) {
      setValue("pet_id", pets[0].id.toString());
    } else {
      setValue("pet_id", "");
    }

    setValue("service_id", "");
    setValue("vet_id", "");
    setValue("notes", "");
    setIsDrawerOpen(true);
    setIsSuccess(false);
  };

  const handleEventClick = (e: React.MouseEvent, event: any) => {
    e.stopPropagation();
    setSelectedAppointment(event);
    setIsViewMode(true);
    setIsDrawerOpen(true);
    setIsSuccess(false);
  };

  const onBookingSubmit = async (data: BookingForm) => {
    try {
      await createAppointment(data);
      
      // Invalidate caches
      localStorage.removeItem('portal_appointments_cache');
      localStorage.removeItem('portal_book_appointments_cache');
      localStorage.removeItem('portal_overview_cache');

      // Refresh calendar for current month only (scoped re-fetch, not all)
      const dateFrom = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const dateTo = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      api.get('/appointments', { params: { date_from: dateFrom, date_to: dateTo, per_page: 100 }, timeout: 30000 })
        .then(res => {
          const appointmentsArray = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          setAppointments(appointmentsArray);
        }).catch(console.error);
      setIsSuccess(true);
      reset();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to book appointment.");
    }
  };

  const calendarDays = generateCalendarGrid(currentDate, appointments);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition font-semibold text-sm shrink-0">
          <FiArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <FiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <h2 className="text-sm sm:text-xl font-bold text-zinc-800 dark:text-zinc-100 w-28 sm:w-44 text-center uppercase tracking-tight">
            {format(currentDate, "MMM yyyy")}
          </h2>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 py-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/20" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Declined</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-zinc-400 shadow-sm shadow-zinc-400/20" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pending</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card-shell overflow-hidden bg-white dark:bg-dark-card relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/60 dark:bg-dark-card/60 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Syncing Calendar...</span>
            </div>
          </div>
        )}

        {/* Weekday headers */}
        <div className="grid grid-cols-7 sm:grid-cols-7 border-b border-zinc-100 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/30">
          {weekDays.map(day => (
            <div key={day} className="py-2 sm:py-4 text-center text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-400">
              <span className="sm:hidden">{day[0]}</span>
              <span className="hidden sm:inline">{day}</span>
            </div>
          ))}
        </div>

        {/* Day cells — iOS-compact on mobile, spacious on desktop */}
        <div className="grid grid-cols-7 sm:grid-cols-7 md:divide-x md:divide-y md:divide-zinc-100 dark:md:divide-dark-border/50">
          {calendarDays.map((entry, idx) => {
            const todayStr = format(new Date(), "yyyy-MM-dd");
            const isToday = entry.dateString === todayStr;
            const isPast = entry.dateString < todayStr;
            const hasEvents = entry.events.length > 0;
            const visibleDots = entry.events.filter((e: any) => {
              const s = (e.status || '').toLowerCase();
              return s !== 'completed';
            });

            return (
              <div
                key={`${entry.dateString}-${idx}`}
                onClick={() => handleDayClick(entry)}
                className={clsx(
                  "group relative transition-all cursor-pointer",
                  // Mobile: compact centered cells
                  "flex flex-col items-center py-2 px-0.5",
                  // Desktop: spacious left-aligned cells
                  "md:items-start md:justify-start md:min-h-[120px] md:p-2",
                  !entry.inMonth && "opacity-20 pointer-events-none",
                  isPast && "cursor-default",
                  !isPast && entry.inMonth && "md:hover:bg-brand-50/30 dark:md:hover:bg-brand-500/5"
                )}
              >
                {/* Date number */}
                <span className={clsx(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all",
                  "md:h-8 md:w-8 md:rounded-xl",
                  isToday
                    ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                    : isPast
                    ? "text-zinc-300 dark:text-zinc-600"
                    : "text-zinc-800 dark:text-zinc-200 md:hover:bg-brand-50 md:dark:hover:bg-brand-500/10"
                )}>
                  {entry.day}
                </span>

                {/* Status dots */}
                <div className="flex justify-center gap-0.5 mt-0.5 h-2 md:mt-2 md:gap-1 md:flex-wrap md:h-auto md:justify-start">
                  {visibleDots.slice(0, 3).map((event: any) => {
                    const status = (event.status || '').toLowerCase();
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => handleEventClick(e, event)}
                        title={`${event.pet?.name}: ${event.status}`}
                        className={clsx(
                          "w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full flex-shrink-0 transition-transform md:hover:scale-150",
                          status === 'pending' && "bg-zinc-400",
                          (status === 'approved' || status === 'scheduled' || status === 'confirmed') && "bg-emerald-500",
                          (status === 'cancelled' || status === 'declined') && "bg-rose-500"
                        )}
                      />
                    );
                  })}
                </div>

                {hasEvents && !isPast && (
                  <div className="mt-1 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[9px] font-black text-brand-500 uppercase tracking-tighter">
                      {entry.events.length} {entry.events.length === 1 ? 'Visit' : 'Visits'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking Modal — centered on all screens */}
      <div className={clsx(
        "fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-300",
        isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />

        <aside className={clsx(
          "relative w-full max-w-lg max-h-[88vh] overflow-y-auto bg-white dark:bg-dark-card rounded-3xl shadow-2xl transition-all duration-300",
          isDrawerOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        )}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          </div>

          <div className="px-5 pb-8 pt-2 md:p-8">
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center text-center space-y-6 py-10 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                  <FiCheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100">
                    Appointment Requested!
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                    Your visit has been queued for approval. We'll notify you once the clinic confirms.
                  </p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full py-4 rounded-2xl bg-zinc-100 dark:bg-dark-surface text-zinc-800 dark:text-zinc-100 font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all"
                >
                  Done
                </button>
              </div>

            ) : isViewMode && selectedAppointment ? (
              <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 italic tracking-tight uppercase">
                      <span className="text-brand-500 mr-1">/</span>Visit Details
                    </h3>
                    <div className={clsx(
                      "inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-1.5",
                      selectedAppointment.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      (selectedAppointment.status === 'declined' || selectedAppointment.status === 'cancelled') ? "bg-rose-100 text-rose-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {selectedAppointment.status}
                    </div>
                  </div>
                  <button onClick={() => setIsDrawerOpen(false)} className="p-2 rounded-xl bg-zinc-100 dark:bg-dark-surface text-zinc-400 hover:text-zinc-800 transition-all">
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="rounded-2xl bg-zinc-50 dark:bg-dark-surface/40 border border-zinc-100 dark:border-dark-border divide-y divide-zinc-100 dark:divide-dark-border overflow-hidden">
                  {[
                    { icon: FiHeart, label: 'Patient', value: selectedAppointment.pet?.name },
                    { icon: FiCalendar, label: 'Date', value: formatPortalDateLocal(selectedAppointment.date, "MMM d, yyyy") },
                    { icon: FiClock, label: 'Time', value: selectedAppointment.time?.substring(0, 5) },
                    { icon: FiPlusCircle, label: 'Service', value: selectedAppointment.service?.name },
                    ...(selectedAppointment.vet ? [{ icon: FiUser, label: 'Doctor', value: `Dr. ${selectedAppointment.vet.name}` }] : []),
                    ...(selectedAppointment.notes ? [{ icon: FiInfo, label: 'Notes', value: selectedAppointment.notes }] : []),
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-8 h-8 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{label}</p>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-center text-zinc-400">
                  To reschedule, cancel and re-book or contact the clinic directly.
                </p>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-black uppercase tracking-widest text-sm shadow-xl hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  Close
                </button>
              </div>

            ) : (
              <>
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 italic tracking-tight uppercase">
                      <span className="text-brand-500 mr-1">/</span>Book a Visit
                    </h3>
                    <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mt-0.5">
                      {selectedDay ? formatPortalDateLocal(selectedDay.dateString, "MMMM d, yyyy") : ""}
                    </p>
                  </div>
                  <button onClick={() => setIsDrawerOpen(false)} className="p-2 rounded-xl bg-zinc-100 dark:bg-dark-surface text-zinc-400 hover:text-zinc-800 transition-all">
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onBookingSubmit)} className="space-y-5">

                  {/* Pet Selection */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Select Pet</label>
                    <div className="grid grid-cols-2 gap-2">
                      {pets.map(pet => (
                        <button
                          key={pet.id}
                          type="button"
                          onClick={() => setValue("pet_id", pet.id.toString())}
                          className={clsx(
                            "relative flex items-center gap-2.5 p-3.5 rounded-2xl border-2 transition-all text-left",
                            selectedPetId === pet.id.toString()
                              ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-sm"
                              : "border-zinc-100 dark:border-dark-border bg-white dark:bg-dark-card"
                          )}
                        >
                          <div className={clsx(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                            selectedPetId === pet.id.toString() ? "bg-brand-500 text-white" : "bg-zinc-100 dark:bg-dark-surface text-zinc-400"
                          )}>
                            <FiHeart className="w-4 h-4" />
                          </div>
                          <span className={clsx(
                            "font-bold text-sm truncate",
                            selectedPetId === pet.id.toString() ? "text-brand-700 dark:text-brand-400" : "text-zinc-800 dark:text-zinc-100"
                          )}>
                            {pet.name}
                          </span>
                          {selectedPetId === pet.id.toString() && (
                            <FiCheckCircle className="absolute top-2 right-2 text-brand-500 w-3.5 h-3.5" />
                          )}
                        </button>
                      ))}
                    </div>
                    <select {...register("pet_id")} className="hidden">
                      <option value="">Select</option>
                      {pets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {errors.pet_id && <p className="mt-1.5 text-[10px] text-rose-500 font-bold uppercase">{errors.pet_id.message}</p>}
                  </div>

                  {/* Service */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Service</label>
                    <select {...register("service_id")} className="input-field bg-white dark:bg-dark-card font-semibold">
                      <option value="">— Select a Service —</option>
                      {services.map(s => {
                        const hasFixedPrice = s.price && s.price > 0;
                        const priceLabel = hasFixedPrice ? ` — ₱${Number(s.price).toLocaleString()}` : ' — Price varies';
                        return <option key={s.id} value={s.id}>{s.name}{priceLabel}</option>;
                      })}
                    </select>
                    {selectedService && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
                        <FiInfo className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        <p className="text-[10px] font-bold text-brand-700 dark:text-brand-400">
                          {selectedService.price > 0
                            ? <>Estimated cost: <span className="text-brand-600 dark:text-brand-300">₱{Number(selectedService.price).toLocaleString()}</span> — prices may vary.</>
                            : <>Price varies based on your pet's size/weight — prices may vary.</>
                          }
                        </p>
                      </div>
                    )}
                    {errors.service_id && <p className="mt-1.5 text-[10px] text-rose-500 font-bold uppercase">{errors.service_id.message}</p>}
                  </div>

                  {/* Time slots */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Arrival Time</label>
                    <input type="hidden" {...register("time")} />
                    {selectedDate ? (
                      isCheckingAvailability ? (
                        <div className="text-[10px] text-zinc-400 animate-pulse py-4 text-center">Checking availability…</div>
                      ) : (
                        <>
                          {/* 3-col grid on mobile, 4-col on desktop */}
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
                            {standardSlots.filter(slot => {
                              const isBooked = availability.some((a: any) =>
                                a.time?.substring(0, 5) === slot &&
                                a.status !== 'cancelled' && a.status !== 'declined'
                              );
                              const todayStr = format(new Date(), "yyyy-MM-dd");
                              const nowTime = format(new Date(), "HH:mm");
                              return !isBooked && !(selectedDate === todayStr && slot < nowTime);
                            }).map(slot => {
                              const isSelected = selectedTime === slot;
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setValue("time", slot, { shouldValidate: true })}
                                  className={clsx(
                                    "px-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all text-center w-full",
                                    isSelected
                                      ? "border-emerald-500 bg-emerald-500 text-white shadow-md"
                                      : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:bg-dark-surface dark:border-dark-border dark:text-zinc-400"
                                  )}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-[9px] font-bold uppercase tracking-widest">
                            <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2 h-2 rounded-full bg-zinc-400" />Available</span>
                            <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" />Selected</span>
                          </div>
                        </>
                      )
                    ) : (
                      <div className="text-[10px] text-zinc-400 py-4 text-center bg-zinc-50 dark:bg-dark-surface rounded-xl">
                        Pick a date on the calendar to see open slots.
                      </div>
                    )}
                    {errors.time && <p className="mt-1.5 text-[10px] text-rose-500 font-bold uppercase">{errors.time.message}</p>}
                  </div>

                  {/* Doctor — only for consultation/lab/surgery/imaging */}
                  {requiresDoctor && (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Preferred Doctor</label>
                      <select {...register("vet_id")} className="input-field font-semibold">
                        <option value="">Any Available Doctor</option>
                        {vets.map(v => <option key={v.id} value={v.id}>Dr. {v.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Notes (optional)</label>
                    <textarea
                      {...register("notes")}
                      className="input-field h-20 py-3 resize-none font-medium text-sm"
                      placeholder="Tell us what's going on with your pet..."
                    />
                  </div>

                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-brand-500 text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-brand-500/25 hover:bg-brand-600 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubmitting ? "Booking…" : "Confirm Booking"}
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
