import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

const NewItemsContext = createContext({ patientCount: 0, appointmentCount: 0 });

export function NewItemsProvider({ children, enabled = true }) {
  const [patientCount,     setPatientCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const baselineRef = useRef({ patients: null, appointments: null });
  const latestRef   = useRef({ patients: 0,    appointments: 0 });
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    const path = window.location.pathname;
    const onPatients     = path.startsWith("/patients");
    const onAppointments = path.startsWith("/appointments");

    if (onPatients)     setPatientCount(0);
    if (onAppointments) setAppointmentCount(0);

    try {
      const data = await api.get("/api/new-counts");
      const total_p = data?.total_patients     ?? 0;
      const total_a = data?.total_appointments ?? 0;

      latestRef.current = { patients: total_p, appointments: total_a };

      // First fetch sets the baseline — everything that existed at mount is not "new"
      if (baselineRef.current.patients     === null) baselineRef.current.patients     = total_p;
      if (baselineRef.current.appointments === null) baselineRef.current.appointments = total_a;

      const new_p = Math.max(0, total_p - baselineRef.current.patients);
      const new_a = Math.max(0, total_a - baselineRef.current.appointments);

      if (!onPatients)     setPatientCount(new_p);
      if (!onAppointments) setAppointmentCount(new_a);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchCounts();
    intervalRef.current = setInterval(fetchCounts, 10000);
    return () => clearInterval(intervalRef.current);
  }, [enabled, fetchCounts]);

  const markPatientsSeen = useCallback(() => {
    setPatientCount(0);
    baselineRef.current.patients = latestRef.current.patients;
  }, []);

  const markAppointmentsSeen = useCallback(() => {
    setAppointmentCount(0);
    baselineRef.current.appointments = latestRef.current.appointments;
  }, []);

  return (
    <NewItemsContext.Provider value={{ patientCount, appointmentCount, markPatientsSeen, markAppointmentsSeen, refreshCounts: fetchCounts }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
