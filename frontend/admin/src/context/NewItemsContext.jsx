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
      const data = await api.get("/api/new-counts");
      if (!onPatients     && typeof data?.new_patients     === "number") setPatientCount(data.new_patients);
      if (!onAppointments && typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  const markPatientsSeen = useCallback(() => {
    setPatientCount(0);
    api.post("/api/mark-seen", { patients: true }).catch(() => {});
  }, []);

  const markAppointmentsSeen = useCallback(() => {
    setAppointmentCount(0);
    api.post("/api/mark-seen", { appointments: true }).catch(() => {});
  }, []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
