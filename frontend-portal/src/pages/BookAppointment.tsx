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
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { generateCalendarGrid, generateWeekGrid, generateDayGrid } from '../utils/calendarUtils';
import { getPets, getServices, getVets, createAppointment, getAppointments, getAvailability } from '../api';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  useEffect(() => {
    if (selectedDate && !isViewMode) {
      setIsCheckingAvailability(true);
      getAvailability(selectedDate, selectedVetId)
        .then(res => setAvailability(res.data))
        .catch(console.error)
        .finally(() => setIsCheckingAvailability(false));
    }
  }, [selectedDate, selectedVetId, isViewMode]);

  useEffect(() => {
    Promise.all([getPets(), getServices(), getVets(), getAppointments()])
      .then(([petsRes, servRes, vetsRes, apptsRes]) => {
        setPets(petsRes.data);
        setServices(servRes.data);
        setVets(vetsRes.data);
        setAppointments(apptsRes.data);
      })
      .catch(console.error);
  }, []);

  const handleDayClick = (entry: any) => {
    if (!entry.inMonth) return;
    
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (entry.dateString < todayStr) return; // Prevent booking in the past

    setSelectedDay(entry);
    setSelectedAppointment(null);
    setIsViewMode(false);
    setValue("date", entry.dateString);
    setValue("time", "");
    setValue("pet_id", "");
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
      // Refresh appointments to show on calendar
      getAppointments().then(res => setAppointments(res.data));
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
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition">
          <FiArrowLeft /> Dashboard
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 min-w-[160px] text-center uppercase tracking-tight">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card-shell overflow-hidden bg-white dark:bg-dark-card">
        <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/30">
          {weekDays.map(day => (
            <div key={day} className="py-4 text-center text-xs font-bold uppercase tracking-widest text-zinc-400">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-100 dark:divide-dark-border/50">
          {calendarDays.map((entry, idx) => {
            const todayStr = format(new Date(), "yyyy-MM-dd");
            const isToday = entry.dateString === todayStr;
            const isPast = entry.dateString < todayStr;
            const hasEvents = entry.events.length > 0;

            return (
              <div
                key={`${entry.dateString}-${idx}`}
                onClick={() => handleDayClick(entry)}
                className={clsx(
                  "group relative min-h-[120px] p-2 transition-all cursor-pointer",
                  !entry.inMonth && "bg-zinc-50/20 dark:bg-dark-surface/10 opacity-30 pointer-events-none",
                  isToday && "bg-brand-50/50 dark:bg-brand-900/10",
                  isPast && "bg-zinc-100/50 dark:bg-zinc-800/40 grayscale-sm cursor-default",
                  !isPast && entry.inMonth && "hover:bg-brand-50/30 dark:hover:bg-brand-500/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={clsx(
                    "inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold transition-all",
                    isToday ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30" : 
                    (isPast ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300")
                  )}>
                    {entry.day}
                  </span>
                  {hasEvents && (
                    <div className="flex gap-1">
                      {entry.events.map((e: any) => (
                        <div key={e.id} className={clsx(
                          "w-1.5 h-1.5 rounded-full",
                          e.status === 'pending' ? 'bg-amber-400' : 'bg-brand-500'
                        )} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  {entry.events.map((event: any) => (
                    <div 
                      key={event.id} 
                      onClick={(e) => handleEventClick(e, event)}
                      className="px-2 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-dark-border text-[10px] font-bold text-zinc-600 dark:text-zinc-400 truncate uppercase hover:border-brand-500 hover:text-brand-500 transition-colors"
                    >
                      {event.pet?.name} - {event.status}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking Drawer */}
      <div className={clsx(
        "fixed inset-0 z-[60] transition-opacity duration-500",
        isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
        
        <aside className={clsx(
          "absolute inset-y-0 right-0 w-full max-w-md bg-white dark:bg-dark-card shadow-2xl transition-transform duration-500 p-8 overflow-y-auto",
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}>
          {isSuccess ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                <FiCheckCircle className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100">
                  Appointment Requested!
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  Your visit has been queued for approval. We'll notify you once the clinic confirms your slot.
                </p>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="w-full py-4 rounded-2xl bg-zinc-100 dark:bg-dark-surface text-zinc-800 dark:text-zinc-100 font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all"
              >
                Close
              </button>
            </div>
          ) : isViewMode && selectedAppointment ? (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 italic tracking-tight uppercase">
                    <span className="text-brand-500 mr-2">/</span>Visit Details
                  </h3>
                  <div className={clsx(
                    "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2",
                    selectedAppointment.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {selectedAppointment.status}
                  </div>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 rounded-xl bg-zinc-50 dark:bg-dark-surface text-zinc-400 hover:text-zinc-800 transition-all">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 rounded-[2rem] bg-zinc-50/50 dark:bg-dark-surface/30 border-2 border-zinc-50 dark:border-dark-border space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                      <FiHeart className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Patient</p>
                      <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{selectedAppointment.pet?.name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                        <FiCalendar className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date</p>
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{format(new Date(selectedAppointment.date), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                        <FiClock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Time</p>
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{selectedAppointment.time?.substring(0, 5)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                      <FiPlusCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Service</p>
                      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{selectedAppointment.service?.name}</p>
                    </div>
                  </div>

                  {selectedAppointment.vet && (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                        <FiUser className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Doctor</p>
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Dr. {selectedAppointment.vet.name}</p>
                      </div>
                    </div>
                  )}

                  {selectedAppointment.notes && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 shrink-0">
                        <FiInfo className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notes</p>
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-1">{selectedAppointment.notes}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <p className="text-xs text-center text-zinc-400 font-medium">
                    To modify or reschedule this visit, please contact the clinic directly or cancel and re-book.
                  </p>
                </div>

                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-black uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all"
                >
                  Close Details
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 italic tracking-tight uppercase">
                    <span className="text-brand-500 mr-2">/</span>Book Visit
                  </h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">
                    {selectedDay ? format(new Date(selectedDay.dateString), "MMMM d, yyyy") : ""}
                  </p>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 rounded-xl bg-zinc-50 dark:bg-dark-surface text-zinc-400 hover:text-zinc-800 transition-all">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onBookingSubmit)} className="space-y-6">
                <div className="space-y-5 rounded-[2rem] bg-zinc-50/50 dark:bg-dark-surface/30 p-6 border-2 border-zinc-50 dark:border-dark-border">
                  {/* Pet Selection */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3 ml-1">Select Pet</label>
                    <div className="grid grid-cols-2 gap-2">
                      {pets.map(pet => (
                        <button
                          key={pet.id}
                          type="button"
                          onClick={() => setValue("pet_id", pet.id.toString())}
                          className={clsx(
                            "relative p-4 rounded-2xl border-2 transition-all text-left overflow-hidden",
                            selectedPetId === pet.id.toString()
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-md ring-2 ring-brand-500/20"
                            : "border-zinc-100 dark:border-dark-border bg-white dark:bg-dark-card hover:border-zinc-200"
                          )}
                        >
                          <div className={clsx(
                            "font-bold text-sm",
                            selectedPetId === pet.id.toString() ? "text-brand-700 dark:text-brand-400" : "text-zinc-800 dark:text-zinc-100"
                          )}>
                            {pet.name}
                          </div>
                          {selectedPetId === pet.id.toString() && (
                            <FiCheckCircle className="absolute top-2 right-2 text-brand-500 w-4 h-4" />
                          )}
                        </button>
                      ))}
                    </div>
                    <select {...register("pet_id")} className="hidden">
                      <option value="">Select</option>
                      {pets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {errors.pet_id && <p className="mt-2 text-[10px] text-rose-500 font-bold uppercase">{errors.pet_id.message}</p>}
                  </div>

                  {/* Service Selection */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 ml-1">Service Required</label>
                    <select {...register("service_id")} className="input-field bg-white dark:bg-dark-card font-bold">
                      <option value="">— Select Service —</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {errors.service_id && <p className="mt-2 text-[10px] text-rose-500 font-bold uppercase">{errors.service_id.message}</p>}
                  </div>

                  {/* Time Selection */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 ml-1">Arrival Time</label>
                    <input type="time" {...register("time")} className="input-field bg-white dark:bg-dark-card font-bold" />
                    {errors.time && <p className="mt-2 text-[10px] text-rose-500 font-bold uppercase">{errors.time.message}</p>}
                  </div>

                  {/* Availability List */}
                  {selectedDate && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 ml-1">Already Booked Slots</p>
                      <div className="flex flex-wrap gap-2">
                        {isCheckingAvailability ? (
                          <span className="text-[10px] text-zinc-400 animate-pulse">Checking...</span>
                        ) : availability.length > 0 ? (
                          availability.map((a: any) => (
                            <span key={a.id} className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-dark-surface text-zinc-500 text-[10px] font-bold border border-zinc-200 dark:border-dark-border">
                              {a.time.substring(0, 5)}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-emerald-500 font-bold uppercase">All slots available</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 ml-1">Assigned Doctor (Optional)</label>
                  <select {...register("vet_id")} className="input-field font-bold">
                    <option value="">Any Available Vet</option>
                    {vets.map(v => <option key={v.id} value={v.id}>Dr. {v.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 ml-1">Additional Notes</label>
                  <textarea {...register("notes")} className="input-field h-24 py-3 resize-none font-medium" placeholder="Tell us what's happening..." />
                </div>

                <button 
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full h-16 rounded-2xl bg-brand-500 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-500/20 hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "Syncing..." : "Confirm Booking"}
                </button>
              </form>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
