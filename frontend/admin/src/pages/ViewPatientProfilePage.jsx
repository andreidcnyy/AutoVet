import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ViewPatientProfile from "../components/patients/ViewPatientProfile";
import { useAuth } from "../context/AuthContext";

function ViewPatientProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);

  const fetchPatient = () => {
    if (!user?.token || !id) return;

    fetch(`/api/pets/${id}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then((res) => {
        if (!res.ok) {
          console.error("Pet fetch failed with status:", res.status);
          throw new Error("Failed to load patient. Error code: " + res.status);
        }
        return res.json();
      })
      .then((data) => {
        setPatient(data);
      })
      .catch((err) => {
        console.error("Error loading patient:", err);
        setError(err.message);
      });
  };

  useEffect(() => {
    fetchPatient();
  }, [id, user?.token]);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-rose-500">
        {error}
      </div>
    );
  }

  return <ViewPatientProfile patient={patient} onRefresh={fetchPatient} />;
}

export default ViewPatientProfilePage;
