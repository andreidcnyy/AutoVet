import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Dashboard from './pages/Dashboard';
import AddPet from './pages/AddPet';
import EditPet from './pages/EditPet';
import BookAppointment from './pages/BookAppointment';
import PetProfile from './pages/PetProfile';
import Appointments from './pages/Appointments';
import Notifications from './pages/Notifications';
import Invoices from './pages/Invoices';
import AccountPendingDeletion from './pages/AccountPendingDeletion';
import MaintenancePage from './pages/MaintenancePage';
import PortalLayout from './components/PortalLayout';
import { useAuth } from './context/AuthContext';
import RouterErrorElement from './components/RouterErrorElement';
import { triggerSync } from './api';
import WarningPopup from './components/WarningPopup';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    const onMaintenance = () => setMaintenance(true);
    window.addEventListener('maintenance-mode', onMaintenance);
    return () => window.removeEventListener('maintenance-mode', onMaintenance);
  }, []);

  // Guard against bfcache restoring a logged-out page
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !localStorage.getItem("user")) {
        window.location.replace("/login");
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-50 text-zinc-500 font-bold">Connecting to Pet Wellness Animal Clinic...</div>;

  if (!user) return <Navigate to="/login" replace />;

  if (user.account_pending_deletion) return <AccountPendingDeletion />;

  if (maintenance) return <MaintenancePage />;

  return (
    <>
      <WarningPopup />
      <PortalLayout>{children}</PortalLayout>
    </>
  );
}

function AppContent() {
  const { user } = useAuth();

  // --- AUTOMATIC SYNC HEARTBEAT ---
  // This triggers a background sync every 5 seconds as long as the app is open.
  useEffect(() => {
    if (!user) return;

    // Initial trigger
    triggerSync().catch(() => {});

    const interval = setInterval(() => {
      triggerSync().catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  const router = createBrowserRouter([
    {
      path: "/",
      element: user ? <Navigate to="/dashboard" replace /> : <Landing />,
      errorElement: <RouterErrorElement />
    },
    {
      path: "/login",
      element: <Login />,
      errorElement: <RouterErrorElement />
    },
    {
      path: "/register",
      element: <Register />,
      errorElement: <RouterErrorElement />
    },
    {
      path: "/forgot-password",
      element: <ForgotPassword />,
      errorElement: <RouterErrorElement />
    },
    {
      path: "/reset-password",
      element: <ResetPassword />,
      errorElement: <RouterErrorElement />
    },
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      ),
      errorElement: <RouterErrorElement />
    },
    {
      path: "/add-pet",
      element: (
        <ProtectedRoute>
          <AddPet />
        </ProtectedRoute>
      ),
      errorElement: <RouterErrorElement />
    },
    {
      path: "/pets/:id",
      element: (
        <ProtectedRoute>
          <PetProfile />
        </ProtectedRoute>
      ),
      errorElement: <RouterErrorElement />
    },
    {
      path: "/pets/:id/edit",
      element: (
        <ProtectedRoute>
          <EditPet />
        </ProtectedRoute>
      ),
      errorElement: <RouterErrorElement />
    },
    {
      path: "/book",
      element: (
        <ProtectedRoute>
          <BookAppointment />
        </ProtectedRoute>
      ),
      errorElement: <RouterErrorElement />
    },
    {
      path: "/appointments",
      element: (
        <ProtectedRoute>
          <Appointments />
        </ProtectedRoute>
      ),
      errorElement: <RouterErrorElement />
    },
    {
      path: "/notifications",
      element: (
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      ),
      errorElement: <RouterErrorElement />
    },
    {
      path: "/invoices",
      element: (
        <ProtectedRoute>
          <Invoices />
        </ProtectedRoute>
      ),
      errorElement: <RouterErrorElement />
    },
    {
      path: "/terms",
      element: <TermsOfService />,
      errorElement: <RouterErrorElement />
    },
    {
      path: "/privacy-policy",
      element: <PrivacyPolicy />,
      errorElement: <RouterErrorElement />
    },
    {
      path: "*",
      element: <Navigate to="/" replace />
    }
  ]);

  return <RouterProvider router={router} />;
}

export default AppContent;
