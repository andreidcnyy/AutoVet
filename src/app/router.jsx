import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AppointmentsPage from "../pages/AppointmentsPage";
import BillingPage from "../pages/BillingPage";
import DashboardPage from "../pages/DashboardPage";
import InventoryPage from "../pages/InventoryPage";
import PatientsPage from "../pages/PatientsPage";
import ProfilePage from "../pages/ProfilePage";
import SettingsPage from "../pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
        handle: { title: "Dashboard Overview" },
      },
      {
        path: "patients",
        element: <PatientsPage />,
        handle: { title: "Patient Records" },
      },
      {
        path: "appointments",
        element: <AppointmentsPage />,
        handle: { title: "Appointments" },
      },
      {
        path: "inventory",
        element: <InventoryPage />,
        handle: { title: "Internal Inventory Management" },
      },
      {
        path: "billing",
        element: <BillingPage />,
        handle: { title: "Billing" },
      },
      {
        path: "settings",
        element: <SettingsPage />,
        handle: { title: "Settings" },
      },
      {
        path: "profile",
        element: <ProfilePage />,
        handle: { title: "My Profile" },
      }
    ],
  },
]);
