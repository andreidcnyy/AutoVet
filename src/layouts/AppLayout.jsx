import { useMemo, useState, useEffect } from "react";
import { Outlet, useMatches } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import TopHeader from "../components/layout/TopHeader";
import {
  bottomNavigation,
  clinicInfo,
  currentUser as initialUser,
  primaryNavigation,
} from "../config/navigation";

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(initialUser);
  const matches = useMatches();

  useEffect(() => {
    fetch("/api/profile")
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setUser({
            name: data.name || user.name,
            role: data.role || user.role,
            email: data.email || user.email,
            avatar: data.avatar || user.avatar,
          });
        }
      })
      .catch(err => console.error("Error fetching global profile data", err));
  }, []);

  const pageTitle = useMemo(() => {
    const titledMatch = [...matches].reverse().find((match) => match.handle?.title);
    return titledMatch?.handle?.title ?? "AutoVet";
  }, [matches]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
      <Sidebar
        items={primaryNavigation}
        bottomItems={bottomNavigation}
        clinic={clinicInfo}
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

