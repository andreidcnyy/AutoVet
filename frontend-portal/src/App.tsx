import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AddPet from './pages/AddPet';
import BookAppointment from './pages/BookAppointment';
import PortalLayout from './components/PortalLayout';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-bold">Connecting to AutoVet...</div>;
  
  if (!user) return <Navigate to="/login" replace />;
  
  return <PortalLayout>{children}</PortalLayout>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Portal Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/add-pet" element={
          <ProtectedRoute>
            <AddPet />
          </ProtectedRoute>
        } />

        <Route path="/book" element={
          <ProtectedRoute>
            <BookAppointment />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
