import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAppointments, getAppointment, cancelAppointment, getInvoices } from '../api';
import echo from '../utils/echo';
import {
  FiCalendar,
  FiClock,
  FiXCircle,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowLeft,
  FiHeart,
  FiUser,
  FiFileText
} from 'react-icons/fi';
import { useNavigate, Link } from 'react-router-dom';
import PetProfileModal from '../components/PetProfileModal';
import { useAuth } from '../context/AuthContext';
import { PawPrint } from './Landing';
import clsx from 'clsx';

const statusLabel = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// Fix for YYYY-MM-DD timezone shift: use slashes instead of dashes to force local time parsing
const formatTime = (t: string | undefined) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

const formatPortalDateLocal = (dateStr: string, long = false) => {
  if (!dateStr) return "N/A";
  const normalizedDate = dateStr.includes('-') ? dateStr.replace(/-/g, '/') : dateStr;
  const d = new Date(normalizedDate);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString('en-US', long ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
};

export default function Appointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);

  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const selectedAppointmentRef = useRef<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [apptInvoice, setApptInvoice] = useState<any>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const CACHE_KEY = `portal_appointments_${user?.id}_cache`;
  const CACHE_TTL = 5 * 60 * 1000;

  const sortAppointments = (data: any[]) => {
    // Visit History: latest visit first, oldest last (pure descending by date+time).
    return [...data].sort((a, b) => {
      const normalizedA = a.date.includes('-') ? a.date.replace(/-/g, '/') : a.date;
      const normalizedB = b.date.includes('-') ? b.date.replace(/-/g, '/') : b.date;
      const dateA = new Date(`${normalizedA} ${a.time || '00:00'}`).getTime();
      const dateB = new Date(`${normalizedB} ${b.time || '00:00'}`).getTime();
      return dateB - dateA;
    });
  };

  const fetchAppointments = () => {
    // Show cached data immediately
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.data)) {
        setAppointments(cached.data);
        setLoading(false);
      }
    } catch (_) {}

    getAppointments()
      .then(res => {
        // Correctly extract the data array from the paginated backend response
        const appointmentsArray = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        const sorted = sortAppointments(appointmentsArray);
        setAppointments(sorted);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: sorted, ts: Date.now() })); } catch (_) {}
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppointments();

    const handleAppointmentUpdate = (e: any) => {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(`portal_book_appointments_${user?.id}_cache`);
      localStorage.removeItem(`portal_overview_${user?.id}_cache`);
      fetchAppointments();
      if (selectedAppointmentRef.current?.id === e.appointment.id) {
        setSelectedAppointment(e.appointment);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        localStorage.removeItem(CACHE_KEY);
        fetchAppointments();
      }
    };

    const pollInterval = setInterval(fetchAppointments, 10000);
    document.addEventListener('visibilitychange', onVisible);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id) {
      echo.private(`client.appointments.${user.id}`)
        .listen('.appointment.status.updated', handleAppointmentUpdate)
        .listen('.appointment.created', handleAppointmentUpdate);
    }

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisible);
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u.id) echo.leave(`client.appointments.${u.id}`);
    };
  }, []);

  useEffect(() => {
    selectedAppointmentRef.current = selectedAppointment;
  }, [selectedAppointment]);

  const handleCancel = async (id: number) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await cancelAppointment(id);
      
      // Invalidate caches
      localStorage.removeItem(`portal_appointments_${user?.id}_cache`);
      localStorage.removeItem(`portal_book_appointments_${user?.id}_cache`);
      localStorage.removeItem(`portal_overview_${user?.id}_cache`);

      fetchAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to cancel appointment.");
    }
  };

  const handlePetClick = (id: number) => {
    setSelectedPetId(id);
    setIsModalOpen(true);
  };

  const handleDetailsClick = (appt: any) => {
    selectedAppointmentRef.current = appt;
    setSelectedAppointment(appt);
    setApptInvoice(null);
    setIsDetailsOpen(true);
    getAppointment(appt.id)
      .then(res => {
        const full = res.data;
        selectedAppointmentRef.current = full;
        setSelectedAppointment(full);
      })
      .catch(() => {});
    if (appt.status === 'completed') {
      setInvoiceLoading(true);
      getInvoices({ appointment_id: appt.id, per_page: 1 })
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          setApptInvoice(list[0] || null);
        })
        .catch(() => setApptInvoice(null))
        .finally(() => setInvoiceLoading(false));
    }
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading appointments...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition font-semibold text-sm">
        <FiArrowLeft /> Dashboard
      </button>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-emerald-600 to-emerald-700 dark:from-emerald-500 dark:via-emerald-400 dark:to-teal-400 p-5 sm:p-8 text-white shadow-xl">
        <PawPrint className="absolute -top-4 -right-4 w-36 h-36 text-white opacity-30 rotate-12 pointer-events-none" />
        <PawPrint className="absolute bottom-2 right-16 w-16 h-16 text-white opacity-20 -rotate-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-white/70 text-xs font-black uppercase tracking-[0.2em] mb-1">Your visits</p>
            <h1 className="text-2xl font-black italic uppercase tracking-tight">Visit History 🐾</h1>
            <p className="text-white/80 mt-1 text-sm font-medium">Track all your appointments, past and upcoming.</p>
          </div>
          <Link to="/book" className="shrink-0">
            <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-brand-600 font-black text-sm shadow-lg hover:bg-emerald-50 transition-all active:scale-[0.98]">
              <FiCalendar /> Book New Visit
            </button>
          </Link>
        </div>
      </div>

      <div className="space-y-4">

        {appointments.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {appointments.map(appt => (
              <div key={appt.id} className="card-shell card-shell-hover p-4 sm:p-6 bg-white dark:bg-dark-card group relative overflow-hidden">
                <div className={clsx(
                  "absolute left-0 top-0 bottom-0 w-1.5",
                  appt.status === 'pending' && 'bg-zinc-400',
                  appt.status === 'approved' && 'bg-emerald-500',
                  (appt.status === 'cancelled' || appt.status === 'declined') && 'bg-rose-500',
                  appt.status === 'completed' && 'bg-blue-500'
                )} />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-dark-surface flex items-center justify-center border border-zinc-100 dark:border-dark-border">
                      <FiCalendar className="w-6 h-6 text-brand-500" />
                    </div>
                    <div className="cursor-pointer" onClick={() => handleDetailsClick(appt)}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest">{appt.service?.name}</span>
                        <span className={clsx(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                          appt.status === 'pending' && 'bg-zinc-100 text-zinc-600',
                          appt.status === 'approved' && 'bg-emerald-50 text-emerald-700',
                          (appt.status === 'cancelled' || appt.status === 'declined') && 'bg-rose-50 text-rose-700',
                          appt.status === 'completed' && 'bg-blue-50 text-blue-700'
                        )}>
                          {statusLabel(appt.status)}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mt-0.5 hover:text-brand-500 transition-colors">Patient: {appt.pet?.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500 font-medium">
                        <span className="flex items-center gap-1.5"><FiCalendar className="w-4 h-4" /> {formatPortalDateLocal(appt.date, true)}</span>
                        <span className="flex items-center gap-1.5"><FiClock className="w-4 h-4" /> {formatTime(appt.time) || '12:00 AM'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <button 
                      onClick={() => handleDetailsClick(appt)}
                      className="px-4 py-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/10 dark:text-brand-400 text-xs font-bold hover:bg-brand-100 transition-all"
                    >
                      View Visit Info
                    </button>
                    {appt.status === 'pending' && (
                      <button 
                        onClick={() => handleCancel(appt.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-100 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-all"
                      >
                        <FiXCircle /> Cancel
                      </button>
                    )}
                    <button 
                      onClick={() => handlePetClick(appt.pet_id)}
                      className="px-4 py-2 rounded-xl bg-zinc-50 dark:bg-dark-surface text-zinc-600 dark:text-zinc-400 text-xs font-bold hover:bg-zinc-100 transition-all"
                    >
                      View Pet Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-shell p-12 text-center text-zinc-400 bg-zinc-50/50 border-dashed">
            You don't have any appointments yet.
          </div>
        )}
      </div>

      {/* Appointment Details Modal — portal into body to escape overflow scroll container */}
      {createPortal(
        <div className={clsx(
          "fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-300",
          isDetailsOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}>
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsDetailsOpen(false)} />

          <aside className={clsx(
            "relative w-full max-w-lg max-h-[88vh] overflow-y-auto bg-white dark:bg-dark-card rounded-3xl shadow-2xl transition-all duration-300",
            isDetailsOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
          )}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            </div>
            {selectedAppointment && (
              <div className="px-5 sm:px-8 pb-8 pt-2 space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 italic tracking-tight uppercase">
                      <span className="text-brand-500 mr-2">/</span>Visit Details
                    </h3>
                    <div className={clsx(
                      "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2",
                      selectedAppointment.status === 'pending' && "bg-zinc-100 text-zinc-600",
                      selectedAppointment.status === 'approved' && "bg-emerald-50 text-emerald-700",
                      (selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'declined') && "bg-rose-50 text-rose-700",
                      selectedAppointment.status === 'completed' && "bg-blue-50 text-blue-700"
                    )}>
                      {statusLabel(selectedAppointment.status)}
                    </div>
                  </div>
                  <button onClick={() => setIsDetailsOpen(false)} className="p-2 rounded-xl bg-zinc-50 dark:bg-dark-surface text-zinc-400 hover:text-zinc-800 transition-all">
                    <FiXCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 sm:p-6 rounded-[2rem] bg-zinc-50/50 dark:bg-dark-surface/30 border-2 border-zinc-50 dark:border-dark-border space-y-5">
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
                          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{formatPortalDateLocal(selectedAppointment.date, true)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                          <FiClock className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Time</p>
                          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{formatTime(selectedAppointment.time) || '12:00 AM'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                        <FiCheckCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Service</p>
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{selectedAppointment.service?.name || 'N/A'}</p>
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
                          <FiAlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notes</p>
                          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed break-words">{selectedAppointment.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {(selectedAppointment.status === 'declined' || selectedAppointment.status === 'cancelled') && (
                    <div className="p-5 rounded-[1.5rem] bg-rose-50 border-2 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30">
                      <div className="flex items-start gap-3">
                        <FiXCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest">
                            {selectedAppointment.status === 'declined' ? 'Reason for Decline' : 'Cancellation Reason'}
                          </p>
                          <p className="text-sm font-medium text-rose-800 dark:text-rose-300 mt-1 leading-relaxed break-words">
                            {selectedAppointment.decline_reason || selectedAppointment.cancellation_reason || "No reason provided"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAppointment.status === 'completed' && (
                    <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                      <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <FiFileText className="w-3.5 h-3.5" /> Invoice
                      </p>
                      {invoiceLoading ? (
                        <p className="text-xs text-blue-500 font-medium">Loading invoice...</p>
                      ) : apptInvoice ? (
                        <button
                          onClick={() => setIsInvoiceModalOpen(true)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-dark-card border border-blue-200 dark:border-blue-700 hover:border-blue-400 transition-all group"
                        >
                          <div className="text-left">
                            <p className="text-sm font-black text-blue-700 dark:text-blue-400 group-hover:underline">{apptInvoice.invoice_number}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{apptInvoice.created_at ? new Date(apptInvoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</p>
                          </div>
                          <span className="text-sm font-black text-zinc-700 dark:text-zinc-300">₱{Number(apptInvoice.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </button>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">No invoice found for this visit.</p>
                      )}
                    </div>
                  )}

                  {selectedAppointment.status === 'pending' && (
                    <button
                      onClick={() => {
                        handleCancel(selectedAppointment.id);
                        setIsDetailsOpen(false);
                      }}
                      className="w-full h-14 rounded-2xl border-2 border-rose-100 text-rose-600 font-bold uppercase tracking-widest hover:bg-rose-50 transition-all mb-3 flex items-center justify-center gap-2"
                    >
                      <FiXCircle className="w-5 h-5" /> Cancel Appointment
                    </button>
                  )}

                  <button
                    onClick={() => setIsDetailsOpen(false)}
                    className="w-full h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-black uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>,
        document.body
      )}

      {/* Invoice Detail Modal */}
      {createPortal(
        <div className={clsx(
          "fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-opacity duration-200",
          isInvoiceModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}>
          <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => setIsInvoiceModalOpen(false)} />
          <div className={clsx(
            "relative w-full max-w-md bg-white dark:bg-dark-card rounded-3xl shadow-2xl transition-all duration-200 overflow-hidden",
            isInvoiceModalOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          )}>
            {apptInvoice && (
              <>
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-dark-border">
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Invoice</p>
                    <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">{apptInvoice.invoice_number}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{apptInvoice.created_at ? new Date(apptInvoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</p>
                  </div>
                  <button onClick={() => setIsInvoiceModalOpen(false)} className="p-2 rounded-xl bg-zinc-100 dark:bg-dark-surface text-zinc-400 hover:text-zinc-700 transition-all">
                    <FiXCircle className="w-5 h-5" />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
                  {(apptInvoice.items || []).filter((i: any) => !i.is_hidden).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="min-w-0 mr-4">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{item.name}</p>
                        <p className="text-[10px] text-zinc-400">Qty: {item.qty}</p>
                      </div>
                      <p className="font-bold text-zinc-700 dark:text-zinc-300 shrink-0">₱{Number(item.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6 pt-4 border-t border-zinc-100 dark:border-dark-border space-y-1">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Status</span>
                    <span className="font-bold">{apptInvoice.status}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-zinc-900 dark:text-zinc-100">
                    <span>Total</span>
                    <span className="text-blue-600">₱{Number(apptInvoice.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Pet Profile Modal */}
      <PetProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        petId={selectedPetId}
      />
    </div>
  );
}
