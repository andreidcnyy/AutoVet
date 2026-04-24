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
import { ROLES, VET_AND_ADMIN } from "../constants/roles";
import api from "../api";
import autovetLogo from "../assets/autovet-logo.png";
import clsx from "clsx";

function AppLayout() {
  const { user, loading, login: setUser } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [clinic, setClinic] = useState(() => {
    if (user?.role === ROLES.SUPER_ADMIN) {
      return {
        name: "AUTOVET",
        subtitle: "Platform Management",
        logo: autovetLogo
      };
    }
    return clinicInfo;
  });
  
  const matches = useMatches();
  const navigate = useNavigate();
  const [isMaintenance, setIsMaintenance] = useState(false);

  // Fetch active announcements for clinic users
  React.useEffect(() => {
    if (user && !isSuperAdmin) {
       api.get('/api/system-announcements')
        .then(res => {
          if (Array.isArray(res)) setAnnouncements(res);
        })
        .catch(err => {
          console.error("Failed to load announcements", err);
          setAnnouncements([]);
        });
    }
  }, [user, isSuperAdmin]);

  // Dynamically change browser tab branding for Super Admin ONLY
  React.useEffect(() => {
    const originalTitle = "Pet Wellness Animal Clinic | AutoVet";
    const originalFavicon = "/favicon.png";
    const faviconElement = document.getElementById("favicon");

    if (isSuperAdmin) {
      document.title = "AUTOVET | System Owner";
      if (faviconElement) {
        faviconElement.href = autovetLogo;
      }
    } else {
      document.title = originalTitle;
      if (faviconElement) {
        faviconElement.href = originalFavicon;
      }
    }

    return () => {
      // Clean up on unmount or role change
      document.title = originalTitle;
      if (faviconElement) {
        faviconElement.href = originalFavicon;
      }
    };
  }, [isSuperAdmin]);

  React.useEffect(() => {
    if (user && user.token && !isSuperAdmin) {
      api.get('/api/settings', { cache: true })
        .then((data) => {
          if (data && typeof data === 'object') {
            if (data.clinic_name) {
              const name = typeof data.clinic_name === 'string' ? data.clinic_name : String(data.clinic_name?.message || data.clinic_name?.text || 'Pet Wellness');
              setClinic((prev) => ({ ...prev, name }));
            }
            if (data.clinic_logo && typeof data.clinic_logo === 'string') {
              setClinic((prev) => ({ ...prev, logo: data.clinic_logo }));
            }
          }
        })
        .catch(console.error);
    } else if (isSuperAdmin) {
      setClinic({
        name: "AUTOVET",
        subtitle: "Platform Management",
        logo: autovetLogo
      });
    }
  }, [user, isSuperAdmin]);

  const pageTitle = useMemo(() => {
    const titledMatch = [...matches].reverse().find((match) => match.handle?.title);
    return titledMatch?.handle?.title ?? "Pet Wellness";
  }, [matches]);

  // Redundant loading/user check removed as ProtectedRoute guards the entire layout.

  if (isMaintenance && !VET_AND_ADMIN.includes(user?.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center dark:bg-dark-bg">
        <div className="mb-4 rounded-full bg-amber-100 p-4 dark:bg-amber-900/30">
          <svg className="h-10 w-10 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">System Under Maintenance</h1>
        <p className="mt-2 max-w-md text-zinc-500 dark:text-zinc-400">
          We are currently performing routine maintenance. Please check back later.
        </p>
      </div>
    );
  }


  const filteredPrimaryNav = useMemo(() => {
    if (!user || !user.role) return [];
    return primaryNavigation.filter((item) => item.allowedRoles?.includes(user.role));
  }, [user]);

  const filteredBottomNav = useMemo(() => {
    if (!user || !user.role) return [];
    return bottomNavigation.filter((item) => item.allowedRoles?.includes(user.role));
  }, [user]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300">
      <Sidebar
        items={filteredPrimaryNav}
        bottomItems={filteredBottomNav}
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
          {/* System Announcements */}
          {announcements.map(ann => (
            <div key={ann.id} className={clsx(
              "mb-6 rounded-2xl p-4 shadow-sm border-l-4 animate-in slide-in-from-top duration-300",
              ann.type === 'warning' ? "bg-amber-50 border-amber-500 text-amber-800" :
              ann.type === 'error' ? "bg-rose-50 border-rose-500 text-rose-800" :
              ann.type === 'success' ? "bg-emerald-50 border-emerald-500 text-emerald-800" :
              "bg-blue-50 border-blue-500 text-blue-800"
            )}>
              <div className="flex items-center gap-3">
                 <span className="text-lg">📢</span>
                 <div>
                    <p className="font-black uppercase text-[10px] tracking-widest opacity-60">{ann.title}</p>
                    <p className="font-bold text-sm">{ann.message}</p>
                 </div>
              </div>
            </div>
          ))}

          <Outlet context={{ user, setUser }} />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;

