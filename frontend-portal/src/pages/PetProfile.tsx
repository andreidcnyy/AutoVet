import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPet, getMedicalRecords, getInvoices } from '../api';
import { 
  FiArrowLeft, 
  FiCalendar, 
  FiFileText, 
  FiDollarSign, 
  FiActivity,
  FiInfo,
  FiClock,
  FiAlertCircle,
  FiEdit2
} from 'react-icons/fi';
import { LuPawPrint } from 'react-icons/lu';
import clsx from 'clsx';

function PetProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pet, setPet] = useState<any>(null);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'medical' | 'invoices'>('summary');

  useEffect(() => {
    if (!id) return;
    const petId = parseInt(id);
    
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
  }, [id]);

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading pet profile...</div>;
  if (!pet) return <div className="p-8 text-center text-rose-500 font-bold">Pet not found.</div>;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FiInfo },
    { id: 'medical', label: 'Medical History', icon: FiActivity },
    { id: 'invoices', label: 'Billing', icon: FiDollarSign },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition font-semibold text-sm">
          <FiArrowLeft /> Dashboard
        </button>
        <div className="flex gap-3">
          <Link to={`/pets/${pet.id}/edit`}>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-zinc-100 dark:border-dark-border text-zinc-600 dark:text-zinc-400 text-sm font-bold hover:bg-zinc-50 dark:hover:bg-dark-surface transition-all">
              <FiEdit2 /> Edit Pet
            </button>
          </Link>
          <Link to="/book">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all">
              <FiCalendar /> Book Visit
            </button>
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="card-shell p-8 bg-white dark:bg-dark-card overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
            <LuPawPrint className="w-32 h-32" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-32 h-32 rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-800 border-4 border-white dark:border-dark-border shadow-xl flex items-center justify-center overflow-hidden">
             {pet.photo ? (
               <img src={`http://localhost:8000/storage/${pet.photo}`} alt={pet.name} className="w-full h-full object-cover" />
             ) : (
               <LuPawPrint className="w-12 h-12 text-zinc-300" />
             )}
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-50 italic uppercase tracking-tight">
              {pet.name}
            </h1>
            <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-3">
               <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                 {pet.breed?.name || pet.species?.name}
               </span>
               <span className="px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-[10px] font-black uppercase tracking-widest text-brand-600">
                 {pet.sex}
               </span>
               <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                 {pet.age_group || 'Adult'}
               </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Content */}
      <div className="space-y-6">
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
                  <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Size Category</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200">{pet.size_category?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Status</div>
                    <div className="font-bold text-emerald-600">{pet.status}</div>
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
                <div key={record.id} className="card-shell p-6 bg-white dark:bg-dark-card hover:border-brand-500/30 transition-all group">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/10 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
                            <FiActivity className="w-6 h-6" />
                         </div>
                         <div>
                            <div className="text-[10px] font-black text-brand-500 uppercase tracking-widest">{record.type || 'Consultation'}</div>
                            <h4 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{record.title || 'Medical Visit'}</h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                               <span className="flex items-center gap-1"><FiCalendar /> {new Date(record.date).toLocaleDateString()}</span>
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
                <div key={invoice.id} className="card-shell p-6 bg-white dark:bg-dark-card flex items-center justify-between group">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-emerald-600 group-hover:rotate-12 transition-transform">
                         <FiDollarSign className="w-6 h-6" />
                      </div>
                      <div>
                         <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">#{invoice.invoice_number}</div>
                         <h4 className="font-bold text-zinc-800 dark:text-zinc-100 italic uppercase tracking-tight">Invoice Details</h4>
                         <div className="text-xs text-zinc-500">{new Date(invoice.created_at).toLocaleDateString()}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                        ₱{parseFloat(invoice.total).toLocaleString()}
                      </div>
                      <span className={clsx(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                        invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
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
  );
}

export default PetProfile;
