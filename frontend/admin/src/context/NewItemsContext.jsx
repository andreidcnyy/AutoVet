import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

const KEYS = { patients: "nv_since_patients", appointments: "nv_since_appointments" };
const getStamp = (key) => sessionStorage.getItem(key);
const setStamp = (key) => sessionStorage.setItem(key, new Date().toISOString());

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    const path = window.location.pathname;
    const onPatients     = path.startsWith("/patients");
    const onAppointments = path.startsWith("/appointments");

    // Synchronously zero out + stamp the page the user is CURRENTLY ON.
    // This happens before the async fetch so the response can never overwrite it.
    if (onPatients)     { setPatientCount(0);     setStamp(KEYS.patients); }
    if (onAppointments) { setAppointmentCount(0); setStamp(KEYS.appointments); }

    const params = {};
    const pSince = getStamp(KEYS.patients);
    const aSince = getStamp(KEYS.appointments);
    if (pSince) params.since_patients     = pSince;
    if (aSince) params.since_appointments = aSince;

    try {
      const data = await api.get("/api/new-counts", { params });
      // Never overwrite the count for a page the user is currently viewing
      if (!onPatients     && typeof data?.new_patients     === "number") setPatientCount(data.new_patients);
      if (!onAppointments && typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Stamp NOW for any unseen key — existing records never count as "new"
    if (!getStamp(KEYS.patients))     setStamp(KEYS.patients);
    if (!getStamp(KEYS.appointments)) setStamp(KEYS.appointments);
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 30000);
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
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
