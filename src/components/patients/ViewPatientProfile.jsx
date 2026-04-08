import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
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
  FiBell,
} from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useFormErrors } from "../../hooks/useFormErrors";
import { LuStethoscope, LuPawPrint, LuPill } from "react-icons/lu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import OwnerProfileModal from "./OwnerProfileModal";
import { useAuth } from "../../context/AuthContext";
import { ROLES, VET_AND_ADMIN } from "../../constants/roles";
import ManualSendModal from "../notifications/ManualSendModal";

const tabs = [
  { key: "overview", label: "Overview", icon: LuPawPrint },
  { key: "medical", label: "Medical Records", icon: LuStethoscope },
  { key: "appointments", label: "Appointments", icon: FiCalendar },
  { key: "invoices", label: "Invoices", icon: FiFileText },
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
      ["Species", patient.species?.name || "—"],
      ["Breed", patient.breed?.name || "—"],
      ["Sex", patient.sex || "—"],
      ["Age Group", patient.age_group || "—"],
      ["Date of Birth", patient.date_of_birth ? `${formatDate(patient.date_of_birth)} (${calculateAge(patient.date_of_birth)})` : "—"],
      ["Color", patient.color || "—"],
      ["Weight", patient.weight ? `${patient.weight} ${patient.weight_unit}` : "—"],
      ["Size Category", patient.size_category?.name || patient.size_category_id || "—"],
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
    ["Name", patient.owner?.name || "—"],
    ["Phone", patient.owner?.phone || "—"],
    ["Email", patient.owner?.email || "—"],
    [
      "Address",
      [patient.owner?.address, patient.owner?.city, patient.owner?.province, patient.owner?.zip]
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

async function generateMedicalRecordPDF(record, patient) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("AutoVet: Medical Record", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Record ID: #${record.id}`, 14, 24);
  doc.text(`Date: ${formatDate(record.created_at)}`, pageW - 14, 24, { align: "right" });

  let y = 44;
  doc.setTextColor(30, 41, 59);

  // Patient Info Block
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Information", 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    theme: "plain",
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 30 } },
    body: [
      ["Name", patient.name],
      ["Species", patient.species?.name || "—"],
      ["Breed", patient.breed?.name || "—"],
      ["Sex/Age", `${patient.sex || "—"} / ${calculateAge(patient.date_of_birth) || "—"}`],
    ],
    margin: { left: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Clinical Details
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Examination", 14, y);
  y += 8;

  const clinicalData = [
    ["Chief Complaint", record.chief_complaint || "—"],
    ["Clinical Findings", record.findings || "—"],
    ["Diagnosis", record.diagnosis || "—"],
    ["Treatment Plan", record.treatment_plan || "—"],
  ];

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontStyle: "bold" },
    bodyStyles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40, fillColor: [248, 250, 252] } },
    head: [["Category", "Details"]],
    body: clinicalData,
  });

  y = doc.lastAutoTable.finalY + 10;

  if (record.notes || record.follow_up_date) {
    const extra = [];
    if (record.notes) extra.push(["Private Notes", record.notes]);
    if (record.follow_up_date) extra.push(["Follow-up Date", formatDate(record.follow_up_date)]);

    autoTable(doc, {
      startY: y,
      theme: "grid",
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
      body: extra,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (record.vet) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(`Attending Veterinarian: Dr. ${record.vet.name}`, 14, y);
  }

  doc.save(`Medical_Record_${patient.name}_${record.id}.pdf`);
}

async function generateAllMedicalRecordsPDF(records, patient) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Medical History Report", 14, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Patient: ${patient.name} (#${patient.id})`, 14, 28);
  doc.text(`Total Records: ${records.length}`, 14, 34);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW - 14, 34, { align: "right" });

  let y = 45;

  records.forEach((record, index) => {
    if (index > 0 && y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageW - 28, 8, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text(`RECORD #${record.id} - ${formatDate(record.created_at)}`, 18, y + 5.5);
    doc.setTextColor(30, 41, 59);

    y += 12;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 30 } },
      body: [
        ["Complaint", record.chief_complaint || "—"],
        ["Diagnosis", record.diagnosis || "—"],
        ["Treatment", record.treatment_plan || "—"]
      ],
    });

    y = doc.lastAutoTable.finalY + 10;
  });

  doc.save(`Medical_History_${patient.name}.pdf`);
}


