import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AppointmentsPage from "../pages/AppointmentsPage";
import BillingPage from "../pages/BillingPage";
import DashboardPage from "../pages/DashboardPage";
import InventoryPage from "../pages/InventoryPage";
import PatientsPage from "../pages/PatientsPage";
import ViewPatientProfilePage from "../pages/ViewPatientProfilePage";
import ProfilePage from "../pages/ProfilePage";
import SettingsPage from "../pages/SettingsPage";
import LoginPage from "../pages/LoginPage";
import ReportsPage from "../pages/ReportsPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    handle: { title: "Login" },
  },
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
        path: "patients/:id",
        element: <ViewPatientProfilePage />,
        handle: { title: "Patient Profile" },
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
        path: "reports",
        element: <ReportsPage />,
        handle: { title: "Clinical & Business Reports" },
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
