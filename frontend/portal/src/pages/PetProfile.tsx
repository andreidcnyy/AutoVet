import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PawPrint } from './Landing';
import { getPet, getMedicalRecords, getInvoices } from '../api';
import {
  FiArrowLeft,
  FiCalendar,
  FiFileText,
  FiActivity,
  FiInfo,
  FiClock,
  FiAlertCircle,
  FiEdit2,
  FiUser,
  FiDollarSign
} from 'react-icons/fi';
import { LuPawPrint } from 'react-icons/lu';
import clsx from 'clsx';
import { readCache, writeCache } from '../utils/swrCache';
import { getActualPetImageUrl } from '../utils/petImages';
import { useAuth } from '../context/AuthContext';
import echo from '../utils/echo';

// Use the appointment (service) date when present, else the row creation date.
const invoiceDate = (inv: any): Date => {
  const raw = inv?.appointment?.date || inv?.created_at;
  if (!raw) return new Date(0);
  const normalized = typeof raw === 'string' && raw.includes('-') && !raw.includes('T')
    ? raw.replace(/-/g, '/')
    : raw;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

function PetProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pet, setPet] = useState<any>(null);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'medical' | 'invoices'>('summary');

  useEffect(() => {
    if (!id) return;
    const petId = parseInt(id);
    const CACHE_KEY = `portal_pet_profile_${user?.id}_${petId}_cache`;

    const cached = readCache<any>(CACHE_KEY);
    if (cached) {
      setPet(cached.pet);
      setMedicalRecords(cached.medicalRecords || []);
      setInvoices(cached.invoices || []);
      setLoading(false);
    }

    const fetchAll = () =>
      Promise.all([
        getPet(petId),
        getMedicalRecords(petId),
        getInvoices({ pet_id: petId })
      ])
      .then(([petRes, medicalRes, invoiceRes]) => {
        const invoiceData = Array.isArray(invoiceRes.data) ? invoiceRes.data : invoiceRes.data?.data || [];
        setPet(petRes.data);
        setMedicalRecords(medicalRes.data);
        setInvoices(invoiceData);
        writeCache(CACHE_KEY, { pet: petRes.data, medicalRecords: medicalRes.data, invoices: invoiceData });
        writeCache(`portal_pet_${petId}_cache`, petRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetchAll();
    const poll = setInterval(fetchAll, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(); };
    document.addEventListener('visibilitychange', onVisible);

    // Real-time: refresh when admin updates this client's invoices or appointments
    const userId = user?.id;
    if (userId) {
      echo.private(`client.invoices.${userId}`)
        .listen('.invoice.updated', fetchAll);
      echo.private(`client.appointments.${userId}`)
        .listen('.appointment.status.updated', fetchAll)
        .listen('.appointment.created', fetchAll);
    }

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      if (userId) {
        echo.leave(`client.invoices.${userId}`);
        echo.leave(`client.appointments.${userId}`);
      }
    };
  }, [id, user?.id]);

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading pet profile...</div>;
  if (!pet) return <div className="p-8 text-center text-rose-500 font-bold">Pet not found.</div>;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FiInfo },
    { id: 'medical', label: 'Medical History', icon: FiActivity },
    { id: 'invoices', label: 'Invoices', icon: FiDollarSign },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-row items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition font-semibold text-sm shrink-0">
          <FiArrowLeft /><span className="hidden sm:inline">Dashboard</span>
        </button>
        <div className="flex gap-2 sm:gap-3">
          <Link to={`/pets/${pet.id}/edit`}>
            <button className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border-2 border-zinc-100 dark:border-dark-border text-zinc-600 dark:text-zinc-400 text-sm font-bold hover:bg-zinc-50 dark:hover:bg-dark-surface transition-all">
              <FiEdit2 /><span className="hidden sm:inline">Edit Pet</span>
            </button>
          </Link>
          <Link to="/book">
            <button className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all">
              <FiCalendar /><span className="hidden sm:inline">Book Visit</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="rounded-2xl p-5 sm:p-8 bg-gradient-to-br from-brand-500 via-emerald-600 to-emerald-700 dark:from-emerald-500 dark:via-emerald-400 dark:to-teal-400 overflow-hidden relative text-white shadow-xl">
        <PawPrint className="absolute -top-4 -right-4 w-40 h-40 text-white opacity-25 rotate-12 pointer-events-none" />
        <PawPrint className="absolute bottom-2 left-4 w-16 h-16 text-white opacity-20 -rotate-6 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center gap-3 sm:gap-6 md:gap-8 relative z-10">
          <div className="w-32 h-32 rounded-[2.5rem] bg-white/20 backdrop-blur-md border-4 border-white/30 shadow-2xl flex items-center justify-center overflow-hidden shrink-0">
             {pet.photo ? (
               <img src={getActualPetImageUrl(pet.photo)} alt={pet.name} className="w-full h-full object-cover" />
             ) : (
               <LuPawPrint className="w-12 h-12 text-white/60" />
             )}
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tight">
              {pet.name}
            </h1>
            <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-3">
               <span className="px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest text-white">
                 {pet.breed?.name || pet.species?.name}
               </span>
               <span className="px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest text-white">
                 {pet.sex}
               </span>
               <span className="px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest text-white">
                 {pet.age_group || 'Adult'}
               </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 sm:gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-full sm:w-fit overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1 sm:flex-none justify-center",
              activeTab === tab.id
              ? "bg-white dark:bg-dark-card text-brand-600 shadow-sm"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
            )}
          >
            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.id === 'summary' ? 'Info' : tab.id === 'medical' ? 'Medical' : 'Bills'}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-shell p-4 sm:p-6 bg-white dark:bg-dark-card space-y-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                 <FiInfo className="text-brand-500" /> Vitals & Traits
               </h3>
               <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Weight</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200">{pet.weight} {pet.weight_unit}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Color</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200">{pet.color || 'N/A'}</div>
                  </div>
                  {pet.size_category?.name && (
                  <div className="col-span-2">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Size Category</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200">{pet.size_category.name}</div>
                  </div>
                  )}
               </div>
            </div>

            <div className="card-shell p-4 sm:p-6 bg-white dark:bg-dark-card space-y-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                 <FiAlertCircle className="text-rose-500" /> Allergies & Notes
               </h3>
               <div className="space-y-4 pt-2">
                  <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Known Allergies</div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{pet.allergies || 'None recorded.'}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Owner Notes</div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{pet.notes || 'No special notes.'}</p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="space-y-4">
            {medicalRecords.length > 0 ? (
              medicalRecords.map(record => (
                <div key={record.id} className="card-shell p-4 sm:p-6 bg-white dark:bg-dark-card hover:border-brand-500/30 transition-all group">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/10 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
                            <FiActivity className="w-6 h-6" />
                         </div>
                         <div>
                            <div className="text-[10px] font-black text-brand-500 uppercase tracking-widest">{record.type || 'Consultation'}</div>
                            <h4 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{record.title || 'Medical Visit'}</h4>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-1 text-xs text-zinc-500 gap-0.5">
                               <span className="flex items-center gap-1"><FiCalendar className="shrink-0" /> {new Date(record.date).toLocaleDateString()}</span>
                               <span className="flex items-center gap-1"><FiUser className="shrink-0" /> Dr. {record.vet?.name || 'Unknown'}</span>
                            </div>
                         </div>
                      </div>
                      <div className="md:text-right">
                         <div className="text-[10px] font-black text-zinc-400 uppercase mb-1">Diagnosis</div>
                         <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{record.diagnosis || 'Standard Checkup'}</div>
                      </div>
                   </div>
                   {record.notes && (
                     <div className="mt-6 p-4 rounded-2xl bg-zinc-50 dark:bg-dark-surface/50 border border-zinc-100 dark:border-dark-border text-sm text-zinc-600 dark:text-zinc-400 italic">
                        "{record.notes}"
                     </div>
                   )}
                </div>
              ))
            ) : (
              <div className="card-shell p-12 text-center text-zinc-400 bg-zinc-50/50 border-dashed">
                No medical records available for {pet.name}.
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {(() => {
              const visibleInvoices = invoices
                .filter(inv => inv.status?.toLowerCase() !== 'draft')
                .sort((a, b) => invoiceDate(b).getTime() - invoiceDate(a).getTime());
              return visibleInvoices.length > 0 ? (
              visibleInvoices.map(invoice => (
                <div key={invoice.id} className="card-shell p-4 sm:p-6 bg-white dark:bg-dark-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 group">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-emerald-600 group-hover:rotate-12 transition-transform">
                         <FiDollarSign className="w-6 h-6" />
                      </div>
                      <div>
                         <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">#{invoice.invoice_number}</div>
                         <h4 className="font-bold text-zinc-800 dark:text-zinc-100 italic uppercase tracking-tight">Invoice Details</h4>
                         <div className="text-xs text-zinc-500">{invoiceDate(invoice).toLocaleDateString()}</div>
                      </div>
                   </div>
                   <div className="flex flex-col gap-1 sm:items-end sm:text-right">
                      <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                        ₱{parseFloat(invoice.total).toLocaleString()}
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full w-fit ${
                        ['paid', 'finalized'].includes(invoice.status?.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {invoice.status}
                      </span>
                   </div>
                </div>
              ))
            ) : (
              <div className="card-shell p-12 text-center text-zinc-400 bg-zinc-50/50 border-dashed">
                No invoice history found.
              </div>
            );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}

export default PetProfile;
