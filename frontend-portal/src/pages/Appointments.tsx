import { useState, useEffect } from 'react';
import { getAppointments, cancelAppointment } from '../api';
import { 
  FiCalendar, 
  FiClock, 
  FiXCircle, 
  FiCheckCircle, 
  FiAlertCircle,
  FiArrowLeft
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

  const fetchAppointments = () => {
    setLoading(true);
    getAppointments()
      .then(res => setAppointments(res.data))
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
    } catch (err) {
      alert("Failed to cancel appointment.");
    }
  };

  const handlePetClick = (id: number) => {
    setSelectedPetId(id);
    setIsModalOpen(true);
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
              <div key={appt.id} className="card-shell p-6 bg-white dark:bg-dark-card group relative overflow-hidden">
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
                    <div>
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
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mt-0.5">Patient: {appt.pet?.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500 font-medium">
                        <span className="flex items-center gap-1.5"><FiCalendar className="w-4 h-4" /> {new Date(appt.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        <span className="flex items-center gap-1.5"><FiClock className="w-4 h-4" /> {appt.time.substring(0, 5)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
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

      {/* Pet Profile Modal */}
      <PetProfileModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        petId={selectedPetId}
      />
    </div>
  );
}
