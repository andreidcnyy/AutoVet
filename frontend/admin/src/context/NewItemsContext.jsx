import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

// New keys — forces a clean slate, discards any old corrupted timestamps
const KEYS = {
  patients:     "nav_new_patients_v3",
  appointments: "nav_new_appointments_v3",
};

const todayMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

// Read stored timestamp; if missing OR older than today, reset to today's midnight
const safeTimestamp = (key) => {
  const stored = localStorage.getItem(key);
  const today  = todayMidnight();
  if (!stored || stored < today) {
    localStorage.setItem(key, today);
    return today;
  }
  return stored;
};

const stampNow = (key) => localStorage.setItem(key, new Date().toISOString());

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api.get("/api/new-counts", {
        params: {
          since_patients:     safeTimestamp(KEYS.patients),
          since_appointments: safeTimestamp(KEYS.appointments),
        },
      });
      if (typeof data?.new_patients     === "number") setPatientCount(data.new_patients);
      if (typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    safeTimestamp(KEYS.patients);
    safeTimestamp(KEYS.appointments);
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  // Expose stamp functions so Sidebar/NavItem can call them on navigation
  const markPatientsSeen     = useCallback(() => { stampNow(KEYS.patients);     setPatientCount(0); }, []);
  const markAppointmentsSeen = useCallback(() => { stampNow(KEYS.appointments); setAppointmentCount(0); }, []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
