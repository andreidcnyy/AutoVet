import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0, clearPatients: () => {}, clearAppointments: () => {} });

const STORAGE_KEYS = {
  patients:     "nav_patients_last_viewed",
  appointments: "nav_appointments_last_viewed",
};

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    try {
      const sincePatients     = localStorage.getItem(STORAGE_KEYS.patients)     || new Date(0).toISOString();
      const sinceAppointments = localStorage.getItem(STORAGE_KEYS.appointments) || new Date(0).toISOString();

      const data = await api.get("/api/new-counts", {
        params: { since_patients: sincePatients, since_appointments: sinceAppointments },
      });

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

  const clearPatients = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.patients, new Date().toISOString());
    setPatientCount(0);
  }, []);

  const clearAppointments = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.appointments, new Date().toISOString());
    setAppointmentCount(0);
  }, []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, clearPatients, clearAppointments }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
