import React, { useMemo, useState } from "react";
import { Outlet, useMatches, useNavigate } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import TopHeader from "../components/layout/TopHeader";
import {
  bottomNavigation,
  clinicInfo,
  primaryNavigation,
} from "../config/navigation";
import { useAuth } from "../context/AuthContext";

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clinic, setClinic] = useState(clinicInfo);
  const matches = useMatches();
  const navigate = useNavigate();
  const { user, loading, login: setUser } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);

  // If not authenticated, redirect to login (useEffect to avoid render loop)
  React.useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  React.useEffect(() => {
    if (user && user.token) {
      fetch("/api/settings", {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.clinic_name) {
            setClinic((prev) => ({ ...prev, name: data.clinic_name }));
          }
          if (data.clinic_logo) {
            setClinic((prev) => ({ ...prev, logo: data.clinic_logo }));
          }
        })
        .catch(console.error);
    }
  }, [user]);

  const pageTitle = useMemo(() => {
    const titledMatch = [...matches].reverse().find((match) => match.handle?.title);
    return titledMatch?.handle?.title ?? "AutoVet";
  }, [matches]);

  if (loading || !user) return null;

  if (isMaintenance && user?.role !== "Admin" && user?.role !== "Chief Veterinarian") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-dark-bg">
        <div className="mb-4 rounded-full bg-amber-100 p-4 dark:bg-amber-900/30">
          <svg className="h-10 w-10 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">System Under Maintenance</h1>
        <p className="mt-2 max-w-md text-slate-500 dark:text-zinc-400">
          We are currently performing routine maintenance. Please check back later.
        </p>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
      <Sidebar
        items={primaryNavigation}
        bottomItems={bottomNavigation}
        clinic={clinic}
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="md:pl-64">
        <TopHeader
          title={pageTitle}
          user={user}
          onMenuToggle={() => setIsSidebarOpen((prev) => !prev)}
        />

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet context={{ user, setUser }} />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;

