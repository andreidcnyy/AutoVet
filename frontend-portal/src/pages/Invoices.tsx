import { useState, useEffect } from 'react';
import { getInvoices, getPets, getSettings } from '../api';
import { 
  FiDollarSign, 
  FiFileText, 
  FiArrowLeft,
  FiFilter,
  FiSearch,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiDownload,
  FiX
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { generateInvoicePDF } from '../utils/invoicePdf';
import { useAuth } from '../context/AuthContext';

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [clinicSettings, setClinicSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPetId, setSelectedPetId] = useState<string>("all");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([getInvoices(), getPets(), getSettings()])
      .then(([invRes, petsRes, settingsRes]) => {
        setInvoices(invRes.data);
        setPets(petsRes.data);
        setClinicSettings(settingsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = (invoice: any) => {
    // If the invoice doesn't have owner info (portal backend usually doesn't nest it)
    // We enrich it with the current user's info for the PDF
    const enrichedInvoice = {
      ...invoice,
      pet: {
        ...invoice.pet,
        owner: {
          name: user?.name || 'Valued Client',
          email: user?.email || '',
          address: user?.address || 'No address provided',
          phone: user?.phone || ''
        }
      }
    };
    generateInvoicePDF(enrichedInvoice, clinicSettings);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesPet = selectedPetId === "all" || String(inv.pet_id) === selectedPetId;
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         inv.pet?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPet && matchesSearch;
  });

  const totals = filteredInvoices.reduce((acc, inv) => {
    if (inv.status !== 'Cancelled') {
      acc.paid += parseFloat(inv.total);
    }
    return acc;
  }, { paid: 0 });

  if (loading) return <div className="p-8 text-center text-zinc-500 font-bold">Loading invoices...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition font-semibold text-sm">
          <FiArrowLeft /> Dashboard
        </button>
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
          Invoice
        </div>
      </div>

      <div className="card-shell p-8 bg-white dark:bg-dark-card border-l-4 border-l-emerald-500 shadow-sm">
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Paid</div>
        <div className="text-4xl font-black text-emerald-600 italic tracking-tight">₱{totals.paid.toLocaleString()}</div>
        <p className="text-[10px] text-zinc-400 mt-2 font-bold uppercase">Total amount for all provided services</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 italic uppercase tracking-tight">
            <span className="text-brand-500 mr-2">/</span> History
          </h2>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="input-field pl-10 pr-8 h-10 text-xs font-bold w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <select 
                className="input-field pl-10 h-10 text-xs font-bold appearance-none pr-8 w-40"
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
              >
                <option value="all">All Pets</option>
                {pets.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {filteredInvoices.length > 0 ? (
          <div className="space-y-3">
            {filteredInvoices.map(invoice => (
              <div key={invoice.id} className="card-shell card-shell-hover bg-white dark:bg-dark-card overflow-hidden transition-all group border-none shadow-sm">
                <div 
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer"
                  onClick={() => setExpandedInvoiceId(expandedInvoiceId === invoice.id ? null : invoice.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={clsx(
                      "w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors",
                      invoice.status === 'Paid' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-zinc-50 border-zinc-100 text-zinc-400"
                    )}>
                      <FiFileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">#{invoice.invoice_number}</span>
                        <span className={clsx(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                          invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                          invoice.status === 'Cancelled' ? 'bg-zinc-100 text-zinc-600' : 'bg-amber-100 text-amber-700'
                        )}>
                          {invoice.status}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mt-0.5">{invoice.pet?.name}</h3>
                      <div className="text-xs text-zinc-500 font-medium mt-1 uppercase tracking-tighter flex items-center gap-2">
                        <span>{new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                        <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> {new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-[10px] font-black text-zinc-400 uppercase mb-1">Paid</div>
                      <div className="text-xl font-black text-emerald-600 italic">₱{parseFloat(invoice.total).toLocaleString()}</div>
                    </div>
                    {expandedInvoiceId === invoice.id ? <FiChevronUp className="text-zinc-400 w-6 h-6" /> : <FiChevronDown className="text-zinc-400 w-6 h-6" />}
                  </div>
                </div>

                {expandedInvoiceId === invoice.id && (
                  <div className="px-6 pb-6 pt-2 border-t border-zinc-50 dark:border-dark-border animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-zinc-50 dark:bg-dark-surface/50 rounded-2xl p-6 space-y-4">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-dark-border pb-3">Invoice Details</div>
                      {invoice.items && invoice.items.filter((i: any) => !i.is_hidden).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div className="text-zinc-600 dark:text-zinc-400 font-medium">
                            {item.name} <span className="text-zinc-400 text-[10px] ml-2 font-black uppercase">x{item.qty}</span>
                          </div>
                          <div className="text-zinc-900 dark:text-zinc-100 font-bold">₱{parseFloat(item.amount).toLocaleString()}</div>
                        </div>
                      ))}
                      
                      <div className="pt-4 mt-4 border-t-2 border-dashed border-zinc-200 dark:border-dark-border space-y-4">
                        <div className="flex justify-between items-center">
                           <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest text-lg">Total Paid</div>
                           <div className="text-2xl font-black text-emerald-600">₱{parseFloat(invoice.total).toLocaleString()}</div>
                        </div>
                        <button 
                          onClick={() => handleDownload(invoice)}
                          className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                        >
                          <FiDownload /> Download PDF Invoice
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card-shell p-12 text-center text-zinc-400 bg-zinc-50/50 border-dashed">
            No invoices found.
          </div>
        )}
      </div>
    </div>
  );
}
