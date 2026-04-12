import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-50 text-zinc-500 font-bold">Connecting to Pet Wellness Animal Clinic...</div>;
  
  if (!user) return <Navigate to="/login" replace />;
  
  return <PortalLayout>{children}</PortalLayout>;
}

function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Portal Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/add-pet" element={
          <ProtectedRoute>
            <AddPet />
          </ProtectedRoute>
        } />

        <Route path="/pets/:id" element={
          <ProtectedRoute>
            <PetProfile />
          </ProtectedRoute>
        } />

        <Route path="/pets/:id/edit" element={
          <ProtectedRoute>
            <EditPet />
          </ProtectedRoute>
        } />

        <Route path="/book" element={
          <ProtectedRoute>
            <BookAppointment />
          </ProtectedRoute>
        } />

        <Route path="/appointments" element={
          <ProtectedRoute>
            <Appointments />
          </ProtectedRoute>
        } />

        <Route path="/notifications" element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        } />

        <Route path="/invoices" element={
          <ProtectedRoute>
            <Invoices />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
