import React, { useMemo, useState, useEffect } from "react";
import { Outlet, useMatches, useNavigate, useLocation } from "react-router-dom";
import { NewItemsProvider, useNewItems } from "../context/NewItemsContext";
import Sidebar from "../components/layout/Sidebar";
import TopHeader from "../components/layout/TopHeader";
import BroadcastBanner from "../components/ui/BroadcastBanner";
import {
  bottomNavigation,
  clinicInfo,
  primaryNavigation,
} from "../config/navigation";
import { useAuth } from "../context/AuthContext";
import { ROLES, VET_AND_ADMIN } from "../constants/roles";
import api, { triggerSync } from "../api";
import autovetLogo from "../assets/autovet-logo.png";

function AppLayoutInner() {
  const { user, loading, login: setUser } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const { patientCount, appointmentCount, invoiceCount, markPatientsSeen, markAppointmentsSeen } = useNewItems();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [clinic, setClinic] = useState(() => {
    if (user?.role === ROLES.SUPER_ADMIN) {
      return {
        name: "DIGIVET",
        subtitle: "Platform Management",
        logo: autovetLogo
      };
    }
    return clinicInfo;
  });

  // Keep clinic info updated if it changes (e.g. from an API response later)
  useEffect(() => {
     if (user?.role !== ROLES.SUPER_ADMIN) {
        setClinic(clinicInfo);
     }
  }, [user]);
  
  const matches = useMatches();
  const navigate = useNavigate();
  const [isMaintenance, setIsMaintenance] = useState(false);

  // Mark pages as seen when navigating to them (clears badge + stamps timestamp)
  React.useEffect(() => {
    if (location.pathname.startsWith("/patients"))     markPatientsSeen();
    if (location.pathname.startsWith("/appointments")) markAppointmentsSeen();
  }, [location.pathname]);

  // --- AUTOMATIC SYNC HEARTBEAT ---
  // This triggers a background sync every 5 seconds as long as the dashboard is open.
  React.useEffect(() => {
    if (!user || isSuperAdmin) return;

    // Initial trigger
    triggerSync().catch(() => {});

    const interval = setInterval(() => {
      triggerSync().catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [user, isSuperAdmin]);

  // Fetch active announcements for clinic users
  React.useEffect(() => {
    if (!user || isSuperAdmin) {
       setAnnouncements([]);
       return;
    }

    const fetchAnnouncements = () => {
        api.get('/api/system-announcements?target=admin')
            .then(res => {
                if (Array.isArray(res)) setAnnouncements(prev =>
                    JSON.stringify(prev) === JSON.stringify(res) ? prev : res
                );
            })
            .catch(err => {
                console.error("Failed to load announcements", err);
                setAnnouncements([]);
            });
    };

    fetchAnnouncements();
  }, [user, isSuperAdmin]);

  // Dynamically change browser tab branding for Super Admin ONLY
  React.useEffect(() => {
    const originalTitle = "Pet Wellness Animal Clinic | Digivet";
    const originalFavicon = "/favicon.png";
    const faviconElement = document.getElementById("favicon");

    if (isSuperAdmin) {
      document.title = "DIGIVET | System Owner";
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
            if (data.clinic_logo && typeof data.clinic_logo === 'string' && data.clinic_logo.length > 5) {
              const v = data.clinic_logo.trim();
              const looksValid = v.startsWith('http') || v.startsWith('data:') || /\.(png|jpe?g|webp|gif|svg)$/i.test(v);
              if (looksValid) {
                const logoUrl = v.startsWith('http') || v.startsWith('data:')
                  ? v
                  : `https://zhujxjkusoetamtpotjh.supabase.co/storage/v1/object/public/autovet-storage/${v}`;
                setClinic((prev) => ({ ...prev, logo: logoUrl }));
              }
            }
          }
        })
        .catch(console.error);
    } else if (isSuperAdmin) {
      setClinic({
        name: "DIGIVET",
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
    const onPatients     = location.pathname.startsWith("/patients");
    const onAppointments = location.pathname.startsWith("/appointments");
    return primaryNavigation
      .filter((item) => {
        if (!item.allowedRoles?.includes(user.role)) return false;
        if (item.aiOnly && !user.ai_features_enabled) return false;
        return true;
      })
      .map((item) => {
        if (item.id === "patients"     && patientCount     > 0 && !onPatients)
          return { ...item, newCount: patientCount };
        if (item.id === "appointments" && appointmentCount > 0 && !onAppointments)
          return { ...item, newCount: appointmentCount };
        if (item.id === "invoices" && invoiceCount > 0)
          return { ...item, newCount: invoiceCount };
        return item;
      });
  }, [user, patientCount, appointmentCount, invoiceCount, location.pathname]);

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
          {announcements.length > 0 && (
            <div className="mb-6">
              <BroadcastBanner announcements={announcements} />
            </div>
          )}
          <Outlet context={{ user, setUser }} />
        </main>
      </div>
    </div>
  );
}

function AppLayout() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  return (
    <NewItemsProvider enabled={!!user && !isSuperAdmin}>
      <AppLayoutInner />
    </NewItemsProvider>
  );
}

export default AppLayout;

