import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

const STORAGE_KEYS = {
  patients:     "nav_patients_last_viewed",
  appointments: "nav_appointments_last_viewed",
};

// Default: start of today, so records created today show as new
const todayMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const getTimestamp = (key) => localStorage.getItem(key) || todayMidnight();

const stampNow = (key) => localStorage.setItem(key, new Date().toISOString());

export function NewItemsProvider({ children, enabled = true }) {
  const location = useLocation();
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  // Whenever we land on (or refresh) a tracked page, immediately stamp NOW
  // so the subsequent fetch finds 0 new records for that page
  const onPatients     = location.pathname.startsWith("/patients");
  const onAppointments = location.pathname.startsWith("/appointments");

  useEffect(() => {
    if (onPatients)     { stampNow(STORAGE_KEYS.patients);     setPatientCount(0); }
    if (onAppointments) { stampNow(STORAGE_KEYS.appointments); setAppointmentCount(0); }
  }, [onPatients, onAppointments]);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    // Re-read from window so we always get the latest value even after a clear
    const curPath = window.location.pathname;
    const skipPatients     = curPath.startsWith("/patients");
    const skipAppointments = curPath.startsWith("/appointments");

    if (skipPatients)     setPatientCount(0);
    if (skipAppointments) setAppointmentCount(0);
    if (skipPatients && skipAppointments) return;

    try {
      const data = await api.get("/api/new-counts", {
        params: {
          since_patients:     getTimestamp(STORAGE_KEYS.patients),
          since_appointments: getTimestamp(STORAGE_KEYS.appointments),
        },
      });

      if (!skipPatients     && typeof data?.new_patients     === "number") setPatientCount(data.new_patients);
      if (!skipAppointments && typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Ensure keys exist in localStorage on first ever load
    if (!localStorage.getItem(STORAGE_KEYS.patients))     localStorage.setItem(STORAGE_KEYS.patients,     todayMidnight());
    if (!localStorage.getItem(STORAGE_KEYS.appointments)) localStorage.setItem(STORAGE_KEYS.appointments, todayMidnight());

    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
