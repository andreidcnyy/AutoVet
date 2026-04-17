import { useState, useEffect } from 'react';
import { getPet, getMedicalRecords, getInvoices } from '../api';
import { 
  FiX,
  FiCalendar, 
  FiFileText, 
  FiDollarSign, 
  FiActivity,
  FiInfo,
  FiUser,
  FiClock,
  FiAlertCircle,
  FiEdit2
} from 'react-icons/fi';
import { LuPawPrint } from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { getActualPetImageUrl } from '../utils/petImages';
import { calculateAgeDisplay } from '../utils/petAgeGroups';
import clsx from 'clsx';

interface PetProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  petId: number | null;
}

export default function PetProfileModal({ isOpen, onClose, petId }: PetProfileModalProps) {
  const navigate = useNavigate();
  const [pet, setPet] = useState<any>(null);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'medical' | 'invoices'>('summary');

  useEffect(() => {
    if (isOpen && petId) {
      setLoading(true);
      Promise.all([
        getPet(petId),
        getMedicalRecords(petId),
        getInvoices(petId)
      ])
      .then(([petRes, medicalRes, invoiceRes]) => {
        setPet(petRes.data);
        setMedicalRecords(medicalRes.data);
        setInvoices(invoiceRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    } else {
      setPet(null);
      setMedicalRecords([]);
      setInvoices([]);
      setActiveTab('summary');
    }
  }, [isOpen, petId]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FiInfo },
    { id: 'medical', label: 'Medical History', icon: FiActivity },
    { id: 'invoices', label: 'Billing', icon: FiDollarSign },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-300 dark:bg-dark-card border border-zinc-200 dark:border-dark-border flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-[10001] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition-colors shadow-lg"
        >
          <FiX className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-brand-600" />
                <p className="text-sm font-bold text-zinc-500">Retrieving pet profile...</p>
              </div>
            </div>
          ) : !pet ? (
            <div className="flex h-96 items-center justify-center p-12 text-center">
              <p className="text-lg font-bold text-rose-500">Pet not found.</p>
            </div>
          ) : (
            <div className="space-y-6 pb-8">
              {/* Hero Section */}
              <div className="p-8 bg-brand-600 dark:bg-brand-900/40 text-white overflow-hidden relative rounded-b-[2rem]">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <LuPawPrint className="w-48 h-48" />
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-white/20 backdrop-blur-md border-4 border-white/30 shadow-2xl flex items-center justify-center overflow-hidden shrink-0">
                     {pet.photo ? (
                       <img src={getActualPetImageUrl(pet.photo)} alt={pet.name} className="w-full h-full object-cover" />
                     ) : (
                       <LuPawPrint className="w-12 h-12 text-white/50" />
                     )}
                  </div>
                  <div className="text-center md:text-left flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <h1 className="text-4xl font-black italic uppercase tracking-tight truncate">
                        {pet.name}
                      </h1>
                      <div className="flex gap-2 justify-center md:justify-start">
                        <Link to={`/pets/${pet.id}/edit`}>
                          <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Edit Pet">
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                        </Link>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                       <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
                         {pet.breed?.name || pet.species?.name}
                       </span>
                       <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
                         {pet.sex}
                       </span>
                       <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
                         {pet.age_group || 'Adult'}
                       </span>
                       <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
                         {calculateAgeDisplay(pet.date_of_birth)}
                       </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <button 
                      onClick={() => { onClose(); navigate('/book'); }}
                      className="px-6 py-3 rounded-2xl bg-white text-brand-600 font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-900/20 hover:scale-105 transition-all active:scale-95"
                    >
                      Book Visit
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-8">
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-fit">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={clsx(
                        "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === tab.id
                        ? "bg-white dark:bg-dark-card text-brand-600 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="px-8 space-y-6">
                {activeTab === 'summary' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card-shell p-6 bg-white dark:bg-dark-card space-y-4">
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
                          <div className="col-span-2">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase">Size Category</div>
                            <div className="font-bold text-zinc-800 dark:text-zinc-200">{pet.size_category?.name || 'N/A'}</div>
                          </div>
                       </div>
                    </div>

                    <div className="card-shell p-6 bg-white dark:bg-dark-card space-y-4">
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
                        <div key={record.id} className="card-shell card-shell-hover p-6 bg-white dark:bg-dark-card hover:border-brand-500/30 transition-all group text-left">
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                 <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/10 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
                                    <FiActivity className="w-6 h-6" />
                                 </div>
                                 <div>
                                    <div className="text-[10px] font-black text-brand-500 uppercase tracking-widest">{record.type || 'Consultation'}</div>
                                    <h4 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{record.title || 'Medical Visit'}</h4>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                       <span className="flex items-center gap-1"><FiCalendar /> {(() => {
  const d = new Date(record.date);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
})()}</span>
                                       <span className="flex items-center gap-1"><FiUser /> Dr. {record.vet?.name || 'Unknown'}</span>
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
                    {invoices.length > 0 ? (
                      invoices.map(invoice => (
                        <div key={invoice.id} className="card-shell card-shell-hover p-6 bg-white dark:bg-dark-card flex items-center justify-between group">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-emerald-600 group-hover:rotate-12 transition-transform">
                                 <FiDollarSign className="w-6 h-6" />
                              </div>
                              <div>
                                 <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">#{invoice.invoice_number}</div>
                                 <h4 className="font-bold text-zinc-800 dark:text-zinc-100 italic uppercase tracking-tight">Invoice Details</h4>
                                 <div className="text-xs text-zinc-500">
  {(() => {
    const d = new Date(invoice.created_at);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  })()}
</div>
                              </div>
                           </div>
                           <div className="text-right">
                              <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                                ₱{parseFloat(invoice.total).toLocaleString()}
                              </div>
                              <span className={clsx(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                ['paid', 'finalized'].includes(invoice.status?.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              )}>
                                {invoice.status}
                              </span>
                           </div>
                        </div>
                      ))
                    ) : (
                      <div className="card-shell p-12 text-center text-zinc-400 bg-zinc-50/50 border-dashed">
                        No billing history found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
