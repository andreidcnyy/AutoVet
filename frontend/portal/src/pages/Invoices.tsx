import { useState, useEffect, useRef, useCallback } from 'react';
import { getInvoices, getInvoice, getPets, getSettings } from '../api';
import {
  FiCreditCard,
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
  FiEye,
  FiX
} from 'react-icons/fi';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { generateInvoicePDF } from '../utils/invoicePdf';
import { useAuth } from '../context/AuthContext';
import echo from '../utils/echo';
import { readCache, writeCache } from '../utils/swrCache';
import { PawPrint } from './Landing';

// The invoice's meaningful date is the appointment (service) date, not when the
// invoice row was created. Fall back to created_at for invoices with no appointment.
const invoiceDate = (inv: any): Date => {
  const raw = inv?.service_date || inv?.appointment?.date || inv?.created_at;
  if (!raw) return new Date(0);
  const normalized = typeof raw === 'string' && raw.includes('-') && !raw.includes('T')
    ? raw.replace(/-/g, '/')
    : raw;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [clinicSettings, setClinicSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPetId, setSelectedPetId] = useState<string>("all");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const CACHE_KEY = `portal_invoices_${user?.id}_cache`;

  const fetchInvoices = useCallback(() => {
    return Promise.all([getInvoices(), getPets(), getSettings()])
      .then(([invRes, petsRes, settingsRes]) => {
        const invDataRaw = Array.isArray(invRes.data) ? invRes.data : (invRes.data?.data || []);
        const invData = [...invDataRaw].sort(
          (a: any, b: any) => invoiceDate(b).getTime() - invoiceDate(a).getTime()
        );
        const petsData = Array.isArray(petsRes.data) ? petsRes.data : (petsRes.data?.data || []);
        setInvoices(invData);
        setPets(petsData);
        setClinicSettings(settingsRes.data);
        writeCache(CACHE_KEY, { invoices: invData, pets: petsData, clinicSettings: settingsRes.data });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [CACHE_KEY]);

  useEffect(() => {
    const cached = readCache<any>(CACHE_KEY);
    if (cached) {
      setInvoices(Array.isArray(cached.invoices) ? cached.invoices : []);
      setPets(Array.isArray(cached.pets) ? cached.pets : []);
      setClinicSettings(cached.clinicSettings || null);
      setLoading(false);
    }
    fetchInvoices();

    // Re-fetch when tab regains focus
    const onVisible = () => { if (document.visibilityState === 'visible') fetchInvoices(); };
    document.addEventListener('visibilitychange', onVisible);


    const userId = user?.id;
    if (userId) {
      echo.private(`client.invoices.${userId}`)
        .listen('.invoice.updated', fetchInvoices);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (userId) echo.leave(`client.invoices.${userId}`);
    };
  }, [fetchInvoices, user?.id]);

  const buildInvoiceForPdf = async (invoice: any) => {
    // The list payload is minimal (no items/totals/notes). Fetch the full
    // invoice so the PDF matches the admin format exactly.
    let full = invoice;
    try {
      const res = await getInvoice(invoice.id);
      full = res.data || invoice;
    } catch (e) {
      console.error('Failed to load full invoice for PDF', e);
    }

    const ownerFromUser = {
      name: full.pet?.owner?.name || user?.name || 'Valued Client',
      email: full.pet?.owner?.email || user?.email || '',
      address: full.pet?.owner?.address || user?.address || 'No address provided',
      phone: full.pet?.owner?.phone || user?.phone || '',
    };

    // The pet already loaded for the filter dropdown carries the species,
    // breed and weight, so it fills any gap left by the invoice payload rather
    // than the PDF printing a placeholder patient.
    const listPet = pets.find((p) => String(p.id) === String(full.pet_id ?? invoice.pet_id));
    const basePet = full.pet || listPet;
    const mergedPet = basePet && {
      ...basePet,
      // Only the blanks are filled, so a field the invoice did answer wins.
      name: basePet.name || listPet?.name,
      species: basePet.species || listPet?.species,
      breed: basePet.breed || listPet?.breed,
      weight: basePet.weight ?? listPet?.weight,
      photo: basePet.photo || listPet?.photo,
    };

    return {
      ...full,
      pet: mergedPet ? { ...mergedPet, owner: ownerFromUser } : null,
    };
  };

  const handleDownload = async (invoice: any) => {
    generateInvoicePDF(await buildInvoiceForPdf(invoice), clinicSettings);
  };

  // Preview renders the same PDF in a window, so the client can just look at
  // it and only download if they want to keep a copy.
  const handlePreview = async (invoice: any) => {
    setPreviewLoadingId(invoice.id);
    try {
      const result = await generateInvoicePDF(await buildInvoiceForPdf(invoice), clinicSettings, 'preview');
      if (result) {
        setPreview({ url: URL.createObjectURL(result.blob), filename: result.filename });
      }
    } catch (e) {
      console.error('Failed to build invoice preview', e);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const filteredInvoices = invoices.filter(inv => {
    if (inv.status?.toLowerCase() === 'draft') return false;
    const matchesPet = selectedPetId === "all" || String(inv.pet_id) === selectedPetId;
    const invoiceNumber = inv.invoice_number?.toLowerCase() || "";
    const petName = inv.pet?.name?.toLowerCase() || "unknown";
    const q = searchQuery.toLowerCase();
    const matchesSearch = invoiceNumber.includes(q) || petName.includes(q);
    return matchesPet && matchesSearch;
  });

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

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-emerald-600 to-emerald-700 dark:from-emerald-500 dark:via-emerald-400 dark:to-teal-400 p-5 sm:p-8 text-white shadow-xl">
        <PawPrint className="absolute -top-4 -right-4 w-36 h-36 text-white opacity-30 rotate-12 pointer-events-none" />
        <PawPrint className="absolute bottom-2 right-16 w-16 h-16 text-white opacity-20 -rotate-20 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-white/70 text-xs font-black uppercase tracking-[0.2em] mb-1">Invoices</p>
          <h1 className="text-2xl font-black italic uppercase tracking-tight">Invoices 🐾</h1>
          <p className="text-white/80 mt-1 text-sm font-medium">All your invoice history in one place.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 italic uppercase tracking-tight">
            <span className="text-brand-500 mr-2">/</span> History
          </h2>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search..."
                className="input-field pl-10 pr-8 h-10 text-xs font-bold w-full sm:w-48"
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
                className="input-field pl-10 h-10 text-xs font-bold appearance-none pr-8 w-full sm:w-40"
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
                  className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 cursor-pointer"
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
                        <span>{invoiceDate(invoice).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                        <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> {new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8">
                    <div className="text-right">
                      <div className="text-[10px] font-black text-zinc-400 uppercase mb-1">Total</div>
                      <div className="text-xl font-black text-emerald-600 italic">₱{parseFloat(invoice.total).toLocaleString()}</div>
                    </div>
                    {expandedInvoiceId === invoice.id ? <FiChevronUp className="text-zinc-400 w-6 h-6" /> : <FiChevronDown className="text-zinc-400 w-6 h-6" />}
                  </div>
                </div>

                {expandedInvoiceId === invoice.id && (
                  <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-zinc-50 dark:border-dark-border animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-zinc-50 dark:bg-dark-surface/50 rounded-2xl p-4 sm:p-6 space-y-4">
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
                           <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest text-lg">Total</div>
                           <div className="text-2xl font-black text-emerald-600">₱{parseFloat(invoice.total).toLocaleString()}</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            onClick={() => handlePreview(invoice)}
                            disabled={previewLoadingId === invoice.id}
                            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-dark-card text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-dark-border py-3 rounded-xl font-bold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
                          >
                            <FiEye /> {previewLoadingId === invoice.id ? 'Opening...' : 'View Invoice'}
                          </button>
                          <button
                            onClick={() => handleDownload(invoice)}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                          >
                            <FiDownload /> Download PDF
                          </button>
                        </div>
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

      {preview && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePreview} />
          <div className="relative w-full max-w-4xl h-[90vh] flex flex-col bg-white dark:bg-dark-card rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100 dark:border-dark-border">
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{preview.filename}</div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={preview.url}
                  download={preview.filename}
                  className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity"
                >
                  <FiDownload /> Download
                </a>
                <button
                  onClick={closePreview}
                  aria-label="Close preview"
                  className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>
            <iframe src={preview.url} title="Invoice preview" className="flex-1 w-full bg-zinc-100" />
            {/* Phone browsers often cannot show a PDF inside a page. */}
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="sm:hidden text-center text-xs font-bold text-brand-600 py-3 border-t border-zinc-100 dark:border-dark-border"
            >
              Can't see the invoice? Open it in a new tab
            </a>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
