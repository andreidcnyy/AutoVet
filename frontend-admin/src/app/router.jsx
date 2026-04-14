import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AppointmentsPage from "../pages/AppointmentsPage";
import InvoicePage from "../pages/InvoicePage";
import DashboardPage from "../pages/DashboardPage";
import InventoryPage from "../pages/InventoryPage";
import PatientsPage from "../pages/PatientsPage";
import ViewPatientProfilePage from "../pages/ViewPatientProfilePage";
import ProfilePage from "../pages/ProfilePage";
import SettingsPage from "../pages/SettingsPage";
import LoginPage from "../pages/LoginPage";
import ReportsPage from "../pages/ReportsPage";
import ForbiddenPage from "../pages/ForbiddenPage";
import CalendarPage from "../pages/CalendarPage";
import ChangePasswordPage from "../pages/ChangePasswordPage";
import NotificationHistoryPage from "../pages/NotificationHistoryPage";
import ClientNotificationHistoryPage from "../pages/ClientNotificationHistoryPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import {
  ADMIN_ONLY,
  ALL_ROLES
} from "../constants/roles";

import RouterErrorElement from "../components/RouterErrorElement";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouterErrorElement />,
    handle: { title: "Login" },
  },
  {
    path: "/forbidden",
    element: <ForbiddenPage />,
    errorElement: <RouterErrorElement />,
    handle: { title: "Access Denied" },
  },
  {
    path: "/change-password",
    element: (
      <ProtectedRoute allowedRoles={ALL_ROLES}>
        <ChangePasswordPage />
      </ProtectedRoute>
    ),
    errorElement: <RouterErrorElement />,
    handle: { title: "Change Password" },
  },
  {
    path: "/",
    element: (
      <ProtectedRoute allowedRoles={ALL_ROLES}>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouterErrorElement />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <DashboardPage />
          </ProtectedRoute>
        ),
        handle: { title: "Dashboard Overview" },
      },
      {
        path: "patients",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <PatientsPage />
          </ProtectedRoute>
        ),
        handle: { title: "Patient Records" },
      },
      {
        path: "patients/:id",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <ViewPatientProfilePage />
          </ProtectedRoute>
        ),
        handle: { title: "Patient Profile" },
      },
      {
        path: "appointments",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <AppointmentsPage />
          </ProtectedRoute>
        ),
        handle: { title: "Appointments" },
      },
      {
        path: "calendar",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <CalendarPage />
          </ProtectedRoute>
        ),
        handle: { title: "Calendar" },
      },
      {
        path: "inventory",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <InventoryPage />
          </ProtectedRoute>
        ),
        handle: { title: "Internal Inventory Management" },
      },
      {
        path: "invoices",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <InvoicePage />
          </ProtectedRoute>
        ),
        handle: { title: "Invoices" },
      },
      {
        path: "reports",
        element: (
          <ProtectedRoute allowedRoles={ADMIN_ONLY}>
            <ReportsPage />
          </ProtectedRoute>
        ),
        handle: { title: "Clinical & Business Reports" },
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute allowedRoles={ADMIN_ONLY}>
            <SettingsPage />
          </ProtectedRoute>
        ),
        handle: { title: "Settings" },
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <ProfilePage />
          </ProtectedRoute>
        ),
        handle: { title: "My Profile" },
      },
      {
        path: "notifications",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <NotificationHistoryPage />
          </ProtectedRoute>
        ),
        handle: { title: "Notification Center" },
      },
      {
        path: "client-notifications",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <ClientNotificationHistoryPage />
          </ProtectedRoute>
        ),
        handle: { title: "Client Notifications" },
      }
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  }
]);
