import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ViewPatientProfile from "../components/patients/ViewPatientProfile";

function ViewPatientProfilePage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load patient.");
        return res.json();
      })
      .then((data) => setPatient(data))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-rose-500">
        {error}
      </div>
    );
  }

  return <ViewPatientProfile patient={patient} />;
}

export default ViewPatientProfilePage;
