import { useMemo, useState } from "react";
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
  const [items, setItems] = useState(lineItems);
  const [taxRateVal, setTaxRateVal] = useState(taxRate);
  const [discountVal, setDiscountVal] = useState(discount);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);
  const discountAmount = useMemo(() => subtotal * (discountVal / 100), [subtotal, discountVal]);
  const taxable = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = useMemo(() => taxable * (taxRateVal / 100), [taxable, taxRateVal]);
  const totalDue = useMemo(() => taxable + taxAmount, [taxable, taxAmount]);

  const handleQuickAdd = (service) => {
    const newItem = {
      id: `li-${Date.now()}`,
      name: service.replace("+ ", ""),
      notes: "Quick Add Service",
      qty: 1,
      unitPrice: 50,
      amount: 50,
      indicator: "bg-blue-50 dark:bg-blue-900/200",
    };
    setItems((prev) => [...prev, newItem]);
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

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">Patient Details</h3>
              <div className="space-y-3">
                <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-slate-500 dark:text-zinc-400">
                  <FiSearch className="h-4 w-4" />
                  <input
                    type="text"
                    defaultValue="Rover (Owner: John Doe)"
                    className="w-full bg-transparent text-sm text-slate-700 dark:text-zinc-300 focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      defaultValue="Dr. Sarah Jenkins"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 pr-8 text-sm text-slate-700 dark:text-zinc-300"
                    />
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      defaultValue="10/24/2026"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 pr-8 text-sm text-slate-700 dark:text-zinc-300"
                    />
                    <FiCalendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  </div>
                </div>
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

              <div className="grid grid-cols-[1fr_74px] gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Add service or medication..."
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 pr-8 text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:text-zinc-500"
                  />
                  <FiPlusCircle className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                </div>
                <input
                  type="text"
                  defaultValue="1"
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-center text-sm text-slate-700 dark:text-zinc-300"
                />
              </div>

              <div className="mt-3 space-y-2">
                {items.map((item) => (
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
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Discount (%)</label>
                  <input
                    type="text"
                    value={discountVal}
                    onChange={(e) => setDiscountVal(Number(e.target.value) || 0)}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-sm text-slate-700 dark:text-zinc-300"
                  />
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
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Notes (Internal)</label>
                <textarea
                  rows={3}
                  placeholder="Add administrative notes here..."
                  className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 py-2.5 text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:text-zinc-500"
                />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 dark:border-dark-border p-4">
            <button
              onClick={() => setItems(lineItems)}
              className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-dark-card px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-zinc-300"
            >
              Reset
            </button>
            <button
              onClick={() => alert("Invoice draft saved.")}
              className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-semibold text-blue-700"
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
              <span>Auto-saved 2m ago</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => alert("Printing invoice...")}
                className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
              >
                <FiPrinter className="h-4 w-4" />
              </button>
              <button
                onClick={() => alert("Downloading PDF...")}
                className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
              >
                <FiDownload className="h-4 w-4" />
              </button>
              <button
                onClick={() => alert("Invoice scheduled for sending.")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <FiSend className="h-4 w-4" />
                Finalize &amp; Send
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
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

                <div className="mt-4 space-y-5">
                  {items.map((item) => (
                    <div key={`doc-${item.id}`} className="grid grid-cols-[1fr_80px_130px_120px] items-start gap-2">
                      <div>
                        <p className="text-2xl font-semibold text-slate-900 dark:text-zinc-50">{item.name}</p>
                        <p className="text-base text-slate-500 dark:text-zinc-400">{item.notes}</p>
                      </div>
                      <p className="text-right text-xl text-slate-700 dark:text-zinc-300">{item.qty}</p>
                      <p className="text-right text-xl text-slate-700 dark:text-zinc-300">{currency(item.unitPrice)}</p>
                      <p className="text-right text-2xl font-semibold text-slate-900 dark:text-zinc-50">{currency(item.amount)}</p>
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
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 dark:border-dark-border pt-3">
                  <span className="text-3xl font-bold text-slate-900 dark:text-zinc-50">Total Due</span>
                  <span className="text-5xl font-bold text-blue-600">{currency(totalDue)}</span>
                </div>
              </section>

              <footer className="mt-16 border-t border-slate-200 dark:border-dark-border pt-8">
                <p className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Notes to Client</p>
                <p className="mt-2 text-lg leading-8 text-slate-600 dark:text-zinc-300">
                  Thank you for trusting VetBot with Rover's care. Please continue monthly prevention as prescribed. Next
                  wellness exam is recommended in October 2027.
                </p>
                <p className="mt-10 text-center text-sm text-slate-400 dark:text-zinc-500">Powered by VetBot Systems</p>
              </footer>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

export default BillingInvoiceView;
