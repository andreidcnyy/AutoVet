import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import AddPet from './pages/AddPet';
import EditPet from './pages/EditPet';
import BookAppointment from './pages/BookAppointment';
import PetProfile from './pages/PetProfile';
import Appointments from './pages/Appointments';
import Notifications from './pages/Notifications';
import Invoices from './pages/Invoices';
import PortalLayout from './components/PortalLayout';
import { useAuth } from './context/AuthContext';
import RouterErrorElement from './components/RouterErrorElement';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-50 text-zinc-500 font-bold">Connecting to Pet Wellness Animal Clinic...</div>;
  
  if (!user) return <Navigate to="/login" replace />;
  
  return <PortalLayout>{children}</PortalLayout>;
}

function AppContent() {
  const { user } = useAuth();

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
      path: "*",
      element: <Navigate to="/" replace />
    }
  ]);

  return <RouterProvider router={router} />;
}

export default AppContent;
