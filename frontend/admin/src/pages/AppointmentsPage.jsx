import { useEffect } from "react";
import AppointmentsView from "../components/appointments/AppointmentsView";
import { useNewItems } from "../context/NewItemsContext";

function AppointmentsPage() {
  const { clearAppointments } = useNewItems();
  useEffect(() => { clearAppointments(); }, []);
  return <AppointmentsView />;
}

export default AppointmentsPage;
