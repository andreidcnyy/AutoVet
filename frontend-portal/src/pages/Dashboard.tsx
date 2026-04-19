import { useState, useEffect } from 'react';
import { getPortalOverview, cancelAppointment } from '../api';
import { readCache, writeCache } from '../utils/swrCache';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiCalendar, FiHeart, FiClock, FiEdit2, FiBell, FiChevronRight, FiPlusCircle, FiUser, FiXCircle, FiCreditCard, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import PetProfileModal from '../components/PetProfileModal';
import EditPetModal from '../components/EditPetModal';
import { getActualPetImageUrl } from '../utils/petImages';
import { calculateAgeDisplay } from '../utils/petAgeGroups';
import clsx from 'clsx';

// Fix for YYYY-MM-DD timezone shift: use slashes instead of dashes to force local time parsing
const formatPortalDateLocal = (dateStr: string) => {
  if (!dateStr) return "N/A";
  const normalizedDate = dateStr.includes('-') ? dateStr.replace(/-/g, '/') : dateStr;
  const d = new Date(normalizedDate);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [pets, setPets] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [petToEditId, setPetToEditId] = useState<number | null>(null);

  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const CACHE_KEY = 'portal_overview_cache';

  const applyData = (data: any) => {
    const petsData = Array.isArray(data.pets) ? data.pets : data.pets?.data || [];
    const apptsData = Array.isArray(data.appointments) ? data.appointments : data.appointments?.data || [];
    const notifData = Array.isArray(data.notifications) ? data.notifications : data.notifications?.data || [];
    setPets(petsData);
    setAppointments(apptsData);
    setNotifications(notifData.filter((n: any) => !n.read_at).slice(0, 3));
  };

  const fetchData = () => {
    getPortalOverview()
      .then((res: any) => {
        applyData(res.data);
        writeCache(CACHE_KEY, res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const cached = readCache<any>(CACHE_KEY);
    if (cached) {
      applyData(cached);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handlePetClick = (id: number) => {
    setSelectedPetId(id);
    setIsModalOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setPetToEditId(id);
    setIsEditModalOpen(true);
  };

  const handleDetailsClick = (appt: any) => {
    setSelectedAppointment(appt);
    setIsDetailsOpen(true);
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await cancelAppointment(id);
      fetchData();
      setIsDetailsOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to cancel appointment.");
    }
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading your dashboard...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 font-sans">Welcome back!</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Here is what's happening with your pets.</p>
        </div>
        <Link to="/book">
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white font-semibold shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all hover:-translate-y-0.5 active:translate-y-0">
            <FiCalendar className="w-5 h-5" />
            <span>Book Appointment</span>
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pets Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2 uppercase tracking-tight">
              <FiHeart className="text-rose-500" />
              My Pets
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pets.length > 0 ? (
              <>
                {pets.map(pet => (
                  <div key={pet.id} onClick={() => handlePetClick(pet.id)}>
                    <div className="card-shell card-shell-hover p-5 flex items-center gap-4 hover:border-brand-500/50 transition-all cursor-pointer group">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-dark-border">
                        {pet.photo ? (
                          <img src={getActualPetImageUrl(pet.photo)} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          <FiHeart className="w-8 h-8 text-zinc-300 dark:text-zinc-600 group-hover:scale-110 transition-transform" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg truncate leading-tight uppercase tracking-tight">{pet.name}</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-500 truncate mt-0.5">
                          {pet.breed?.name || pet.species?.name || 'Unknown Breed'}
                        </p>
                        <p className="text-xs font-bold text-zinc-400 mt-1 flex items-center gap-1">
                          <FiClock className="w-3 h-3" /> {calculateAgeDisplay(pet.date_of_birth)}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => handleEditClick(e, pet.id)}
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface text-zinc-400 hover:text-brand-500 transition-colors"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Secondary Register Button inside the grid */}
                <Link to="/add-pet" className="group">
                  <div className="h-full border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex items-center justify-center gap-3 text-zinc-400 group-hover:border-brand-400 group-hover:text-brand-600 transition-all cursor-pointer bg-zinc-50/30 dark:bg-dark-surface/10">
                    <FiPlusCircle className="w-6 h-6" />
                    <span className="text-xs font-black uppercase tracking-widest">Register New Pet</span>
                  </div>
                </Link>
              </>
            ) : (
              <div className="col-span-full card-shell p-12 text-center space-y-4 bg-zinc-50/50 border-dashed">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                  <FiHeart className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-zinc-500 font-bold">You haven't added any pets yet.</p>
                  <p className="text-xs text-zinc-400 mt-1">Register your pets to start booking appointments.</p>
                </div>
                <Link to="/add-pet">
                  <button className="px-8 py-3 rounded-xl bg-brand-500 text-white font-black uppercase tracking-widest text-xs hover:bg-brand-600 shadow-lg shadow-brand-500/20 transition-all">Register your first pet</button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Appointments Section */}
        <div className="space-y-6">
          {/* Notifications Highlight */}
          {notifications.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <FiBell className="text-brand-500" />
                Recent Alerts
              </h2>
              <div className="space-y-2">
                {notifications.map(n => {
                  const Icon = n.iconName === 'FiCheckCircle' ? FiCheckCircle : 
                               n.iconName === 'FiAlertCircle' ? FiAlertCircle :
                               n.iconName === 'FiFileText' ? FiCreditCard :
                               n.iconName === 'FiClock' ? FiClock :
                               n.iconName === 'FiPlusCircle' ? FiPlusCircle : FiBell;
                  
                  const toneClasses = n.tone === 'success' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' :
                                    n.tone === 'danger' ? 'bg-rose-50 text-rose-500 border-rose-100' :
                                    n.tone === 'warning' ? 'bg-amber-50 text-amber-500 border-amber-100' :
                                    'bg-brand-50 text-brand-500 border-brand-100';

                  return (
                    <div 
                      key={n.id} 
                      onClick={() => navigate(n.id.startsWith('invoice') ? '/invoices' : '/notifications')}
                      className={clsx(
                        "group flex items-start gap-3 p-4 rounded-2xl border cursor-pointer hover:shadow-md transition-all animate-in slide-in-from-right-4 duration-300",
                        toneClasses
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{n.title}</p>
                        <p className="text-[10px] opacity-80 line-clamp-1">{n.message}</p>
                      </div>
                      <FiChevronRight className="mt-1 w-3 h-3 opacity-40 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <FiClock className="text-brand-500" />
                Upcoming
              </h2>
              <Link to="/appointments" className="text-xs font-bold text-brand-600 hover:underline">
                View All
              </Link>
            </div>
            
            <div className="card-shell bg-white dark:bg-dark-card overflow-hidden">
              {appointments.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-dark-border">
                  {appointments.filter(a => a.status !== 'cancelled').slice(0, 5).map(appt => (
                    <div 
                      key={appt.id} 
                      onClick={() => handleDetailsClick(appt)}
                      className="p-4 hover:bg-zinc-50 dark:hover:bg-dark-surface/50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest truncate">{appt.service?.name}</span>
                             <span className={clsx(
                               "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md",
                               appt.status === 'pending' && 'bg-zinc-100 text-zinc-600',
                               appt.status === 'approved' && 'bg-emerald-50 text-emerald-700',
                               (appt.status === 'cancelled' || appt.status === 'declined') && 'bg-rose-50 text-rose-700',
                               appt.status === 'completed' && 'bg-blue-50 text-blue-700'
                             )}>
                               {appt.status}
                             </span>
                          </div>
                          <h4 className="font-bold text-zinc-800 dark:text-zinc-100 truncate mt-0.5 group-hover:text-brand-500 transition-colors">{appt.pet?.name}</h4>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-black text-zinc-900 dark:text-zinc-50 flex items-center justify-end gap-1">
                            <FiCalendar className="w-3 h-3 text-zinc-400" />
                            {formatPortalDateLocal(appt.date)}
                          </div>
                          <div className="text-[10px] font-bold text-zinc-400 mt-0.5 flex items-center justify-end gap-1 uppercase tracking-tighter">
                            <FiClock className="w-3 h-3" />
                            {appt.time?.substring(0, 5) || '00:00'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-400 text-sm">
                  No upcoming appointments.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Details Drawer */}
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
                    selectedAppointment.status === 'pending' && "bg-zinc-100 text-zinc-600",
                    selectedAppointment.status === 'approved' && "bg-emerald-50 text-emerald-700",
                    (selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'declined') && "bg-rose-50 text-rose-700",
                    selectedAppointment.status === 'completed' && "bg-blue-50 text-blue-700"
                  )}>
                    {selectedAppointment.status}
                  </div>
                </div>
                <button onClick={() => setIsDetailsOpen(false)} className="p-2 rounded-xl bg-zinc-50 dark:bg-dark-surface text-zinc-400 hover:text-zinc-800 transition-all">
                  <FiPlusCircle className="w-6 h-6 rotate-45" />
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
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{formatPortalDateLocal(selectedAppointment.date || selectedAppointment.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                        <FiClock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Time</p>
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{selectedAppointment.time?.substring(0, 5) || '00:00'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                      <FiPlusCircle className="w-6 h-6" />
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
                        <FiEdit2 className="w-6 h-6" />
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

                {selectedAppointment.status === 'pending' && (
                  <button 
                    onClick={() => handleCancel(selectedAppointment.id)}
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

      {/* Edit Pet Modal */}
      <EditPetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        petId={petToEditId}
        onSuccess={fetchData}
      />
    </div>
  );
}
