import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

const KEYS = { patients: "lv_patients", appointments: "lv_appointments" };
const setStamp = (key) => localStorage.setItem(key, new Date().toISOString());
// Return existing stamp, or initialize to NOW so pre-existing records never count as new
const getOrInitStamp = (key) => {
  let val = localStorage.getItem(key);
  if (!val) { val = new Date().toISOString(); localStorage.setItem(key, val); }
  return val;
};

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    const path = window.location.pathname;
    const onPatients     = path.startsWith("/patients");
    const onAppointments = path.startsWith("/appointments");

    if (onPatients)     { setPatientCount(0);     setStamp(KEYS.patients); }
    if (onAppointments) { setAppointmentCount(0); setStamp(KEYS.appointments); }

    const params = {
      since_patients:     getOrInitStamp(KEYS.patients),
      since_appointments: getOrInitStamp(KEYS.appointments),
    };

    try {
      const data = await api.get("/api/new-counts", { params });
      if (!onPatients     && typeof data?.new_patients     === "number") setPatientCount(data.new_patients);
      if (!onAppointments && typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 10000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  const markPatientsSeen = useCallback(() => {
    setStamp(KEYS.patients);
    setPatientCount(0);
  }, []);

  const markAppointmentsSeen = useCallback(() => {
    setStamp(KEYS.appointments);
    setAppointmentCount(0);
  }, []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen, refreshCounts: fetchCounts }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
