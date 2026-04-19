import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import {
  FiArrowLeft,
  FiPhone,
  FiMail,
  FiMapPin,
  FiCalendar,
  FiChevronDown,
  FiFileText,
  FiDownload,
  FiUser,
  FiHeart,
  FiAlertCircle,
  FiClipboard,
  FiBell,
  FiClock,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useFormErrors } from "../../hooks/useFormErrors";
import { LuStethoscope, LuPawPrint, LuPill } from "react-icons/lu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import OwnerProfileModal from "./OwnerProfileModal";
import { useAuth } from "../../context/AuthContext";
import { ROLES, VET_AND_ADMIN } from "../../constants/roles";
import api from "../../api";
import ManualSendModal from "../notifications/ManualSendModal";
import EditPatientModal from "./EditPatientModal";
import { FiEdit3, FiTrash2, FiEye } from "react-icons/fi";

const tabs = [
  { key: "overview", label: "Overview", icon: LuPawPrint },
  { key: "medical", label: "Medical Records", icon: LuStethoscope },
  { key: "appointments", label: "Appointments", icon: FiCalendar },
  { key: "invoices", label: "Invoices", icon: FiFileText },
];

const statusStyles = {
  Overdue:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Treatment:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

const invoiceStatusStyles = {
  Draft:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Finalized:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
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
  zinc: "Admin",
};

const toneDotStyles = {
  green: "bg-green-500",
  blue: "bg-emerald-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  zinc: "bg-zinc-400",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  // Fix for YYYY-MM-DD timezone shift: use slashes instead of dashes to force local time parsing
  const normalizedDate = typeof dateStr === 'string' && dateStr.includes('-') ? dateStr.replace(/-/g, '/') : dateStr;
  const d = new Date(normalizedDate);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
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

function formatAgeGroup(group) {
  if (!group) return "—";
  if (group === "Puppy/Kitten") return "Baby";
  if (group === "Junior") return "Young";
  return group;
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
  doc.setFillColor(37, 99, 235); // emerald-600
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
  doc.setTextColor(30, 41, 59); // zinc-800

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
      ["Breed", patient.breed?.name || "—"],
      ["Sex", patient.sex || "—"],
      ["Age Group", formatAgeGroup(patient.age_group)],
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
  doc.text("This document was automatically generated by Pet Wellness Animal Clinic Management System.", 14, pageH - 10);

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
    const vetDisplayName = record.vet.role === 'veterinarian' ? `Dr. ${record.vet.name}` : record.vet.name;
    doc.text(`Attending Veterinarian: ${vetDisplayName}`, 14, y);
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
        ["Vet", record.vet ? (record.vet.role === 'veterinarian' ? `Dr. ${record.vet.name}` : record.vet.name) : "—"],
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

function ViewPatientProfile({ patient, onRefresh, isModal = false }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [weightRanges, setWeightRanges] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    api.get("/api/weight-ranges")
      .then(data => {
        const ranges = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        setWeightRanges(ranges);
      })
      .catch(err => console.error("Failed to fetch weight ranges:", err));
  }, []);

  const determinedSizeName = useMemo(() => {
    if (!patient) return "N/A";
    if (patient.size_category?.name) return patient.size_category.name;
    if (!patient.weight || !patient.species_id || weightRanges.length === 0) return "N/A";
    
    const weight = Number(patient.weight);
    const range = weightRanges.find(r => 
      Number(r.species_id) === Number(patient.species_id) &&
      weight >= Number(r.min_weight) &&
      (r.max_weight === null || weight <= Number(r.max_weight))
    );
    
    return range?.label || range?.size_category?.name || "N/A";
  }, [patient, weightRanges]);

  const isStaff = user?.role === ROLES.STAFF;
  const isVet = VET_AND_ADMIN.includes(user?.role);

  const handleArchive = async () => {
    if (!user?.token) return;
    setIsArchiving(true);
    try {
      const res = await fetch(`/api/pets/${patient.id}`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to archive patient.");
      }

      toast.success("Patient record archived successfully.");
      if (isModal) {
        if (onRefresh) onRefresh();
      } else {
        navigate("/patients");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsArchiving(false);
      setIsArchiveModalOpen(false);
    }
  };

  if (!patient) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500 dark:text-zinc-400">
        Loading patient profile...
      </div>
    );
  }

  return (
    <div className={clsx("space-y-5", isModal && "p-6")}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {!isModal && (
            <button
              onClick={() => navigate("/patients")}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:border-zinc-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200 dark:hover:border-zinc-500"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <div>
            <h2 className={clsx("font-bold tracking-tight text-zinc-900 dark:text-zinc-50", isModal ? "text-3xl" : "text-4xl")}>
              {patient.name}
            </h2>
            <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">
              {patient.breed?.name || "N/A"} • {patient.sex || "N/A"} • ID #{patient.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(isVet || isStaff) && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-600 shadow-sm hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition"
            >
              <FiEdit3 className="h-4 w-4" />
              Edit Profile
            </button>
          )}
          {isVet && (
            <button
              onClick={() => setIsArchiveModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30 transition"
            >
              <FiTrash2 className="h-4 w-4" />
              Archive
            </button>
          )}
          <span
            className={clsx(
              "inline-flex rounded-full border px-4 py-1.5 text-sm font-semibold",
              statusStyles[patient.status] ||
                "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300"
            )}
          >
            {patient.status || "Unknown"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="card-shell overflow-hidden">
        <nav className="flex border-b border-zinc-200 bg-zinc-50/50 dark:border-dark-border dark:bg-dark-surface/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  "inline-flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-semibold transition",
                  activeTab === tab.key
                    ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-6">
          {activeTab === "overview" && <OverviewTab patient={patient} determinedSizeName={determinedSizeName} onOpenOwner={() => setSelectedOwnerId(patient.owner?.id)} />}
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

      <EditPatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        patient={patient}
        onSaveSuccess={() => {
          toast.success("Patient profile updated successfully.");
          onRefresh?.();
        }}
      />

      {/* Archive Confirmation Modal */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-dark-card border dark:border-dark-border">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
              <FiTrash2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Archive Patient Record</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to archive this patient? This action will hide the patient from active records 
              but will preserve medical history, appointments, invoices, and related data for audit and recovery purposes.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsArchiveModalOpen(false)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-dark-border dark:bg-zinc-800 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={isArchiving}
                onClick={handleArchive}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                {isArchiving ? "Archiving..." : "Archive Patient"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────── Overview Tab ──────────────── */

function OverviewTab({ patient, determinedSizeName, onOpenOwner }) {
  const owner = patient.owner;
  const hasOwner = owner && typeof owner === 'object' && owner.id;

  return (
    <div className="space-y-6">
      {/* 0. Owner Quick Info - Absolute Top */}
      <div className="rounded-2xl bg-emerald-600 p-6 text-white shadow-lg shadow-emerald-600/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-2xl shadow-inner">
               👤
             </div>
             <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 opacity-80">Registered Owner / Client</p>
               <h3 className="text-2xl font-black truncate max-w-[300px]" title={hasOwner ? owner.name : "Unassigned"}>
                 {hasOwner ? owner.name : "No Owner Assigned"}
               </h3>
               {hasOwner && (
                 <div className="mt-1 flex items-center gap-3 text-xs font-bold text-emerald-50">
                    {owner.phone && <span className="flex items-center gap-1"><FiPhone className="h-3 w-3" /> {owner.phone}</span>}
                    {owner.email && <span className="flex items-center gap-1"><FiMail className="h-3 w-3" /> {owner.email}</span>}
                 </div>
               )}
             </div>
          </div>
          {hasOwner && (
            <button
              onClick={() => onOpenOwner(owner.id)}
              className="rounded-xl bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-600 shadow-sm transition-all hover:bg-emerald-50 active:scale-95"
            >
              View Client Profile
            </button>
          )}
        </div>
      </div>

      {/* Top grid: Photo + Quick stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <img
          src={patient.photo ? getActualPetImageUrl(patient.photo) : getPetImageUrl(patient.species?.name, patient.breed?.name)}
          alt={patient.name}
          className="h-40 w-40 rounded-2xl border-2 border-zinc-100 object-cover shadow-sm dark:border-dark-border bg-zinc-100"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Breed", value: patient.breed?.name || "N/A" },
            { label: "Sex", value: patient.sex || "N/A" },
            { label: "Age Group", value: formatAgeGroup(patient.age_group) },
            { label: "Age", value: calculateAge(patient.date_of_birth) || "N/A" },
            { label: "Color", value: patient.color || "N/A" },
            { label: "Weight", value: patient.weight ? `${Number(patient.weight).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${patient.weight_unit}` : "N/A" },
            { label: "Size", value: determinedSizeName },
            { label: "Date of Birth", value: formatDate(patient.date_of_birth) },
            { label: "Status", value: patient.status || "N/A" },
            { label: "Total Paid", value: formatCurrency(patient.total_paid) },
            { label: "Balance", value: formatCurrency(patient.total_due - patient.total_paid) },
            { label: "Last Visit", value: patient.last_visit || "N/A" },
            { label: "Next Due", value: patient.next_due || "N/A" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-dark-border dark:bg-dark-surface"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Medical info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard icon={FiAlertCircle} iconColor="text-rose-500" title="Allergies" value={patient.allergies} />
        <InfoCard icon={LuPill} iconColor="text-emerald-500" title="Medication" value={patient.medication} />
        <InfoCard icon={FiClipboard} iconColor="text-amber-500" title="Notes" value={patient.notes} />
      </div>

      {/* Download PDF */}
      <div className="flex gap-3">
        <button
          onClick={() => generatePatientPDF(patient)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
        >
          <FiDownload className="h-4 w-4" />
          Download Summary (PDF)
        </button>
        <button
          onClick={() => navigate(`/appointments?patientId=${patient.id}`)}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition"
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-dark-border dark:bg-dark-card">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={clsx("h-4 w-4", iconColor)} />
        <h5 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h5>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {value || <span className="italic text-zinc-400 dark:text-zinc-500">None recorded</span>}
      </p>
    </div>
  );
}

/* ──────────────── Appointments Tab ──────────────── */

function AppointmentsTab({ appointments }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedApt, setSelectedApt] = useState(null);
  const appointmentsPerPage = 5;

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FiCalendar className="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
        <p className="mt-3 text-lg font-medium text-zinc-500 dark:text-zinc-400">No Appointments</p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Appointments linked to this patient will appear here.
        </p>
      </div>
    );
  }

  const indexOfLastApt = currentPage * appointmentsPerPage;
  const indexOfFirstApt = indexOfLastApt - appointmentsPerPage;
  const currentAppointments = appointments.slice(indexOfFirstApt, indexOfLastApt);
  const totalPages = Math.ceil(appointments.length / appointmentsPerPage);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-dark-border">
        <table className="w-full min-w-[600px]">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-dark-border dark:bg-dark-surface">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Title</th>
            </tr>
          </thead>
          <tbody>
            {currentAppointments.map((apt) => (
              <tr
                key={apt.id}
                onClick={() => setSelectedApt(apt)}
                className="border-b border-zinc-200/80 transition hover:bg-zinc-50 dark:border-dark-border dark:hover:bg-dark-surface/60 cursor-pointer"
              >
                <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                  {formatDate(apt.date)}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                  {apt.time || "—"}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {apt.title}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-400"
            >
              Previous
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-400"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedApt && (
        <DetailViewModal 
          title="Appointment Details"
          onClose={() => setSelectedApt(null)}
          data={[
            { label: "Date", value: formatDate(selectedApt.date) },
            { label: "Time", value: selectedApt.time || "N/A" },
            { label: "Title", value: selectedApt.title },
            { label: "Reason/Notes", value: selectedApt.reason || selectedApt.notes || "None" },
            { label: "Status", value: selectedApt.status || "N/A" }
          ]}
        />
      )}
    </div>
  );
}

/* ──────────────── Invoices Tab ──────────────── */

function InvoiceTab({ invoices }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInv, setSelectedInv] = useState(null);
  const invoicesPerPage = 5;

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FiFileText className="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
        <p className="mt-3 text-lg font-medium text-zinc-500 dark:text-zinc-400">No Invoices</p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Invoices linked to this patient will appear here.
        </p>
      </div>
    );
  }

  const indexOfLastInv = currentPage * invoicesPerPage;
  const indexOfFirstInv = indexOfLastInv - invoicesPerPage;
  const currentInvoices = invoices.slice(indexOfFirstInv, indexOfLastInv);
  const totalPages = Math.ceil(invoices.length / invoicesPerPage);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-dark-border">
        <table className="w-full min-w-[600px]">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-dark-border dark:bg-dark-surface">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            {currentInvoices.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => setSelectedInv(inv)}
                className="border-b border-zinc-200/80 transition hover:bg-zinc-50 dark:border-dark-border dark:hover:bg-dark-surface/60 cursor-pointer"
              >
                <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {inv.invoice_number || `INV-${inv.id}`}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                  {formatDate(inv.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                      invoiceStatusStyles[inv.status] ||
                      invoiceStatusStyles[Object.keys(invoiceStatusStyles).find(k => k.toLowerCase() === inv.status?.toLowerCase())] ||
                        "border-zinc-200 bg-zinc-50 text-zinc-600"
                    )}
                  >
                    {inv.status}
                  </span>                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(inv.formatted_amount_paid || inv.amount_paid)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-400"
            >
              Previous
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-400"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedInv && (
        <DetailViewModal 
          title="Invoice Details"
          onClose={() => setSelectedInv(null)}
          data={[
            { label: "Invoice Number", value: selectedInv.invoice_number || `INV-${selectedInv.id}` },
            { label: "Date", value: formatDate(selectedInv.created_at) },
            { label: "Status", value: selectedInv.status },
            { label: "Amount Paid", value: formatCurrency(selectedInv.formatted_amount_paid || selectedInv.amount_paid) },
            { label: "Notes", value: selectedInv.notes || "None" }
          ]}
        />
      )}
    </div>
  );
}

