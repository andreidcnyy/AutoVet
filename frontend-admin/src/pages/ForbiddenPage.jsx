import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ForbiddenPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGoBack = () => navigate("/", { replace: true });
  const handleDashboard = () => navigate("/", { replace: true });
  
  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-dark-bg transition-colors duration-300">
      <div className="mb-6 rounded-full bg-red-100 p-4 dark:bg-red-900/30">
        <svg
          className="h-10 w-10 text-red-600 dark:text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-5xl">
        Access Denied
      </h1>
      <p className="mt-4 max-w-sm text-lg text-slate-500 dark:text-zinc-400">
        You are currently logged in as <span className="font-bold text-slate-900 dark:text-zinc-200">"{user?.role || "Guest"}"</span>. 
        Your role does not have the required permissions to access this page.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleGoBack}
          className="inline-flex min-w-[12rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:ring-zinc-700 transition-all duration-200"
        >
          Go Back
        </button>
        <button
          onClick={handleDashboard}
          className="inline-flex min-w-[12rem] items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-all duration-200"
        >
          Dashboard
        </button>
        <button
          onClick={handleSignOut}
          className="inline-flex min-w-[12rem] items-center justify-center rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-300 dark:bg-rose-500 dark:hover:bg-rose-600 dark:focus:ring-rose-800 transition-all duration-200"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ForbiddenPage;
