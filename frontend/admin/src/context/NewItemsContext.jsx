import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../api";
import echo from "../utils/echo";

const NewItemsContext = createContext({ petCount: 0, appointmentCount: 0, invoiceCount: 0 });

const KEYS = { pets: "lv_pets", appointments: "lv_appointments" };
const setStamp = (key) => localStorage.setItem(key, new Date().toISOString());
// Return existing stamp, or initialize to NOW so pre-existing records never count as new
const getOrInitStamp = (key) => {
  let val = localStorage.getItem(key);
  if (!val) { val = new Date().toISOString(); localStorage.setItem(key, val); }
  return val;
};

export function NewItemsProvider({ children, enabled = true }) {
  const [petCount,     setPetCount]     = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [invoiceCount,     setInvoiceCount]     = useState(0);
  const intervalRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;
    const path = window.location.pathname;
    const onPets     = path.startsWith("/pets");
    const onAppointments = path.startsWith("/appointments");

    if (onPets)     { setPetCount(0);     setStamp(KEYS.pets); }
    if (onAppointments) { setAppointmentCount(0); setStamp(KEYS.appointments); }

    const params = {
      since_pets:     getOrInitStamp(KEYS.pets),
      since_appointments: getOrInitStamp(KEYS.appointments),
    };

    try {
      const data = await api.get("/api/new-counts", { params });
      if (!onPets     && typeof data?.new_pets     === "number") setPetCount(data.new_pets);
      if (!onAppointments && typeof data?.new_appointments === "number") setAppointmentCount(data.new_appointments);
      if (typeof data?.draft_invoices === "number") setInvoiceCount(data.draft_invoices);
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchCounts();
    const apptCh = echo.private('admin.appointments');
    const invCh = echo.private('admin.invoices');
    const notifCh = echo.private('admin.notifications');
    apptCh.listen('.appointment.created', fetchCounts);
    invCh.listen('.invoice.updated', fetchCounts);
    notifCh.listen('.entity.created', fetchCounts);
    return () => {
      apptCh.stopListening('.appointment.created');
      invCh.stopListening('.invoice.updated');
      notifCh.stopListening('.entity.created');
    };
  }, [enabled, fetchCounts]);

  const markPetsSeen = useCallback(() => {
    setStamp(KEYS.pets);
    setPetCount(0);
  }, []);

  const markAppointmentsSeen = useCallback(() => {
    setStamp(KEYS.appointments);
    setAppointmentCount(0);
  }, []);

  return (
    <NewItemsContext.Provider value={{ petCount, appointmentCount, invoiceCount, markPetsSeen, markAppointmentsSeen, refreshCounts: fetchCounts }}>
      {children}
    </NewItemsContext.Provider>
  );
}

export const useNewItems = () => useContext(NewItemsContext);
