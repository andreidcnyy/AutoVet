import { useState, useEffect, useMemo } from 'react';
import { getPet, getMedicalRecords, getInvoices } from '../api';
import { 
  FiX,
  FiCalendar, 
  FiFileText, 
  FiCreditCard, 
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
import { readCache, writeCache } from '../utils/swrCache';

function formatPortalDate(dateStr: string) {
  if (!dateStr) return "N/A";
  
  // Extract only the date part (YYYY-MM-DD) if it's an ISO string to avoid UTC shift
  const cleanDate = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  
  // Fix for YYYY-MM-DD timezone shift: use slashes instead of dashes to force local time parsing
  const normalizedDate = typeof cleanDate === 'string' && cleanDate.includes('-') ? cleanDate.replace(/-/g, '/') : cleanDate;
  
  const d = new Date(normalizedDate);
  if (isNaN(d.getTime())) return "N/A";
  
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  useEffect(() => {
    if (isOpen && petId) {
      const CACHE_KEY = `portal_pet_modal_${petId}_cache`;
      const cached = readCache<any>(CACHE_KEY);
      if (cached) {
        setPet(cached.pet);
        setMedicalRecords(cached.medicalRecords || []);
        setInvoices(cached.invoices || []);
        setLoading(false);
      } else {
        setLoading(true);
      }

      Promise.all([
        getPet(petId),
        getMedicalRecords({ pet_id: petId }),
        getInvoices({ pet_id: petId })
      ])
      .then(([petRes, medicalRes, invoiceRes]) => {
        const petData = petRes.data.data || petRes.data;
        const medicalData = Array.isArray(medicalRes.data) ? medicalRes.data : medicalRes.data.data || [];
        const invoiceData = Array.isArray(invoiceRes.data) ? invoiceRes.data : invoiceRes.data.data || [];

        setPet(petData);
        setMedicalRecords(medicalData);
        setInvoices(invoiceData);
        writeCache(CACHE_KEY, { pet: petData, medicalRecords: medicalData, invoices: invoiceData });
      })
      .catch(err => {
        console.error("PetProfileModal Fetch Error:", err);
        if (!cached) setPet(null);
      })
      .finally(() => setLoading(false));
    } else {
      setPet(null);
      setMedicalRecords([]);
      setInvoices([]);
      setActiveTab('summary');
      setViewingRecord(null);
    }
  }, [isOpen, petId]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FiInfo },
    { id: 'medical', label: 'Medical History', icon: FiActivity },
    { id: 'invoices', label: 'Billing', icon: FiCreditCard },
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
                            <div className="font-bold text-zinc-800 dark:text-zinc-200">{Math.round(pet.weight)} {pet.weight_unit}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-zinc-400 uppercase">Color</div>
                            <div className="font-bold text-zinc-800 dark:text-zinc-200">{pet.color || 'N/A'}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase">Size Category</div>
                            <div className="font-bold text-zinc-800 dark:text-zinc-200">{pet.size_category?.name || 'N/A'}</div>
                          </div>
                          <div className="col-span-2 border-t border-zinc-100 dark:border-dark-border pt-4 mt-2">
                            <div className="flex justify-between gap-4">
                               <div>
                                  <div className="text-[10px] font-bold text-zinc-400 uppercase">Last Visit</div>
                                  <div className="font-bold text-zinc-700 dark:text-zinc-300">
                                     {pet.last_visit && pet.last_visit !== 'No past visits' ? formatPortalDate(pet.last_visit) : "No past visits"}
                                  </div>
                               </div>
                               <div className="text-right">
                                  <div className="text-[10px] font-bold text-zinc-400 uppercase">Next Due</div>
                                  <div className="font-bold text-brand-600 dark:text-brand-400">
                                     {pet.next_due && pet.next_due !== 'None scheduled' ? formatPortalDate(pet.next_due) : "None scheduled"}
                                  </div>
                               </div>
                            </div>
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
                                    <h4 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{record.appointment?.service?.name || record.title || 'Medical Visit'}</h4>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                       <span className="flex items-center gap-1"><FiCalendar /> {formatPortalDate(record.appointment?.date || record.created_at)}</span>
                                       <span className="flex items-center gap-1"><FiUser /> Dr. {record.vet?.name || 'Unknown'}</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="flex flex-col md:items-end gap-2 shrink-0">
                                 <div className="md:text-right">
                                    <div className="text-[10px] font-black text-zinc-400 uppercase mb-1">Diagnosis</div>
                                    <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{record.diagnosis || 'Standard Checkup'}</div>
                                 </div>
                                 <button
                                   onClick={() => setViewingRecord(record)}
                                   className="text-[10px] font-black uppercase tracking-widest text-brand-600 hover:text-brand-700 underline underline-offset-4"
                                 >
                                   View Details
                                 </button>
                              </div>
                           </div>
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
                                 <FiCreditCard className="w-6 h-6" />
                              </div>
                              <div>
                                 <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">#{invoice.invoice_number}</div>
                                 <h4 className="font-bold text-zinc-800 dark:text-zinc-100 italic uppercase tracking-tight">Invoice Details</h4>
                                 <div className="text-xs text-zinc-500">
  {formatPortalDate(invoice.created_at)}
</div>
                              </div>
                           </div>
                           <div className="text-right flex flex-col items-end gap-1">
                              <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                                ₱{parseFloat(invoice.total).toLocaleString()}
                              </div>
                              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">
                                Paid: ₱{parseFloat(invoice.formatted_amount_paid || invoice.amount_paid || 0).toLocaleString()}
                              </div>
                              <span className={clsx(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full w-fit",
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

      {/* Details Sub-Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={() => setViewingRecord(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-dark-card rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-100 dark:border-dark-border">
             <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100 dark:border-dark-border">
                <div>
                   <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase italic tracking-tight">Clinical Summary</h3>
                   <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Record ID #{viewingRecord.id}</p>
                </div>
                <button onClick={() => setViewingRecord(null)} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 transition-colors">
                   <FiX className="w-5 h-5" />
                </button>
             </div>
             
             <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <section>
                   <p className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-3">01. Attending Veterinarian</p>
                   <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                         <FiUser className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="font-bold text-zinc-800 dark:text-zinc-200">Dr. {viewingRecord.vet?.name || 'Assigned Staff'}</p>
                         <p className="text-xs text-zinc-400 uppercase font-bold tracking-tight">{viewingRecord.vet?.specialization || 'Clinical Vet'}</p>
                      </div>
                   </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <section>
                      <p className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-2">02. Chief Complaint</p>
                      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50/50 dark:bg-dark-surface/30 p-4 rounded-2xl border border-zinc-100 dark:border-dark-border">
                         {viewingRecord.chief_complaint || 'N/A'}
                      </p>
                   </section>
                   <section>
                      <p className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-2">03. Diagnosis</p>
                      <p className="text-sm font-black text-zinc-800 dark:text-zinc-100 leading-relaxed bg-brand-50/30 dark:bg-brand-900/10 p-4 rounded-2xl border border-brand-100/50 dark:border-brand-900/30">
                         {viewingRecord.diagnosis || 'Standard Checkup'}
                      </p>
                   </section>
                </div>

                <section>
                   <p className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-2">04. Clinical Findings</p>
                   <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {viewingRecord.findings || 'No physical findings recorded.'}
                   </p>
                </section>

                <section>
                   <p className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-2">05. Treatment Plan</p>
                   <div className="bg-emerald-50/30 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30">
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 leading-relaxed">
                         {viewingRecord.treatment_plan || 'Monitor symptoms and follow up as scheduled.'}
                      </p>
                   </div>
                </section>

                <section className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 text-white shadow-xl">
                   <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Next Follow-up</p>
                      <p className="text-sm font-black italic">
                         {viewingRecord.follow_up_date ? formatPortalDate(viewingRecord.follow_up_date) : "Not yet scheduled"}
                      </p>
                   </div>
                   <FiCalendar className="w-6 h-6 text-zinc-500" />
                </section>
             </div>

             <div className="p-6 bg-zinc-50 dark:bg-dark-surface/50 border-t border-zinc-100 dark:border-dark-border flex justify-end">
                <button 
                  onClick={() => setViewingRecord(null)}
                  className="px-8 py-3 rounded-xl bg-zinc-900 text-white text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95"
                >
                   Close Summary
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