function DetailViewModal({ title, onClose, data }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-dark-card border dark:border-dark-border overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-dark-border">
          <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors">✕</button>
        </div>
        <div className="p-0 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
              {data.map((item, idx) => (
                <tr key={idx} className="group hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30 transition-colors">
                  <td className="w-1/3 bg-zinc-50/30 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:bg-dark-surface/20 dark:text-zinc-500">
                    {item.label}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">
                    {item.value || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-zinc-50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/50 flex justify-end">
          <button onClick={onClose} className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-zinc-900/10 dark:shadow-none">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Medical Records Tab ──────────────── */

function MedicalRecordsTab({ patient, isStaff, isVet }) {
  const toast = useToast();
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [vets, setVets] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnlyMode, setIsViewOnlyMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [selectedVetId, setSelectedVetId] = useState("");
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendingRecord, setSendingRecord] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 5;

  const fetchRecords = () => {
    if (!user?.token) return;
    return fetch(`/api/medical-records?pet_id=${patient.id}`, {
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
    return fetch(`/api/appointments?pet_id=${patient.id}`, {
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
        setAppointments(data);
      })
      .catch(err => {
        console.error("Error fetching appointments:", err);
      });
  };

  const fetchVets = () => {
    if (!user?.token) return;
    return fetch("/api/vets", { // Changed from /api/users/vets
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then(res => res.json())
      .then(data => setVets(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Error fetching vets:", err);
        setVets([]);
      });
  };

  useEffect(() => {
    Promise.all([
      fetchRecords(),
      fetchAppointments(),
      fetchVets(),
    ]);
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

  const deleteRecord = (e, id) => {
    e.stopPropagation(); // Prevent opening modal
    if (!confirm("Are you sure you want to delete this record?")) return;
    
    // Immediate UI feedback
    setRecords(prev => prev.filter(r => r.id !== id));
    
    fetch(`/api/medical-records/${id}`, { 
      method: "DELETE",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user?.token}`
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          // Rollback if failed
          fetchRecords();
          throw new Error(data.message || "Failed to delete");
        }
        toast.success("Medical record deleted successfully.");
      })
      .catch(err => {
        toast.error(err.message);
        fetchRecords(); // Rollback
      });
  };

  // Pagination Logic
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(records.length / recordsPerPage);

  const handleRowClick = (record, mode = 'edit') => {
    setEditingRecord(record);
    setSelectedAppointmentId(record.appointment_id || "");
    setSelectedVetId(record.vet_id || "");
    fetchAppointments(); // Refresh list to ensure real-time appointment data
    setIsModalOpen(true);
    // You might want to add a state for view mode if not already there
    setIsViewOnlyMode(mode === 'view');
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Patient History</h3>
           {records.length > 0 && (
             <button
               onClick={() => generateAllMedicalRecordsPDF(records, patient)}
               className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
               title="Download full history as PDF"
             >
               <FiDownload className="h-3.5 w-3.5" />
               Download All
             </button>
           )}
         </div>
         {isVet && (
           <button 
             onClick={() => { setEditingRecord(null); setSelectedAppointmentId(""); setSelectedVetId(""); setIsModalOpen(true); }}
             className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
           >
             Add Record
           </button>
         )}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-dark-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:bg-dark-surface dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4">Service & Date</th>
              <th className="px-6 py-4">Attending Vet</th>
              <th className="px-6 py-4">Diagnosis Summary</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-dark-border bg-white dark:bg-dark-card">
            {records.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-zinc-500">No medical records found.</td>
              </tr>
            ) : currentRecords.map(record => (
              <tr 
                key={record.id} 
                onClick={() => handleRowClick(record)}
                className="group cursor-pointer transition hover:bg-zinc-50/80 dark:hover:bg-dark-surface/50"
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 italic uppercase leading-none mb-1">
                      {record.appointment?.service?.name || "Clinical Visit"}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold italic">
                      {record.appointment?.date ? formatDate(record.appointment.date) : formatDate(record.created_at)}
                      {record.appointment?.time && (
                        <>
                          <span className="text-[10px] text-zinc-300">•</span>
                          <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> {record.appointment.time.substring(0, 5)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold uppercase text-[10px] tracking-widest">
                    <FiUser className="text-zinc-400" />
                    {record.vet?.role === 'veterinarian' ? `Dr. ${record.vet?.name}` : (record.vet?.name || "N/A")}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="max-w-xs truncate text-zinc-600 dark:text-zinc-400 font-medium">
                    {record.diagnosis || "No diagnosis summary..."}
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRowClick(record, 'view'); }}
                      className="p-2 rounded-lg text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                      title="View Record Details"
                    >
                      <FiEye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); generateMedicalRecordPDF(record, patient); }}
                      className="p-2 rounded-lg text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                      title="Export to PDF"
                    >
                      <FiDownload className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSendingRecord(record); setIsSendModalOpen(true); }}
                      className="p-2 rounded-lg text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                      title="Notify Client"
                    >
                      <FiBell className="h-4 w-4" />
                    </button>
                    {isVet && (
                      <button 
                        onClick={(e) => deleteRecord(e, record.id)} 
                        className="p-2 rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete Record"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between px-2">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, records.length)} of {records.length} records
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-400"
            >
              Previous
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-400"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <MedicalRecordModal 
          record={editingRecord} 
          onClose={() => setIsModalOpen(false)} 
          onSave={onSave} 
          isStaff={isStaff}
          isVet={isVet}
          isViewOnlyMode={isViewOnlyMode}
          appointments={appointments}
          selectedAppointmentId={selectedAppointmentId}
          setSelectedAppointmentId={setSelectedAppointmentId}
          vets={vets}
          selectedVetId={selectedVetId}
          setSelectedVetId={setSelectedVetId}
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
  isViewOnlyMode,
  appointments, 
  selectedAppointmentId, 
  setSelectedAppointmentId,
  vets = [],
  selectedVetId,
  setSelectedVetId
}) {
  const isEdit = !!record;
  const isViewOnly = isStaff || isViewOnlyMode;
  const { setLaravelErrors, clearErrors, getError } = useFormErrors();
  
  const [isApptDropdownOpen, setIsApptDropdownOpen] = useState(false);
  const [apptSearch, setApptSearch] = useState("");

  const filteredAppointments = useMemo(() => {
    if (!apptSearch.trim()) return appointments;
    const search = apptSearch.toLowerCase();
    return appointments.filter(apt => 
      formatDate(apt.date).toLowerCase().includes(search) ||
      (apt.service?.name || apt.title || "").toLowerCase().includes(search)
    );
  }, [appointments, apptSearch]);

  const selectedApt = appointments.find(a => a.id.toString() === selectedAppointmentId?.toString());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isViewOnly) return;
    
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.appointment_id = selectedAppointmentId;
    data.vet_id = selectedVetId;
    
    clearErrors();
    onSave(data, setLaravelErrors);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-dark-card border dark:border-dark-border">
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-dark-border shrink-0">
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
            {isViewOnlyMode ? "View Medical Record" : isViewOnly ? "Medical Record Details" : isEdit ? "Edit Record" : "Add Medical Record"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface">✕</button>
        </div>
        <div className="overflow-y-auto p-6">
          <form id="med-record-form" onSubmit={handleSubmit} className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Attending Veterinarian</label>
                 <select 
                   disabled={isViewOnly}
                   value={selectedVetId}
                   onChange={(e) => setSelectedVetId(e.target.value)}
                   className={clsx(
                     "w-full rounded-xl border px-3 py-2.5 text-sm dark:bg-dark-surface focus:outline-none focus:border-emerald-400 dark:text-zinc-200",
                     isViewOnly ? "bg-zinc-50 cursor-not-allowed" : "bg-white",
                     getError("vet_id") ? "border-rose-500 bg-rose-50/10" : "border-zinc-200 dark:border-dark-border"
                   )}
                 >
                   <option value="">Select veterinarian...</option>
                   {vets.map(vet => (
                     <option key={vet.id} value={vet.id}>
                       {vet.role === 'veterinarian' ? `Dr. ${vet.name}` : vet.name}
                     </option>
                   ))}
                 </select>
                 {getError("vet_id") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("vet_id")}</p>}
               </div>

               <div>
                 <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Link to Appointment (Required)</label>
                 <div className="relative">
                    <button
                      type="button"
                      disabled={isViewOnly}
                      onClick={() => setIsApptDropdownOpen(!isApptDropdownOpen)}
                      className={clsx(
                        "flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm transition-all focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                        isApptDropdownOpen ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-zinc-200 dark:border-dark-border bg-zinc-50"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FiCalendar className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className={clsx("truncate", !selectedAppointmentId && "text-zinc-400")}>
                          {selectedApt 
                            ? `${formatDate(selectedApt.date)} - ${selectedApt.service?.name || selectedApt.title || "General Visit"}`
                            : "Select an appointment..."
                          }
                        </span>
                      </div>
                      {!isViewOnly && <FiChevronDown className={clsx("h-4 w-4 text-zinc-400 transition-transform", isApptDropdownOpen && "rotate-180")} />}
                    </button>

                    {isApptDropdownOpen && !isViewOnly && (
                      <div className="absolute left-0 top-full z-[70] mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 dark:border-dark-border dark:bg-dark-card">
                        <div className="p-2 border-b border-zinc-100 dark:border-dark-border">
                          <div className="relative">
                            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <input 
                              type="text"
                              placeholder="Search date or service..."
                              value={apptSearch}
                              onChange={(e) => setApptSearch(e.target.value)}
                              autoFocus
                              className="h-9 w-full rounded-lg border border-zinc-100 bg-zinc-50 pl-9 pr-8 text-xs text-zinc-700 focus:outline-none focus:border-emerald-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300"
                            />
                            {apptSearch && (
                              <button
                                type="button"
                                onClick={() => setApptSearch("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                              >
                                <FiX className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-zinc-50 dark:divide-dark-surface">
                          {filteredAppointments.length > 0 ? filteredAppointments.map(apt => (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() => {
                                setSelectedAppointmentId(apt.id.toString());
                                setIsApptDropdownOpen(false);
                                setApptSearch("");
                              }}
                              className={clsx(
                                "w-full px-4 py-2.5 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-dark-surface",
                                selectedAppointmentId?.toString() === apt.id.toString() ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold" : "text-zinc-600 dark:text-zinc-400"
                              )}
                            >
                              <div className="flex justify-between items-center">
                                <span>{formatDate(apt.date)}</span>
                                <span className="opacity-60">{apt.time?.substring(0, 5)}</span>
                              </div>
                              <div className="truncate opacity-80">{apt.service?.name || apt.title || "General Visit"}</div>
                            </button>
                          )) : (
                            <div className="px-4 py-8 text-center text-[10px] text-zinc-400 uppercase font-bold tracking-widest">
                              No appointments found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                 </div>
                 {getError("appointment_id") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("appointment_id")}</p>}
               </div>
             </div>

             <div>
               <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Chief Complaint</label>
               <input 
                 name="chief_complaint" 
                 readOnly={isViewOnly}
                 defaultValue={record?.chief_complaint || ""} 
                 className={clsx(
                   "w-full rounded-xl border px-3 py-2.5 text-sm dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-emerald-400",
                   isViewOnly ? "bg-zinc-50 cursor-not-allowed" : "bg-white",
                   getError("chief_complaint") ? "border-rose-500 bg-rose-50/10" : "border-zinc-200 dark:border-dark-border"
                 )} 
               />
               {getError("chief_complaint") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("chief_complaint")}</p>}
             </div>
             <div>
               <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Findings</label>
               <textarea name="findings" rows={2} readOnly={isViewOnly} defaultValue={record?.findings || ""} className={clsx("w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-emerald-400", isViewOnly ? "bg-zinc-50 cursor-not-allowed" : "bg-white")}></textarea>
             </div>
             <div>
               <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Diagnosis (Vets Only)</label>
               <textarea 
                 name="diagnosis" 
                 rows={2} 
                 readOnly={isViewOnly}
                 defaultValue={record?.diagnosis || ""} 
                 className={clsx(
                   "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200",
                   isViewOnly ? "bg-zinc-50 cursor-not-allowed italic" : "bg-white"
                 )}
               ></textarea>
             </div>
             <div>
               <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Treatment Plan</label>
               <textarea 
                 name="treatment_plan" 
                 rows={2} 
                 readOnly={isViewOnly}
                 defaultValue={record?.treatment_plan || ""} 
                 className={clsx(
                   "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200",
                   isViewOnly ? "bg-zinc-50 cursor-not-allowed italic" : "bg-white"
                 )}
               ></textarea>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Follow-up Date</label>
                 <input type="date" name="follow_up_date" readOnly={isViewOnly} defaultValue={record?.follow_up_date?.split('T')[0] || ""} className={clsx("w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-emerald-400", isViewOnly ? "bg-zinc-50" : "bg-white")} />
               </div>
               <div>
                 <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Follow-up Time</label>
                 <input type="time" name="follow_up_time" readOnly={isViewOnly} defaultValue={record?.follow_up_time || ""} className={clsx("w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-emerald-400", isViewOnly ? "bg-zinc-50" : "bg-white")} />
               </div>
             </div>
             <div>
               <label className="mb-1 block text-sm font-semibold text-zinc-600 dark:text-zinc-300">Private Notes</label>
               <textarea name="notes" rows={2} readOnly={isViewOnly} defaultValue={record?.notes || ""} className={clsx("w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:outline-none focus:border-emerald-400", isViewOnly ? "bg-zinc-50" : "bg-white")}></textarea>
             </div>
          </form>
        </div>
        <div className="border-t bg-zinc-50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200">
            {isViewOnly ? "Close" : "Cancel"}
          </button>
          {!isViewOnly && (
            <button type="submit" form="med-record-form" className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Save Record</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ViewPatientProfile;