/* ───────────────────────────────────────── Component ── */

function ViewPatientProfile({ patient }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const { user } = useAuth();
  const isStaff = user?.role === ROLES.STAFF;
  const isVet = VET_AND_ADMIN.includes(user?.role);

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
              {patient.species?.name || "N/A"} • {patient.breed?.name || "N/A"} • {patient.sex || "N/A"} • ID #{patient.id}
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
          {activeTab === "overview" && <OverviewTab patient={patient} onOpenOwner={() => setSelectedOwnerId(patient.owner?.id)} />}
          {activeTab === "medical" && <MedicalRecordsTab patient={patient} isStaff={isStaff} isVet={isVet} />}
          {activeTab === "appointments" && <AppointmentsTab appointments={patient.appointments || []} />}
          {activeTab === "invoices" && <InvoiceTab invoices={patient.invoices || []} />}
        </div>
      </div>

      <OwnerProfileModal 
        ownerId={selectedOwnerId} 
        isOpen={!!selectedOwnerId} 
        onClose={() => setSelectedOwnerId(null)} 
      />
    </div>
  );
}

/* ──────────────── Overview Tab ──────────────── */

function OverviewTab({ patient, onOpenOwner }) {
  return (
    <div className="space-y-6">
      {/* Top grid: Photo + Quick stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <img
          src={patient.photo ? getActualPetImageUrl(patient.photo) : getPetImageUrl(patient.species?.name, patient.breed?.name)}
          alt={patient.name}
          className="h-40 w-40 rounded-2xl border-2 border-slate-100 object-cover shadow-sm dark:border-dark-border bg-slate-100"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Species", value: patient.species?.name || "N/A" },
            { label: "Breed", value: patient.breed?.name || "N/A" },
            { label: "Sex", value: patient.sex || "N/A" },
            { label: "Age Group", value: patient.age_group || "N/A" },
            { label: "Age", value: calculateAge(patient.date_of_birth) || "N/A" },
            { label: "Color", value: patient.color || "N/A" },
            { label: "Weight", value: patient.weight ? `${patient.weight} ${patient.weight_unit}` : "N/A" },
            { label: "Size", value: patient.size_category?.name || "N/A" },
            { label: "Date of Birth", value: formatDate(patient.date_of_birth) },
            { label: "Status", value: patient.status || "N/A" },
            { label: "Last Visit", value: patient.last_visit || "N/A" },
            { label: "Next Due", value: patient.next_due || "N/A" },
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
            <div className="flex items-center gap-3">
              <p className="text-xl font-bold text-slate-900 dark:text-zinc-50">
                {patient.owner?.name}
              </p>
              {patient.owner?.id && (
                <button
                  onClick={onOpenOwner}
                  className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                >
                  View Profile
                </button>
              )}
            </div>
            {patient.owner?.phone && (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                <FiPhone className="h-4 w-4 text-slate-400" />
                {patient.owner.phone}
              </p>
            )}
            {patient.owner?.email && (
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                <FiMail className="h-4 w-4 text-slate-400" />
                {patient.owner.email}
              </p>
            )}
          </div>
          {patient.owner?.address && (
            <div className="flex items-start gap-2">
              <FiMapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              <div className="text-sm text-slate-600 dark:text-zinc-300">
                <p>{patient.owner.address}</p>
                <p>
                  {patient.owner.city}
                  {patient.owner.province ? `, ${patient.owner.province}` : ""}{" "}
                  {patient.owner.zip}
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

/* ──────────────── Invoices Tab ──────────────── */

function InvoiceTab({ invoices }) {
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

/* ──────────────── Medical Records Tab ──────────────── */

function MedicalRecordsTab({ patient, isStaff, isVet }) {
  const toast = useToast();
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendingRecord, setSendingRecord] = useState(null);

  const fetchRecords = () => {
    if (!user?.token) return;
    fetch(`/api/medical-records?pet_id=${patient.id}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch medical records");
        return res.json();
      })
      .then(data => setRecords(data))
      .catch(err => {
        console.error("Error fetching medical records:", err);
        toast.error("Failed to load medical history.");
      });
  };

  const fetchAppointments = () => {
    if (!user?.token) return;
    fetch(`/api/appointments?pet_id=${patient.id}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch appointments");
        return res.json();
      })
      .then(data => {
        setAppointments(data.slice(0, 10));
      })
      .catch(err => {
        console.error("Error fetching appointments:", err);
      });
  };

  useEffect(() => {
    fetchRecords();
    fetchAppointments();
  }, [patient.id]);

  const onSave = (record, setErrors) => {
    if (!record.appointment_id) {
      toast.error("Please select an appointment for this medical record.");
      return;
    }
    const isEdit = !!editingRecord;
    const method = isEdit ? "PUT" : "POST";
    const url = isEdit ? `/api/medical-records/${editingRecord.id}` : "/api/medical-records";
    
    fetch(url, {
      method,
      headers: { 
        "Content-Type": "application/json", 
        "Accept": "application/json",
        "Authorization": `Bearer ${user?.token}`
      },
      body: JSON.stringify({ ...record, pet_id: patient.id })
    })
    .then(async (res) => {
      if (!res.ok) {
        const error = await res.json();
        if (res.status === 422 && setErrors) {
          setErrors(error);
          toast.error("Validation error. Please check the fields.");
        } else {
          throw new Error(error.message || "Failed to save medical record");
        }
        return;
      }
      toast.success(`Medical record ${isEdit ? 'updated' : 'added'} successfully`);
      setIsModalOpen(false);
      fetchRecords();
    })
    .catch(err => toast.error(err.message));
  };

  const deleteRecord = (id) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    fetch(`/api/medical-records/${id}`, { 
      method: "DELETE",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user?.token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to delete");
        toast.success("Record deleted");
        fetchRecords();
      })
      .catch(err => toast.error(err.message));
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-100">Patient History</h3>
           {records.length > 0 && (
             <button
               onClick={() => generateAllMedicalRecordsPDF(records, patient)}
               className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400"
               title="Download full history as PDF"
             >
               <FiDownload className="h-3.5 w-3.5" />
               Download All
             </button>
           )}
         </div>
         {isVet && (
           <button 
             onClick={() => { setEditingRecord(null); setSelectedAppointmentId(""); setIsModalOpen(true); }}
             className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
           >
             Add Record
           </button>
         )}
      </div>

      <div className="space-y-4">
        {records.length === 0 ? (
          <div className="text-center py-10 text-slate-500">No medical records found.</div>
        ) : records.map(record => (
          <div key={record.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-dark-border dark:bg-dark-card shadow-sm">
             <div className="flex items-start justify-between">
               <div>
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatDate(record.created_at)}</p>
                  {record.vet && <p className="text-xs text-slate-500 dark:text-zinc-400">Attending Vet: Dr. {record.vet.name}</p>}
               </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => generateMedicalRecordPDF(record, patient)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                    title="Export to PDF"
                  >
                    <FiDownload className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSendingRecord(record);
                      setIsSendModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                    title="Notify Client"
                  >
                    <FiBell className="h-4 w-4" />
                  </button>
                  {isVet && (
                    <>
                      <button onClick={() => { setEditingRecord(record); setSelectedAppointmentId(record.appointment_id || ""); setIsModalOpen(true); }} className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">Edit</button>
                      <button onClick={() => deleteRecord(record.id)} className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                    </>
                  )}
                </div>
             </div>
             <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700 dark:text-zinc-300">
               <div><strong className="text-slate-900 dark:text-zinc-100">Chief Complaint:</strong> {record.chief_complaint || "—"}</div>
               <div><strong className="text-slate-900 dark:text-zinc-100">Findings:</strong> {record.findings || "—"}</div>
               <div className="md:col-span-2"><strong className="text-slate-900 dark:text-zinc-100">Diagnosis:</strong> {record.diagnosis || "—"}</div>
               <div className="md:col-span-2"><strong className="text-slate-900 dark:text-zinc-100">Treatment Plan:</strong> {record.treatment_plan || "—"}</div>
               {record.notes && <div className="md:col-span-2"><strong className="text-slate-900 dark:text-zinc-100">Notes:</strong> {record.notes}</div>}
               {record.follow_up_date && <div><strong className="text-slate-900 dark:text-zinc-100">Follow-up Date:</strong> {formatDate(record.follow_up_date)}</div>}
             </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <MedicalRecordModal 
          record={editingRecord} 
          onClose={() => setIsModalOpen(false)} 
          onSave={onSave} 
          isStaff={isStaff}
          isVet={isVet}
          appointments={appointments}
          selectedAppointmentId={selectedAppointmentId}
          setSelectedAppointmentId={setSelectedAppointmentId}
        />
      )}

      <ManualSendModal 
        isOpen={isSendModalOpen} 
        onClose={() => setIsSendModalOpen(false)} 
        owner={patient?.owner}
        relatedObject={sendingRecord}
        relatedType="App\Models\MedicalRecord"
      />
    </div>
  );
}

function MedicalRecordModal({ 
  record, 
  onClose, 
  onSave, 
  isStaff, 
  isVet, 
  appointments, 
  selectedAppointmentId, 
  setSelectedAppointmentId 
}) {
  const isEdit = !!record;
  const { setLaravelErrors, clearErrors, getError } = useFormErrors();

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    // Attach appointment ID from state
    data.appointment_id = selectedAppointmentId;
    
    // Clear previous errors
    clearErrors();

    // We need to handle the fetch here or pass setLaravelErrors up.
    // For simplicity, let's keep the onSave as is but wrap it if it fails with 422.
    // Actually, it's better if onSave returns the response or throws.
    onSave(data, setLaravelErrors);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-dark-card border dark:border-dark-border">
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-dark-border shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{isEdit ? "Edit Record" : "Add Medical Record"}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-surface">✕</button>
        </div>
        <div className="overflow-y-auto p-6">
          <form id="med-record-form" onSubmit={handleSubmit} className="space-y-4">
             {/* Appointment Selector */}
             <div>
               <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Link to Appointment (Required)</label>
               <select 
                 value={selectedAppointmentId}
                 onChange={(e) => setSelectedAppointmentId(e.target.value)}
                 className={clsx(
                   "w-full rounded-xl border px-3 py-2.5 text-sm dark:bg-dark-surface focus:outline-none focus:border-blue-400 dark:text-zinc-200",
                   getError("appointment_id") ? "border-rose-500 bg-rose-50/10" : "border-slate-200 dark:border-dark-border"
                 )}
               >
                 <option value="">Select an appointment...</option>
                 {appointments.map(apt => (
                   <option key={apt.id} value={apt.id}>
                     {formatDate(apt.date)} - {apt.title}
                   </option>
                 ))}
               </select>
               {getError("appointment_id") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("appointment_id")}</p>}
             </div>

             <div>
               <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Chief Complaint</label>
               <input 
                 name="chief_complaint" 
                 defaultValue={record?.chief_complaint || ""} 
                 className={clsx(
                   "w-full rounded-xl border px-3 py-2.5 text-sm dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-blue-400",
                   getError("chief_complaint") ? "border-rose-500 bg-rose-50/10" : "border-slate-200 dark:border-dark-border"
                 )} 
               />
               {getError("chief_complaint") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("chief_complaint")}</p>}
             </div>
             <div>
               <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Findings</label>
               <textarea name="findings" rows={2} defaultValue={record?.findings || ""} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-blue-400"></textarea>
             </div>
             <div>
               <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Diagnosis (Vets Only)</label>
               <textarea 
                 name="diagnosis" 
                 rows={2} 
                 readOnly={!isVet}
                 defaultValue={record?.diagnosis || ""} 
                 className={clsx(
                   "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200",
                   !isVet ? "bg-slate-50 cursor-not-allowed italic" : "bg-white"
                 )}
               ></textarea>
             </div>
             <div>
               <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Treatment Plan</label>
               <textarea 
                 name="treatment_plan" 
                 rows={2} 
                 readOnly={!isVet}
                 defaultValue={record?.treatment_plan || ""} 
                 className={clsx(
                   "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200",
                   !isVet ? "bg-slate-50 cursor-not-allowed italic" : "bg-white"
                 )}
               ></textarea>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Follow-up Date</label>
                 <input type="date" name="follow_up_date" defaultValue={record?.follow_up_date?.split('T')[0] || ""} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-blue-400" />
               </div>
             </div>
             <div>
               <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Private Notes</label>
               <textarea name="notes" rows={2} defaultValue={record?.notes || ""} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-blue-400"></textarea>
             </div>
          </form>
        </div>
        <div className="border-t bg-slate-50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200">Cancel</button>
          {isVet && (
            <button type="submit" form="med-record-form" className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save Record</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ViewPatientProfile;
