import { useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  FiArrowLeft,
  FiPhone,
  FiMail,
  FiMapPin,
  FiCalendar,
  FiFileText,
  FiDownload,
  FiUser,
  FiHeart,
  FiAlertCircle,
  FiClipboard,
} from "react-icons/fi";
import { LuStethoscope, LuPawPrint, LuPill } from "react-icons/lu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const tabs = [
  { key: "overview", label: "Overview", icon: LuPawPrint },
  { key: "appointments", label: "Appointments", icon: FiCalendar },
  { key: "billing", label: "Billing", icon: FiFileText },
];

const statusStyles = {
  Healthy:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Overdue:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Treatment:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

const invoiceStatusStyles = {
  Draft:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Finalized:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Partially Paid":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Cancelled:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

const toneLabels = {
  green: "General",
  blue: "Wellness",
  indigo: "Checkup",
  amber: "Warning",
  rose: "Emergency",
  slate: "Admin",
};

const toneDotStyles = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;
}

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years > 0) return `${years}y ${months}m`;
  return `${months}m`;
}

/* ───────────────────────────────────────── PDF Generation ── */
async function generatePatientPDF(patient) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 0, pageW, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("AutoVet Clinic", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Patient Medical Summary", 14, 24);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW - 14, 24, {
    align: "right",
  });

  let y = 44;
  doc.setTextColor(30, 41, 59); // slate-800

  // Patient name & ID
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(patient.name, 14, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Patient ID: #${patient.id}`, 14, y + 6);
  y += 16;

  // Demographics table
  doc.setTextColor(30, 41, 59);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
    head: [["Field", "Details"]],
    body: [
      ["Species", patient.species || "—"],
      ["Breed", patient.breed || "—"],
      ["Gender", patient.gender || "—"],
      ["Date of Birth", patient.date_of_birth ? `${formatDate(patient.date_of_birth)} (${calculateAge(patient.date_of_birth)})` : "—"],
      ["Color", patient.color || "—"],
      ["Weight", patient.weight ? `${patient.weight} kg` : "—"],
      ["Status", patient.status || "—"],
    ],
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Medical info
  if (patient.allergies || patient.medication || patient.notes) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Medical Information", 14, y);
    y += 6;

    const medBody = [];
    if (patient.allergies) medBody.push(["Allergies", patient.allergies]);
    if (patient.medication) medBody.push(["Medication", patient.medication]);
    if (patient.notes) medBody.push(["Notes", patient.notes]);

    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: { fillColor: [254, 242, 242], textColor: [153, 27, 27], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
      head: [["Field", "Details"]],
      body: medBody,
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // Owner info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Owner Information", 14, y);
  y += 6;

  const ownerBody = [
    ["Name", patient.owner_name || "—"],
    ["Phone", patient.owner_phone || "—"],
    ["Email", patient.owner_email || "—"],
    [
      "Address",
      [patient.owner_address, patient.owner_city, patient.owner_province, patient.owner_zip]
        .filter(Boolean)
        .join(", ") || "—",
    ],
  ];

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
    head: [["Field", "Details"]],
    body: ownerBody,
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("This document was automatically generated by AutoVet Clinic Management System.", 14, pageH - 10);

  doc.save(`${patient.name.replace(/\s+/g, "_")}_Summary.pdf`);
}

/* ───────────────────────────────────────── Component ── */

function ViewPatientProfile({ patient }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  if (!patient) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 dark:text-zinc-400">
        Loading patient profile...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/patients")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200 dark:hover:border-zinc-500"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              {patient.name}
            </h2>
            <p className="mt-1 text-base text-slate-500 dark:text-zinc-400">
              {patient.species} • {patient.breed} • ID #{patient.id}
            </p>
          </div>
        </div>
        <span
          className={clsx(
            "inline-flex rounded-full border px-4 py-1.5 text-sm font-semibold",
            statusStyles[patient.status] ||
              "border-slate-200 bg-slate-50 text-slate-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300"
          )}
        >
          {patient.status || "Unknown"}
        </span>
      </div>

      {/* Tabs */}
      <div className="card-shell overflow-hidden">
        <nav className="flex border-b border-slate-200 bg-slate-50/50 dark:border-dark-border dark:bg-dark-surface/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  "inline-flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-semibold transition",
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-6">
          {activeTab === "overview" && <OverviewTab patient={patient} />}
          {activeTab === "appointments" && <AppointmentsTab appointments={patient.appointments || []} />}
          {activeTab === "billing" && <BillingTab invoices={patient.invoices || []} />}
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Overview Tab ──────────────── */

function OverviewTab({ patient }) {
  return (
    <div className="space-y-6">
      {/* Top grid: Photo + Quick stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <img
          src={patient.photo || "https://via.placeholder.com/160?text=🐾"}
          alt={patient.name}
          className="h-40 w-40 rounded-2xl border-2 border-slate-100 object-cover shadow-sm dark:border-dark-border"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Species", value: patient.species },
            { label: "Breed", value: patient.breed || "—" },
            { label: "Gender", value: patient.gender || "—" },
            { label: "Age", value: calculateAge(patient.date_of_birth) || "—" },
            { label: "Color", value: patient.color || "—" },
            { label: "Weight", value: patient.weight ? `${patient.weight} kg` : "—" },
            { label: "Date of Birth", value: formatDate(patient.date_of_birth) },
            { label: "Status", value: patient.status || "—" },
            { label: "Last Visit", value: patient.last_visit },
            { label: "Next Due", value: patient.next_due },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-dark-border dark:bg-dark-surface"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-zinc-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Medical info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard icon={FiAlertCircle} iconColor="text-rose-500" title="Allergies" value={patient.allergies} />
        <InfoCard icon={LuPill} iconColor="text-blue-500" title="Medication" value={patient.medication} />
        <InfoCard icon={FiClipboard} iconColor="text-amber-500" title="Notes" value={patient.notes} />
      </div>

      {/* Owner details */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-dark-border dark:bg-dark-surface">
        <h4 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">
          <FiUser className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
          Owner Information
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xl font-bold text-slate-900 dark:text-zinc-50">
              {patient.owner_name}
            </p>
            {patient.owner_phone && (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                <FiPhone className="h-4 w-4 text-slate-400" />
                {patient.owner_phone}
              </p>
            )}
            {patient.owner_email && (
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                <FiMail className="h-4 w-4 text-slate-400" />
                {patient.owner_email}
              </p>
            )}
          </div>
          {patient.owner_address && (
            <div className="flex items-start gap-2">
              <FiMapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              <div className="text-sm text-slate-600 dark:text-zinc-300">
                <p>{patient.owner_address}</p>
                <p>
                  {patient.owner_city}
                  {patient.owner_province ? `, ${patient.owner_province}` : ""}{" "}
                  {patient.owner_zip}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Download PDF */}
      <div className="flex gap-3">
        <button
          onClick={() => generatePatientPDF(patient)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <FiDownload className="h-4 w-4" />
          Download Summary (PDF)
        </button>
        <button
          onClick={() => navigate(`/appointments?patientId=${patient.id}`)}
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition"
        >
          <FiCalendar className="h-4 w-4" />
          Book Appointment
        </button>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, iconColor, title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-dark-card">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={clsx("h-4 w-4", iconColor)} />
        <h5 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{title}</h5>
      </div>
      <p className="text-sm text-slate-600 dark:text-zinc-300">
        {value || <span className="italic text-slate-400 dark:text-zinc-500">None recorded</span>}
      </p>
    </div>
  );
}

/* ──────────────── Appointments Tab ──────────────── */

function AppointmentsTab({ appointments }) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FiCalendar className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
        <p className="mt-3 text-lg font-medium text-slate-500 dark:text-zinc-400">No Appointments</p>
        <p className="text-sm text-slate-400 dark:text-zinc-500">
          Appointments linked to this patient will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Category</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((apt) => (
            <tr
              key={apt.id}
              className="border-b border-slate-200/80 transition hover:bg-slate-50 dark:border-dark-border dark:hover:bg-dark-surface/60"
            >
              <td className="px-4 py-3 text-sm text-slate-800 dark:text-zinc-200">
                {formatDate(apt.date)}
              </td>
              <td className="px-4 py-3 text-sm text-slate-800 dark:text-zinc-200">
                {apt.time || "—"}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-zinc-100">
                {apt.title}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300">
                  <span className={clsx("h-2 w-2 rounded-full", toneDotStyles[apt.tone] || "bg-slate-400")} />
                  {toneLabels[apt.tone] || apt.tone || "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────── Billing Tab ──────────────── */

function BillingTab({ invoices }) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FiFileText className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
        <p className="mt-3 text-lg font-medium text-slate-500 dark:text-zinc-400">No Invoices</p>
        <p className="text-sm text-slate-400 dark:text-zinc-500">
          Invoices linked to this patient will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            <th className="px-4 py-3">Invoice #</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Paid</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-slate-200/80 transition hover:bg-slate-50 dark:border-dark-border dark:hover:bg-dark-surface/60"
            >
              <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-zinc-100">
                {inv.invoice_number || `INV-${inv.id}`}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">
                {formatDate(inv.created_at)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={clsx(
                    "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                    invoiceStatusStyles[inv.status] ||
                      "border-slate-200 bg-slate-50 text-slate-600"
                  )}
                >
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-zinc-100">
                {formatCurrency(inv.total)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-zinc-300">
                {formatCurrency(inv.amount_paid)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ViewPatientProfile;
