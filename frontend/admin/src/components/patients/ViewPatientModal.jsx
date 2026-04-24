import { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import ViewPatientProfile from "./ViewPatientProfile";
import { useAuth } from "../../context/AuthContext";

function ViewPatientModal({ isOpen, onClose, patientId, onRefresh }) {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatient = async () => {
    if (!user?.token || !patientId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pets/${patientId}`, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      });
      if (!response.ok) throw new Error("Failed to load patient.");
      const data = await response.json();
      setPatient(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && patientId) {
      fetchPatient();
    } else {
      setPatient(null);
      setError(null);
    }
  }, [isOpen, patientId, user?.token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-300 dark:bg-dark-card border border-zinc-200 dark:border-dark-border">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-[10001] flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition-colors dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
        >
          <FiX className="h-5 w-5" />
        </button>

        <div className="h-full overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-600" />
                <p className="text-sm font-bold text-zinc-500">Loading profile...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-96 items-center justify-center p-12 text-center">
              <div>
                <p className="text-lg font-bold text-rose-500">{error}</p>
                <button 
                  onClick={onClose}
                  className="mt-4 rounded-xl bg-zinc-900 px-6 py-2 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-950"
                >
                  Close Modal
                </button>
              </div>
            </div>
          ) : (
            <div className="p-0">
               {/* Pass a modified version of ViewPatientProfile that doesn't include the 'Back' button if needed, 
                   or just use it as is if it's compatible. */}
               <ViewPatientProfile 
                 patient={patient} 
                 onRefresh={() => {
                   fetchPatient();
                   if (onRefresh) onRefresh();
                 }}
                 isModal={true} // We can use this prop inside ViewPatientProfile to hide redundant UI
               />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ViewPatientModal;
