import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";

/**
 * ProtectedRoute component - Guards routes based on authentication and roles.
 * Implements a "Default Deny" strategy for maximum security.
 */
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();

  // 1. Loading State - Prevent false redirects while the context is hydrating
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-dark-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  // 2. Authentication Check
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Authorization Check (Strict Equality & Default Deny)
  // If allowedRoles is not provided, we deny by default for security.
  if (!allowedRoles || allowedRoles.length === 0) {
    console.error("ProtectedRoute: No allowedRoles provided. Access denied by default.");
    return <Navigate to="/forbidden" replace />;
  }

  const userRole = user.role;
  const isAuthorized = allowedRoles.includes(userRole);

  if (!isAuthorized) {
    console.warn(`Unauthorized access attempt by ${userRole} to a restricted route.`);
    return <Navigate to="/forbidden" replace />;
  }

  // 4. Authorized Access - Render children or Outlet
  return children ? children : <Outlet />;
};

export default ProtectedRoute;
