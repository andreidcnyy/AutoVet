import { useState, useEffect } from 'react';
import { getAppointments, cancelAppointment } from '../api';
import { 
  FiCalendar, 
  FiClock, 
  FiXCircle, 
  FiCheckCircle, 
  FiAlertCircle,
  FiArrowLeft,
  FiHeart,
  FiUser
} from 'react-icons/fi';
import { useNavigate, Link } from 'react-router-dom';
import PetProfileModal from '../components/PetProfileModal';
import clsx from 'clsx';

export default function Appointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchAppointments = () => {
    setLoading(true);
    getAppointments()
      .then(res => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const sorted = [...res.data].sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          dateA.setHours(0, 0, 0, 0);
          dateB.setHours(0, 0, 0, 0);

          const isA_Past = dateA < now;
          const isB_Past = dateB < now;

          if (isA_Past && !isB_Past) return 1;
          if (!isA_Past && isB_Past) return -1;
          if (!isA_Past && !isB_Past) return dateA.getTime() - dateB.getTime();
          return dateB.getTime() - dateA.getTime();
        });
        setAppointments(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCancel = async (id: number) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await cancelAppointment(id);
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
    setSelectedAppointment(appt);
    setIsDetailsOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading appointments...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition font-semibold text-sm">
          <FiArrowLeft /> Dashboard
        </button>
        <Link to="/book">
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all">
            <FiCalendar /> Book New Visit
          </button>
        </Link>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 italic uppercase tracking-tight">
          <span className="text-brand-500 mr-2">/</span> Visit History
        </h2>

        {appointments.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {appointments.map(appt => (
              <div key={appt.id} className="card-shell card-shell-hover p-6 bg-white dark:bg-dark-card group relative overflow-hidden">
                <div className={clsx(
                  "absolute left-0 top-0 bottom-0 w-1.5",
                  appt.status === 'pending' ? 'bg-amber-400' : 
                  appt.status === 'completed' ? 'bg-emerald-500' : 'bg-zinc-300'
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
                          appt.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                          appt.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                        )}>
                          {appt.status}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mt-0.5 hover:text-brand-500 transition-colors">Patient: {appt.pet?.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500 font-medium">
                        <span className="flex items-center gap-1.5"><FiCalendar className="w-4 h-4" /> {(() => {
  const d = new Date(appt.date);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
})()}</span>
                        <span className="flex items-center gap-1.5"><FiClock className="w-4 h-4" /> {appt.time?.substring(0, 5) || '00:00'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
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

      {/* Appointment Details Drawer/Modal Overlay */}
      <div className={clsx(
        "fixed inset-0 z-[60] transition-opacity duration-500",
        isDetailsOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsDetailsOpen(false)} />
        
        <aside className={clsx(
          "absolute inset-y-0 right-0 w-full max-w-md bg-white dark:bg-dark-card shadow-2xl transition-transform duration-500 p-8 overflow-y-auto",
          isDetailsOpen ? "translate-x-0" : "translate-x-full"
        )}>
          {selectedAppointment && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 italic tracking-tight uppercase">
                    <span className="text-brand-500 mr-2">/</span>Visit Details
                  </h3>
                  <div className={clsx(
                    "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2",
                    selectedAppointment.status === 'pending' ? "bg-amber-100 text-amber-700" : 
                    selectedAppointment.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                  )}>
                    {selectedAppointment.status}
                  </div>
                </div>
                <button onClick={() => setIsDetailsOpen(false)} className="p-2 rounded-xl bg-zinc-50 dark:bg-dark-surface text-zinc-400 hover:text-zinc-800 transition-all">
                  <FiXCircle className="w-6 h-6" />
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
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{new Date(selectedAppointment.date).toLocaleDateString()}</p>
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
                      <FiCheckCircle className="w-6 h-6" />
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
                        <FiAlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Notes</p>
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-1">{selectedAppointment.notes}</p>
                      </div>
                    </div>
                  )}
                </div>

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
      </div>

      {/* Pet Profile Modal */}
      <PetProfileModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        petId={selectedPetId}
      />
    </div>
  );
}
