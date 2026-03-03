import { useMemo, useState, useEffect } from "react";
import {
  FiCalendar,
  FiChevronDown,
  FiDownload,
  FiEye,
  FiPlusCircle,
  FiPrinter,
  FiSearch,
  FiSend,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { useToast } from "../../context/ToastContext";

const quickAdds = ["+ Consultation", "+ Rabies Vax", "+ Nail Trim"];

const lineItems = [
  {
    id: "li-1",
    name: "General Consultation",
    notes: "Service • Dr. Jenkins",
    qty: 1,
    unitPrice: 60,
    amount: 60,
    indicator: "bg-blue-50 dark:bg-blue-900/200",
  },
  {
    id: "li-2",
    name: "Heartgard Plus (Blue)",
    notes: "Medication • 6 Pack",
    qty: 1,
    unitPrice: 45,
    amount: 45,
    indicator: "bg-emerald-500",
    warning: "Low Stock",
  },
];

const discount = 0;
const taxRate = 8;

const currency = (value) => `$${value.toFixed(2)}`;

function BillingInvoiceView() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [taxRateVal, setTaxRateVal] = useState(0);
  const [discountVal, setDiscountVal] = useState(0);
  const [discountType, setDiscountType] = useState("percentage");

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [clinicSettings, setClinicSettings] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Draft");

  useEffect(() => {
    // Fetch patients and settings on mount
    Promise.all([
      fetch("/api/patients").then(res => res.json()),
      fetch("/api/settings").then(res => res.json())
    ])
      .then(([patientsData, settingsData]) => {
        setPatients(patientsData);
        setClinicSettings(settingsData);
        setTaxRateVal(parseFloat(settingsData.tax_rate) || 0);
        setNotes(settingsData.invoice_notes_template || "");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load initial data.");
      });
  }, []);

  const handlePatientSelect = (e) => {
    const pId = e.target.value;
    setSelectedPatientId(pId);
    if (!pId) {
      setPatientDetails(null);
      return;
    }
    const patientData = patients.find(p => p.id.toString() === pId.toString());
    setPatientDetails(patientData);

    // Auto replace placeholders in the notes if clinic template is present
    if (clinicSettings && clinicSettings.invoice_notes_template) {
      let template = clinicSettings.invoice_notes_template;
      template = template.replace(/{clinic_name}/g, clinicSettings.clinic_name || "");
      template = template.replace(/{pet_name}/g, patientData.name || "");
      template = template.replace(/{owner_name}/g, patientData.owner_name || "");
      setNotes(template);
    }
  };

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  // Real-time discount calculations safely capping out at subtotal
  const discountAmount = useMemo(() => {
    let amt = 0;
    if (discountType === "percentage") {
      amt = subtotal * ((discountVal || 0) / 100);
    } else {
      amt = discountVal || 0;
    }
    return amt > subtotal ? subtotal : amt;
  }, [subtotal, discountVal, discountType]);

  const taxable = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = useMemo(() => taxable * ((taxRateVal || 0) / 100), [taxable, taxRateVal]);
  const totalDue = useMemo(() => taxable + taxAmount, [taxable, taxAmount]);

  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");

  const [serviceInput, setServiceInput] = useState("");
  const [qtyInput, setQtyInput] = useState(1);
  const [priceInput, setPriceInput] = useState(50);

  const handleQuickAdd = (service) => {
    const price = service.includes("Consultation") ? 60 : service.includes("Vax") ? 45 : 30;
    const newItem = {
      id: `li-${Date.now()}`,
      name: service.replace("+ ", ""),
      notes: "Quick Add Service",
      qty: 1,
      unitPrice: price,
      amount: price,
      indicator: "bg-blue-50 dark:bg-blue-900/200",
    };
    setItems((prev) => [...prev, newItem]);
  };

  const manuallyAddItem = () => {
    if (!serviceInput) return;
    const price = Number(priceInput) || 0;
    const qty = Number(qtyInput) || 1;
    const newItem = {
      id: `li-${Date.now()}`,
      name: serviceInput,
      notes: "Manual Entry",
      qty: qty,
      unitPrice: price,
      amount: price * qty,
      indicator: "bg-slate-200 dark:bg-zinc-700",
    };
    setItems((prev) => [...prev, newItem]);
    setServiceInput("");
    setQtyInput(1);
    setPriceInput(50);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const resetForm = () => {
    setItems([]);
    setDiscountVal(0);
    setTaxRateVal(clinicSettings ? parseFloat(clinicSettings.tax_rate) || 0 : 0);
    setNotes(clinicSettings ? clinicSettings.invoice_notes_template || "" : "");
    setSelectedPatientId("");
    setPatientDetails(null);
    setStatus("Draft");
    setAmountPaid(0);
    setPaymentMethod("");
  };

  const submitInvoice = async (finalStatus) => {
    if (items.length === 0) {
      toast.error("Cannot save an invoice without items.");
      return;
    }
    if (!selectedPatientId) {
      toast.error("Please select a patient.");
      return;
    }

    // Determine status logic based on amount paid vs total
    let actualStatus = finalStatus;
    if (finalStatus === "Finalized" && amountPaid > 0) {
      if (amountPaid >= totalDue) {
        actualStatus = "Paid";
      } else {
        actualStatus = "Partially Paid";
      }
    }

    const payload = {
      patient_id: selectedPatientId,
      status: actualStatus,
      subtotal: subtotal,
      discount_type: discountType,
      discount_value: discountVal,
      tax_rate: taxRateVal,
      total: totalDue,
      amount_paid: amountPaid,
      payment_method: paymentMethod,
      notes_to_client: notes,
      items: items.map(item => ({
        name: item.name,
        notes: item.notes,
        qty: item.qty,
        unit_price: item.unitPrice,
        amount: item.amount
      }))
    };

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save invoice");
      }

      toast.success(`Invoice ${finalStatus === "Draft" ? "saved as draft" : "finalized"} successfully.`);

      if (finalStatus !== "Draft") {
        setStatus(actualStatus);
      } else {
        resetForm();
      }
    } catch (err) {
      toast.error(err.message || "Failed to save invoice");
      console.error(err);
    }
  };

  return (
    <div className="card-shell overflow-hidden p-0">
      <div className="grid grid-cols-1 lg:h-[calc(100vh-11rem)] lg:grid-cols-[410px_1fr]">
        <aside className="flex h-full flex-col border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card lg:border-b-0 lg:border-r lg:border-slate-200 dark:border-dark-border">
          <div className="border-b border-slate-200 dark:border-dark-border p-5">
            <p className="text-sm text-slate-500 dark:text-zinc-400">Billing &gt; New Invoice</p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">New Invoice</h2>
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Draft
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 space-y-6 overflow-y-auto p-5">
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">Patient Details</h3>
              <div className="space-y-3">
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  <select
                    value={selectedPatientId}
                    onChange={handlePatientSelect}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-10 pr-8 text-sm text-slate-700 dark:text-zinc-300 focus:outline-none"
                    disabled={status === "Finalized"}
                  >
                    <option value="">Select a patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Owner: {p.owner_name})
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                </div>

                {patientDetails && (
                  <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-3 text-sm">
                    <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Owner:</strong> {patientDetails.owner_name}</p>
                    <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Email:</strong> {patientDetails.owner_email || "N/A"}</p>
                    <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Address:</strong> {patientDetails.owner_address || "N/A"}</p>
                    <p className="mt-2 text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Species/Breed:</strong> {patientDetails.species} {patientDetails.breed ? `• ${patientDetails.breed}` : ""}</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">Services &amp; Meds</h3>

              <div className="mb-3 flex flex-wrap gap-2">
                {quickAdds.map((pill) => (
                  <button
                    key={pill}
                    onClick={() => handleQuickAdd(pill)}
                    className="rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-sm font-medium text-blue-600"
                  >
                    {pill}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[1fr_54px_80px] gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Add service..."
                    value={serviceInput}
                    onChange={(e) => setServiceInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && manuallyAddItem()}
                    disabled={status === "Finalized"}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:text-zinc-500 disabled:opacity-50"
                  />
                </div>
                <input
                  type="number"
                  min="1"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  disabled={status === "Finalized"}
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-2 text-center text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    disabled={status === "Finalized"}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-6 pr-2 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {items.length > 0 ? items.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">
                          <span className={`inline-block h-2 w-2 rounded-full ${item.indicator}`} />
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{item.notes}</p>
                      </div>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-zinc-50">{currency(item.amount)}</p>
                    </div>

                    {item.warning ? (
                      <span className="mt-2 inline-block rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        {item.warning}
                      </span>
                    ) : null}
                  </article>
                )) : (
                  <p className="pt-4 text-center text-sm text-slate-400">No items added yet.</p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Discount (%)</label>
                  <div className="flex gap-2">
                    <select
                      value={discountType}
                      onChange={(e) => {
                        setDiscountType(e.target.value);
                        setDiscountVal(0);
                      }}
                      disabled={status === "Finalized"}
                      className="h-11 w-1/3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">$</option>
                    </select>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        value={discountVal}
                        onChange={(e) => setDiscountVal(Number(e.target.value) || 0)}
                        disabled={status === "Finalized"}
                        className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-3 pr-3 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Tax Rate (%)</label>
                  <input
                    type="text"
                    value={taxRateVal}
                    onChange={(e) => setTaxRateVal(Number(e.target.value) || 0)}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-sm text-slate-700 dark:text-zinc-300"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Note to Client</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={status === "Finalized"}
                  placeholder="Visible on the invoice..."
                  className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 py-2.5 text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:text-zinc-500 disabled:opacity-50"
                />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 dark:border-dark-border p-4">
            <button
              onClick={resetForm}
              disabled={status !== "Draft"}
              className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-dark-card px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-zinc-300 disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={() => submitInvoice("Draft")}
              disabled={status !== "Draft"}
              className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50"
            >
              Save Draft
            </button>
          </div>
        </aside>

        <section className="flex h-full flex-col bg-slate-100 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card px-5 py-3">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2 font-semibold text-slate-600 dark:text-zinc-300">
                <FiEye className="h-4 w-4" />
                Preview Mode
              </span>
              <span>Invoice Status: <b className="text-slate-700 dark:text-slate-300">{status}</b></span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toast.info("Printing invoice...")}
                className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
              >
                <FiPrinter className="h-4 w-4" />
              </button>
              <button
                onClick={() => toast.info("Downloading PDF...")}
                className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
              >
                <FiDownload className="h-4 w-4" />
              </button>
              <button
                onClick={() => submitInvoice("Finalized")}
                disabled={status !== "Draft"}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <FiSend className="h-4 w-4" />
                Finalize &amp; Send
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <article className="mx-auto max-w-4xl rounded-sm bg-white dark:bg-dark-card p-12 shadow-md">
              <header className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="inline-flex items-center gap-3 text-5xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <LuPawPrint className="h-6 w-6" />
                    </span>
                    VetBot Clinic
                  </p>
                  <p className="mt-3 text-lg leading-8 text-slate-500 dark:text-zinc-400">
                    1234 Veterinary Lane
                    <br />
                    San Francisco, CA 94103
                    <br />
                    (415) 555-0123 • help@vetbot.com
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-6xl font-light tracking-wide text-slate-300 dark:text-zinc-600">INVOICE</p>
                  <p className="mt-3 text-xl font-semibold text-slate-700 dark:text-zinc-300">#VB-2026-10-244</p>
                  <p className="mt-2 text-lg text-slate-500 dark:text-zinc-400">Date: Oct 24, 2026</p>
                  <p className="text-lg text-slate-500 dark:text-zinc-400">Due: Upon Receipt</p>
                </div>
              </header>

              <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Bill To</p>
                  <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-zinc-50">John Doe</p>
                  <p className="mt-1 text-xl leading-8 text-slate-600 dark:text-zinc-300">
                    88 Colin P Kelly Jr St
                    <br />
                    San Francisco, CA 94107
                    <br />
                    john.doe@example.com
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Patient</p>
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=120&q=80"
                      alt="Rover"
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Rover</p>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">Golden Retriever • 4 yrs</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-10 border-y border-slate-200 dark:border-dark-border py-4">
                <div className="grid grid-cols-[1fr_80px_130px_120px] text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <p>Description</p>
                  <p className="text-right">Qty</p>
                  <p className="text-right">Unit Price</p>
                  <p className="text-right">Amount</p>
                </div>

                <div className="mt-4 space-y-5 max-h-[400px] overflow-y-auto pr-3 print:max-h-none print:overflow-visible">
                  {items.map((item) => (
                    <div key={`doc-${item.id}`} className="grid grid-cols-[1fr_80px_130px_120px] items-start gap-2">
                      <div>
                        <p className="text-2xl font-semibold text-slate-900 dark:text-zinc-50">{item.name}</p>
                        <p className="text-base text-slate-500 dark:text-zinc-400">{item.notes}</p>
                      </div>
                      <p className="text-right text-xl text-slate-700 dark:text-zinc-300">{item.qty}</p>
                      <p className="text-right text-xl text-slate-700 dark:text-zinc-300">{currency(item.unitPrice)}</p>
                      <div className="flex items-center justify-end gap-3">
                        <p className="text-right text-2xl font-semibold text-slate-900 dark:text-zinc-50">{currency(item.amount)}</p>
                        {status === "Draft" && (
                          <button onClick={() => removeItem(item.id)} className="text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300">
                            <span className="text-xs font-bold leading-none">X</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8 ml-auto w-full max-w-sm space-y-2">
                <div className="flex items-center justify-between text-lg text-slate-600 dark:text-zinc-300">
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-lg text-slate-600 dark:text-zinc-300">
                  <span>Tax ({taxRateVal}%)</span>
                  <span>{currency(taxAmount)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-lg text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span>-{currency(discountAmount)}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 dark:border-dark-border pt-3">
                  <span className="text-3xl font-bold text-slate-900 dark:text-zinc-50">Total Due</span>
                  <span className="text-5xl font-bold text-blue-600">{currency(totalDue)}</span>
                </div>

                <div className="mt-6 border-t border-slate-200 dark:border-dark-border pt-4">
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">Record Payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={status !== "Draft"}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                    >
                      <option value="">Select Method...</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">$</span>
                      <input
                        type="number"
                        min="0"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(Number(e.target.value))}
                        disabled={status !== "Draft"}
                        placeholder="Amount Paid"
                        className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-7 pr-3 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <footer className="mt-16 border-t border-slate-200 dark:border-dark-border pt-8">
                <p className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Notes to Client</p>
                <p className="mt-2 text-lg leading-8 text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">
                  {notes || "No additional notes provided."}
                </p>
                <p className="mt-10 text-center text-sm text-slate-400 dark:text-zinc-500">Powered by AutoVet Systems</p>
              </footer>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

export default BillingInvoiceView;
