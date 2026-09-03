import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import AppLayout from "../layouts/AppLayout";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import {
  ADMIN_ONLY,
  ALL_ROLES,
  VET_AND_ADMIN,
  SUPER_ADMIN_ONLY,
  CLINIC_ADMIN_GROUP,
  CLINIC_STAFF_ROLES,
} from "../constants/roles";

import RouterErrorElement from "../components/RouterErrorElement";

/**
 * Each page becomes its own chunk, fetched the first time its route is opened.
 * Previously every page was imported eagerly, so one bundle had to download and
 * parse before anything could render.
 *
 * The wrapper keeps its own Suspense boundary, so the route tree below is
 * written exactly as it was with eager imports.
 */
const RouteFallback = () => (
  <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-500 dark:border-zinc-700 dark:border-t-emerald-400" />
  </div>
);

// Every page loader, so they can be warmed once the app is idle.
const pageLoaders = [];

const lazyPage = (loader) => {
  pageLoaders.push(loader);
  const Loaded = lazy(loader);
  return (props) => (
    <Suspense fallback={<RouteFallback />}>
      <Loaded {...props} />
    </Suspense>
  );
};

/**
 * Warms every page chunk in the background once the browser is idle.
 *
 * Splitting the pages cut the first load roughly in half, but it moved the
 * cost to navigation: each page fetched its chunk the first time it was
 * opened, which showed as a spinner on every new tab. Fetching them during
 * idle time keeps the small initial bundle and makes switching instant, since
 * the chunk is already in the module cache by the time it is needed.
 *
 * Sequential on purpose — firing twenty parallel requests would compete with
 * the data the visible page is still loading.
 */
function prefetchPages() {
  let i = 0;
  const next = () => {
    if (i >= pageLoaders.length) return;
    const load = pageLoaders[i++];
    Promise.resolve()
      .then(load)
      .catch(() => {}) // a failed prefetch must never surface; the route retries
      .finally(() => schedule(next));
  };
  schedule(next);
}

const schedule = (fn) =>
  typeof requestIdleCallback === "function"
    ? requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 200);

// Hold off until the first screen has settled, then warm the rest.
if (typeof window !== "undefined") {
  setTimeout(prefetchPages, 1500);
}

const AppointmentsPage = lazyPage(() => import("../pages/AppointmentsPage"));
const AnalyticsPage = lazyPage(() => import("../pages/AnalyticsPage"));
const DashboardPage = lazyPage(() => import("../pages/DashboardPage"));
const InventoryPage = lazyPage(() => import("../pages/InventoryPage"));
const PatientsPage = lazyPage(() => import("../pages/PatientsPage"));
const ViewPatientProfilePage = lazyPage(() => import("../pages/ViewPatientProfilePage"));
const ProfilePage = lazyPage(() => import("../pages/ProfilePage"));
const SettingsPage = lazyPage(() => import("../pages/SettingsPage"));
const SuperAdminDashboard = lazyPage(() => import("../pages/SuperAdminDashboard"));
const SuperAdminLogs = lazyPage(() => import("../pages/SuperAdminLogs"));
const SuperAdminAnnouncements = lazyPage(() => import("../pages/SuperAdminAnnouncements"));
const LoginPage = lazyPage(() => import("../pages/LoginPage"));
const ForbiddenPage = lazyPage(() => import("../pages/ForbiddenPage"));
const CalendarPage = lazyPage(() => import("../pages/CalendarPage"));
const ChangePasswordPage = lazyPage(() => import("../pages/ChangePasswordPage"));
const NotificationHistoryPage = lazyPage(() => import("../pages/NotificationHistoryPage"));
const ClientNotificationHistoryPage = lazyPage(() => import("../pages/ClientNotificationHistoryPage"));
const AiClinicalSupportPage = lazyPage(() => import("../pages/AiClinicalSupportPage"));
const InvoicePage = lazyPage(() => import("../pages/InvoicePage"));
const ReviewsPage = lazyPage(() => import("../pages/ReviewsPage"));

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
        path: "analytics",
        element: (
          <ProtectedRoute allowedRoles={CLINIC_STAFF_ROLES}>
            <AnalyticsPage />
          </ProtectedRoute>
        ),
        handle: { title: "Data Analytics" },
      },
      {
        path: "super-admin",
        element: (
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        ),
        handle: { title: "Global SaaS Dashboard" },
      },
      {
        path: "super-admin/logs",
        element: (
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
            <SuperAdminLogs />
          </ProtectedRoute>
        ),
        handle: { title: "Super Admin Management" },
      },
      {
        path: "super-admin/announcements",
        element: (
          <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
            <SuperAdminAnnouncements />
          </ProtectedRoute>
        ),
        handle: { title: "System Broadcasts" },
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
          <ProtectedRoute allowedRoles={CLINIC_STAFF_ROLES}>
            <InventoryPage />
          </ProtectedRoute>
        ),
        handle: { title: "Internal Inventory Management" },
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute allowedRoles={VET_AND_ADMIN}>
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
      },
      {
        path: "ai-clinical",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <AiClinicalSupportPage />
          </ProtectedRoute>
        ),
        handle: { title: "AI Clinical Support" },
      },
      {
        path: "invoices",
        element: (
          <ProtectedRoute allowedRoles={CLINIC_STAFF_ROLES}>
            <InvoicePage />
          </ProtectedRoute>
        ),
        handle: { title: "Invoices" },
      },
      {
        path: "reviews",
        element: (
          <ProtectedRoute allowedRoles={VET_AND_ADMIN}>
            <ReviewsPage />
          </ProtectedRoute>
        ),
        handle: { title: "Reviews & Feedback" },
      }
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  }
]);
