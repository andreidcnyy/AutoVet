import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

const KEYS = { patients: "nv_seen_patients", appointments: "nv_seen_appointments" };

// sessionStorage survives F5 refresh but clears on tab/browser close — no stale values
const todayStr = () => new Date().toISOString().slice(0, 10); // "2026-05-21"
const hasSeen  = (key) => sessionStorage.getItem(key) === todayStr();
const setSeen  = (key) => sessionStorage.setItem(key, todayStr());

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    const path = window.location.pathname;

    // Mark current page as seen before the fetch so the count resolves to 0
    if (path.startsWith("/patients"))     setSeen(KEYS.patients);
    if (path.startsWith("/appointments")) setSeen(KEYS.appointments);

    try {
      const data = await api.get("/api/new-counts");
      if (typeof data?.new_patients     === "number")
        setPatientCount(hasSeen(KEYS.patients) ? 0 : data.new_patients);
      if (typeof data?.new_appointments === "number")
        setAppointmentCount(hasSeen(KEYS.appointments) ? 0 : data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  const markPatientsSeen = useCallback(() => {
    setSeen(KEYS.patients);
    setPatientCount(0);
  }, []);

  const markAppointmentsSeen = useCallback(() => {
    setSeen(KEYS.appointments);
    setAppointmentCount(0);
  }, []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
