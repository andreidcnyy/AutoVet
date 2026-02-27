import { useState, useEffect } from "react";
import AddPatientFormView from "../components/patients/AddPatientFormView";
import PatientRecordsView from "../components/patients/PatientRecordsView";

function PatientsPage() {
  const [view, setView] = useState("records");
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data) => setPatients(data))
      .catch((err) => console.error("Failed to load patients:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSaveNewPatient = (newPatient) => {
    // Prepend new patient so it appears first in the list
    setPatients((prev) => [newPatient, ...prev]);
    setSelectedPatientId(newPatient.id);
    setView("records");
  };

  const handleDeletePatient = async (patientId) => {
    try {
      await fetch(`/api/patients/${patientId}`, { method: "DELETE" });
      setPatients((prev) => prev.filter((p) => p.id !== patientId));
      setSelectedPatientId(null);
    } catch (err) {
      console.error("Failed to delete patient:", err);
      alert("Could not delete the patient. Please try again.");
    }
  };

  if (view === "add") {
    return (
      <AddPatientFormView
        onCancel={() => setView("records")}
        onSave={handleSaveNewPatient}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        Loading patient records...
      </div>
    );
  }

  return (
    <PatientRecordsView
      patients={patients}
      selectedPatientId={selectedPatientId}
      onSelectPatient={setSelectedPatientId}
      onOpenAddPatient={() => setView("add")}
      onDeletePatient={handleDeletePatient}
    />
  );
}

export default PatientsPage;
