import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

// sessionStorage: survives F5, clears on tab/browser close — no stale values across deploys
const KEYS = { patients: "nv_since_patients", appointments: "nv_since_appointments" };

const getStamp  = (key) => sessionStorage.getItem(key);               // ISO string or null
const setStamp  = (key) => sessionStorage.setItem(key, new Date().toISOString());

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    const path = window.location.pathname;

    // Stamp the current page BEFORE fetching — backend will count 0 for it
    if (path.startsWith("/patients"))     setStamp(KEYS.patients);
    if (path.startsWith("/appointments")) setStamp(KEYS.appointments);

    const params = {};
    const pSince = getStamp(KEYS.patients);
    const aSince = getStamp(KEYS.appointments);
    if (pSince) params.since_patients     = pSince;
    if (aSince) params.since_appointments = aSince;

    try {
      const data = await api.get("/api/new-counts", { params });
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

  // When navigating to the page: instant visual reset + stamp so F5 refresh stays 0
  const markPatientsSeen = useCallback(() => {
    setStamp(KEYS.patients);
    setPatientCount(0);
  }, []);

  const markAppointmentsSeen = useCallback(() => {
    setStamp(KEYS.appointments);
    setAppointmentCount(0);
  }, []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
