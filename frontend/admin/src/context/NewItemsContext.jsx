import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0, clearPatients: () => {}, clearAppointments: () => {} });

const STORAGE_KEYS = {
  patients:     "nav_patients_last_viewed",
  appointments: "nav_appointments_last_viewed",
};

// Initialize timestamp to NOW on first load so only records created after this session are counted
const initTimestamp = (key) => {
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const now = new Date().toISOString();
  localStorage.setItem(key, now);
  return now;
};

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);

  // Generation counters — bumped on clear to invalidate in-flight fetches
  const genRef = useRef({ patients: 0, appointments: 0 });
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    // Snapshot generation at the time this fetch starts
    const snapPatients     = genRef.current.patients;
    const snapAppointments = genRef.current.appointments;
    try {
      const sincePatients     = localStorage.getItem(STORAGE_KEYS.patients)     || initTimestamp(STORAGE_KEYS.patients);
      const sinceAppointments = localStorage.getItem(STORAGE_KEYS.appointments) || initTimestamp(STORAGE_KEYS.appointments);

      const data = await api.get("/api/new-counts", {
        params: { since_patients: sincePatients, since_appointments: sinceAppointments },
      });

      // Only apply result if no clear happened while this fetch was in-flight
      if (snapPatients     === genRef.current.patients     && typeof data?.new_patients     === "number") setPatientCount(data.new_patients);
      if (snapAppointments === genRef.current.appointments && typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    initTimestamp(STORAGE_KEYS.patients);
    initTimestamp(STORAGE_KEYS.appointments);
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  const clearPatients = useCallback(() => {
    genRef.current.patients++;
    localStorage.setItem(STORAGE_KEYS.patients, new Date().toISOString());
    setPatientCount(0);
  }, []);

  const clearAppointments = useCallback(() => {
    genRef.current.appointments++;
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
