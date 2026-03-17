import clsx from "clsx";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { getPetImageUrl } from "../../utils/petImages";
import {
  FiCalendar,
  FiFilter,
  FiMail,
  FiPhone,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiUser,
  FiEdit2,
  FiExternalLink,
} from "react-icons/fi";
import { LuStethoscope } from "react-icons/lu";
import EditPatientModal from "./EditPatientModal";

const filters = ["All Species", "Healthy", "Overdue"];

const statusStyles = {
  Healthy: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Overdue: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Treatment: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

const vaccineStatusStyles = {
  Completed: "text-emerald-700 dark:text-emerald-400",
  Upcoming: "text-amber-700 dark:text-amber-400",
};

function StatusBadge({ value }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        statusStyles[value] || "border-slate-200 bg-slate-50 text-slate-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300"
      )}
    >
      {value}
    </span>
  );
}

function PatientRecordsView({ patients, selectedPatientId, onSelectPatient, onOpenAddPatient, onDeletePatient, onPatientEdited }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All Species");
  const [searchValue, setSearchValue] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's a CSV
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a valid CSV file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsImporting(true);
    try {
      const response = await fetch("/api/patients/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to import patients.");
      }

      const result = await response.json();
      toast.success(`Successfully imported ${result.count} patients!`);
      
      // Refresh the page or call a parent refresh function
      window.location.reload(); 
    } catch (err) {
      toast.error(err.message);
      console.error(err);
    } finally {
      setIsImporting(false);
      e.target.value = ""; // Reset input
    }
  };

  const downloadTemplate = () => {
    const headers = "name,species,breed,gender,date_of_birth,owner_name,owner_phone,owner_email,owner_address\n";
    const blob = new Blob([headers], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autovet_patient_template.csv";
    a.click();
  };

  const filteredPatients = useMemo(() => {
    const search = searchValue.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch =
        !search ||
        patient.name.toLowerCase().includes(search) ||
        patient.ownerName?.toLowerCase().includes(search) ||
        patient.breed?.toLowerCase().includes(search);

      const matchesFilter = activeFilter === "All Species" ? true : patient.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, patients, searchValue]);

  const selectedPatient = filteredPatients.find((patient) => patient.id === selectedPatientId) || filteredPatients[0] || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Patient Records</h2>
          <p className="mt-1 text-base text-slate-500 dark:text-zinc-400">Manage history, appointments, and medical follow-ups.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            id="csv-import"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
          <div className="flex flex-col items-end">
            <button
              onClick={() => document.getElementById("csv-import").click()}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-200 dark:hover:border-zinc-500 disabled:opacity-50"
            >
              <FiUploadCloud className="h-4 w-4" />
              {isImporting ? "Importing..." : "Import CSV"}
            </button>
            <button 
              onClick={downloadTemplate}
              className="mt-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline dark:text-blue-400"
            >
              Download Template
            </button>
          </div>
          <button
            onClick={onOpenAddPatient}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <FiPlus className="h-4 w-4" />
            Add New Patient
          </button>
        </div>
      </div>

      <div className="card-shell p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-11 min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 dark:border-dark-border dark:bg-dark-card dark:text-zinc-400">
            <FiSearch className="h-4 w-4" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              type="text"
              placeholder="Search by pet name, owner, or breed..."
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-zinc-200 dark:placeholder:text-gray-500"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  activeFilter === filter
                    ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:border-zinc-500"
                )}
              >
                <FiFilter className="h-3.5 w-3.5" />
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1.1fr]">
        <section className="card-shell overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <th className="px-5 py-4">Avatar</th>
                  <th className="px-5 py-4">Pet Name</th>
                  <th className="px-5 py-4">Owner</th>
                  <th className="px-5 py-4">Species / Breed</th>
                  <th className="px-5 py-4">Last Visit</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center text-slate-500 border-b border-slate-200/80 dark:border-dark-border dark:text-zinc-400">
                      <p className="text-lg font-medium">No patients found</p>
                      <p className="mt-1 text-sm">Add a new patient or adjust your filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr
                      key={patient.id}
                      onClick={() => onSelectPatient(patient.id)}
                      className={clsx(
                        "cursor-pointer border-b border-slate-200/80 align-top transition hover:bg-slate-50 dark:border-dark-border dark:hover:bg-dark-surface/60",
                        selectedPatient?.id === patient.id && "bg-blue-50/40 dark:bg-blue-900/10"
                      )}
                    >
                      <td className="px-5 py-4">
                        <img src={patient.photo || getPetImageUrl(patient.species, patient.breed)} alt={patient.name} className="h-12 w-12 rounded-full object-cover bg-slate-100" />
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-lg font-semibold text-slate-900 dark:text-zinc-50">{patient.name}</p>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">ID: #{patient.id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-lg text-slate-800 dark:text-zinc-200">{patient.ownerName}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-lg text-slate-800 dark:text-zinc-200">{patient.species}</p>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">{patient.breed}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-lg text-slate-800 dark:text-zinc-200">{patient.last_visit}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={patient.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Showing <span className="font-semibold text-slate-700 dark:text-zinc-200">1-{filteredPatients.length}</span> of{" "}
              <span className="font-semibold text-slate-700 dark:text-zinc-200">{patients.length}</span> patients
            </p>
            <div className="flex gap-2">
              <button onClick={() => toast.info("End of list.")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface">Previous</button>
              <button onClick={() => toast.info("End of list.")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface">Next</button>
            </div>
          </div>
        </section>

        {selectedPatient ? (
          <aside className="card-shell overflow-hidden relative">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="absolute top-6 right-6 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300 dark:hover:bg-dark-surface/80"
            >
              <FiEdit2 className="h-3.5 w-3.5" />
              Edit
            </button>
            <div className="border-b border-slate-200 p-6 pt-10 dark:border-dark-border">
              <img src={selectedPatient.photo || getPetImageUrl(selectedPatient.species, selectedPatient.breed)} alt={selectedPatient.name} className="h-24 w-24 rounded-2xl object-cover bg-slate-100" />
              <h3 className="mt-4 text-4xl font-bold text-slate-900 dark:text-zinc-50">{selectedPatient.name}</h3>
              <p className="mt-1 text-lg text-slate-500 dark:text-zinc-400">
                {selectedPatient.breed} • {selectedPatient.gender}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-dark-border dark:bg-dark-surface">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Weight</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800 dark:text-zinc-100">{selectedPatient.weight}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-dark-border dark:bg-dark-surface">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Last Visit</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800 dark:text-zinc-100">{selectedPatient.last_visit}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-dark-border dark:bg-dark-surface">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Next Due</p>
                  <p className="mt-1 text-xl font-semibold text-blue-600 dark:text-blue-400">{selectedPatient.next_due}</p>
                </div>
              </div>

              <Link
                to={`/patients/${selectedPatient.id}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                <FiExternalLink className="h-4 w-4" />
                View Full Profile
              </Link>

              <button
                onClick={() => navigate(`/appointments?patientId=${selectedPatient.id}`)}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                <FiCalendar className="h-4 w-4" />
                Book Appointment
              </button>

              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to permanently delete ${selectedPatient.name}'s record? This cannot be undone.`)) {
                    onDeletePatient(selectedPatient.id);
                  }
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <FiTrash2 className="h-4 w-4" />
                Delete Patient
              </button>
            </div>

            <div className="space-y-6 p-6">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">
                    <FiUser className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
                    Owner Details
                  </h4>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                  <p className="text-lg font-semibold text-slate-900 dark:text-zinc-50">{selectedPatient.ownerName}</p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">{selectedPatient.ownerSince || "Recently Added"}</p>

                  <div className="mt-4 space-y-2">
                    {selectedPatient.ownerPhone && (
                      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                        <FiPhone className="h-4 w-4 text-slate-400" />
                        {selectedPatient.ownerPhone}
                      </p>
                    )}
                    {selectedPatient.ownerEmail && (
                      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                        <FiMail className="h-4 w-4 text-slate-400" />
                        {selectedPatient.ownerEmail}
                      </p>
                    )}
                    {selectedPatient.owner_address && (
                      <div className="mt-3 text-sm text-slate-600 dark:text-zinc-300">
                        <p className="font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-xs mb-1">Address</p>
                        <p>{selectedPatient.owner_address}</p>
                        <p>{selectedPatient.owner_city}{selectedPatient.owner_province ? `, ${selectedPatient.owner_province}` : ''} {selectedPatient.owner_zip}</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h4 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">
                  <LuStethoscope className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
                  Vaccination History
                </h4>
                <div className="space-y-3">
                  {(selectedPatient.vaccinations || []).length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-zinc-500">No vaccination records yet.</p>
                  ) : (
                    (selectedPatient.vaccinations || []).map((record) => (
                      <article key={record.id} className="rounded-xl border border-slate-200 p-3 dark:border-dark-border dark:bg-dark-surface/50">
                        <p className={clsx("text-xs font-semibold uppercase tracking-wide", vaccineStatusStyles[record.status])}>
                          {record.status}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-zinc-50">{record.name}</p>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">{record.date}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </aside>
        ) : (
          <aside className="card-shell flex items-center justify-center p-6 text-slate-400 border-dashed border-2 dark:text-zinc-500">
            No patient selected or records available.
          </aside>
        )}
      </div>

      <EditPatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        patient={selectedPatient}
        onSaveSuccess={onPatientEdited}
      />
    </div>
  );
}

export default PatientRecordsView;
