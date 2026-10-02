import { useEffect, useState, lazy, Suspense } from 'react'; // useState kept for ProtectedRoute maintenance state
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';

import MaintenancePage from './pages/MaintenancePage';
import MaintenanceBanner from './components/MaintenanceBanner';
import { useMaintenanceWindow } from './hooks/useMaintenanceWindow';
import PortalLayout from './components/PortalLayout';
import { useAuth } from './context/AuthContext';
import RouterErrorElement from './components/RouterErrorElement';
import WarningPopup from './components/WarningPopup';

/**
 * Each page becomes its own chunk, fetched the first time its route is opened,
 * instead of every page being parsed before the first paint. The wrapper owns
 * its Suspense boundary so the route tree stays written as it was.
 */
const RouteFallback = () => (
  <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-brand-500 dark:border-zinc-700" />
  </div>
);

// Every page loader, so they can be warmed once the browser is idle.
const pageLoaders: Array<() => Promise<unknown>> = [];

const lazyPage = <P extends object>(loader: () => Promise<{ default: React.ComponentType<P> }>) => {
  pageLoaders.push(loader);
  const Loaded = lazy(loader);
  return (props: P) => (
    <Suspense fallback={<RouteFallback />}>
      <Loaded {...props} />
    </Suspense>
  );
};

const Login = lazyPage(() => import('./Login'));
const Register = lazyPage(() => import('./pages/Register'));
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
const TermsOfService = lazyPage(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazyPage(() => import('./pages/PrivacyPolicy'));
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const AddPet = lazyPage(() => import('./pages/AddPet'));
const EditPet = lazyPage(() => import('./pages/EditPet'));
const BookAppointment = lazyPage(() => import('./pages/BookAppointment'));
const PetProfile = lazyPage(() => import('./pages/PetProfile'));
const Appointments = lazyPage(() => import('./pages/Appointments'));
const Notifications = lazyPage(() => import('./pages/Notifications'));
const Invoices = lazyPage(() => import('./pages/Invoices'));
const AccountPendingDeletion = lazyPage(() => import('./pages/AccountPendingDeletion'));
const AccountBlockedPage = lazyPage(() => import('./pages/AccountBlockedPage'));

const schedule = (fn: () => void) =>
  typeof (window as any).requestIdleCallback === "function"
    ? (window as any).requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 200);

/**
 * Warms every page chunk in the background once the browser is idle.
 *
 * Splitting the pages halved the first load but moved the cost to navigation:
 * each page fetched its chunk the first time it was opened, which showed as a
 * spinner on every tab change. Warming them during idle time keeps the small
 * initial bundle and makes switching instant. Sequential, so the prefetch does
 * not compete with data the visible page is still loading.
 */
function prefetchPages() {
  let i = 0;
  const next = () => {
    if (i >= pageLoaders.length) return;
    const load = pageLoaders[i++];
    Promise.resolve().then(load).catch(() => {}).finally(() => schedule(next));
  };
  schedule(next);
}

if (typeof window !== "undefined") {
  setTimeout(prefetchPages, 1500);
}

function ProtectedRoute({ children }: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const [maintenance, setMaintenance] = useState(false);
  const [blocked, setBlocked] = useState<{ status: 'suspended' | 'deactivated'; message?: string } | null>(null);

  // The scheduled window, polled directly. This is what lets the portal show a
  // countdown during the warning period, before any request has been refused.
  const maintenanceWindow = useMaintenanceWindow();
  const { remaining, refresh: refreshMaintenance } = maintenanceWindow;

  useEffect(() => {
    const onMaintenance = () => setMaintenance(true);
    const onBlocked = (e: any) => setBlocked(e.detail);
    window.addEventListener('maintenance-mode', onMaintenance);
    window.addEventListener('portal-account-blocked', onBlocked);
    return () => {
      window.removeEventListener('maintenance-mode', onMaintenance);
      window.removeEventListener('portal-account-blocked', onBlocked);
    };
  }, []);

  // Real-time portal status updates via WebSocket
  useEffect(() => {
    if (!user?.id) return;
    let channel: any;
    import('./utils/echo').then(({ default: echo }) => {
      channel = echo.private(`client.portal.${user.id}`);
      channel.listen('.portal.status.changed', (e: any) => {
        if (e.status === 'suspended' || e.status === 'deactivated') {
          setBlocked({ status: e.status, message: e.message });
        } else if (e.status === 'active') {
          // Token was wiped on suspend; user must log in again for a fresh token
          logout();
        }
      });
    });
    return () => {
      if (channel) channel.stopListening('.portal.status.changed');
    };
  }, [user?.id, logout]);

  // Poll every 15 s while in maintenance mode — clear when backend responds normally
  useEffect(() => {
    if (!maintenance || !user) return;
    const check = async () => {
      try {
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${user.token}`, Accept: 'application/json' },
        });
        if (res.status !== 503) {
          setMaintenance(false);
          refreshMaintenance();
        }
      } catch (_) {}
    };
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [maintenance, user, refreshMaintenance]);

  // The window is authoritative: it turns the page on at the scheduled moment
  // without waiting for a request to be refused, and takes it away again the
  // moment the window closes.
  useEffect(() => {
    if (maintenanceWindow.active) setMaintenance(true);
    else setMaintenance(false);
  }, [maintenanceWindow.active]);

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

  if (blocked) return <AccountBlockedPage status={blocked.status} message={blocked.message} />;

  if (maintenance) {
    return (
      <MaintenancePage
        secondsRemaining={maintenanceWindow.hasEndTime ? remaining : null}
        message={maintenanceWindow.message}
      />
    );
  }

  return (
    <>
      {maintenanceWindow.upcoming && remaining !== null && (
        <MaintenanceBanner
          secondsRemaining={remaining}
          message={maintenanceWindow.message}
        />
      )}
      <WarningPopup />
      <PortalLayout>{children}</PortalLayout>
    </>
  );
}

function AppContent() {
  const { user } = useAuth();

  // Removed: this fired triggerSync() every 5 seconds. Being a POST, it made
  // the service worker drop its entire API cache twelve times a minute, so no
  // cached read ever survived long enough to be used. `app:sync-to-portal`
  // already runs on the server scheduler every minute.

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
  ], { basename: import.meta.env.BASE_URL });

  return <RouterProvider router={router} />;
}

export default AppContent;
