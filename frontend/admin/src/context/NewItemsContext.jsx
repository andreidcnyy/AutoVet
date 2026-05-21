import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    const path = window.location.pathname;
    const onPatients     = path.startsWith("/patients");
    const onAppointments = path.startsWith("/appointments");

    try {
      // Sending path lets the backend atomically stamp last_seen for the current page
      const data = await api.get("/api/new-counts", { params: { path } });
      // Backend already marked current page as seen — count will be 0 for it
      if (typeof data?.new_patients     === "number") setPatientCount(data.new_patients);
      if (typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  // Instant visual reset when navigating to these pages (next fetch confirms it)
  const markPatientsSeen     = useCallback(() => setPatientCount(0),     []);
  const markAppointmentsSeen = useCallback(() => setAppointmentCount(0), []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
