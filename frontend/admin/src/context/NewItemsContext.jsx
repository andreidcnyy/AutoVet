import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

const KEYS = {
  patients:     "nav_new_patients_v3",
  appointments: "nav_new_appointments_v3",
};

// MySQL-safe format: "YYYY-MM-DD HH:MM:SS" in UTC
const toMysql = (isoString) =>
  new Date(isoString).toISOString().slice(0, 19).replace("T", " ");

// Today's midnight in UTC as MySQL string
const todayMidnightMysql = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return toMysql(d.toISOString());
};

// Read stored timestamp; auto-reset to today's midnight if missing or stale
const safeTimestamp = (key) => {
  const stored = localStorage.getItem(key);
  const today  = todayMidnightMysql();
  if (!stored || stored < today) {
    localStorage.setItem(key, today);
    return today;
  }
  return stored;
};

const stampNow = (key) =>
  localStorage.setItem(key, toMysql(new Date().toISOString()));

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    // Read current path at call-time (not closure), skip pages being viewed
    const path = window.location.pathname;
    const skipPatients     = path.startsWith("/patients");
    const skipAppointments = path.startsWith("/appointments");

    // Stamp now for pages currently being viewed so the query returns 0
    if (skipPatients)     stampNow(KEYS.patients);
    if (skipAppointments) stampNow(KEYS.appointments);

    try {
      const data = await api.get("/api/new-counts", {
        params: {
          since_patients:     safeTimestamp(KEYS.patients),
          since_appointments: safeTimestamp(KEYS.appointments),
        },
      });
      // Never update count for the page currently open
      if (!skipPatients     && typeof data?.new_patients     === "number") setPatientCount(data.new_patients);
      if (!skipAppointments && typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Ensure keys exist before first fetch
    safeTimestamp(KEYS.patients);
    safeTimestamp(KEYS.appointments);
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  const markPatientsSeen = useCallback(() => {
    stampNow(KEYS.patients);
    setPatientCount(0);
  }, []);

  const markAppointmentsSeen = useCallback(() => {
    stampNow(KEYS.appointments);
    setAppointmentCount(0);
  }, []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
