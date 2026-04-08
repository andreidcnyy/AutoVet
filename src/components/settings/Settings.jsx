import clsx from "clsx";
import { useState } from "react";
import { FiHome, FiSettings, FiUsers, FiBriefcase, FiArchive, FiActivity, FiDatabase } from "react-icons/fi";

import ClinicProfileTab from "./ClinicProfileTab";
import UserManagementTab from "./UserManagementTab";
import ServiceManagementTab from "./ServiceManagementTab";
import MasterDataManagementTab from "./MasterDataManagementTab";
import SystemPreferencesTab from "./SystemPreferencesTab";
import ArchiveRecoveryTab from "./ArchiveRecoveryTab";
import AuditLogTab from "./AuditLogTab";
import BackupRestoreTab from "./BackupRestoreTab";

import SpeciesBreedsTab from "./SpeciesBreedsTab";
import VetScheduleTab from "./VetScheduleTab";
import NotificationTemplatesManager from "../notifications/NotificationTemplatesManager";

const tabs = [
  { id: "clinic", label: "Clinic Profile", icon: FiHome },
  { id: "data", label: "Master Data", icon: FiSettings },
  { id: "services", label: "Service Management", icon: FiBriefcase },
  { id: "species", label: "Species & Breeds", icon: FiHome },
  { id: "users", label: "Users / Roles", icon: FiUsers },
  { id: "schedule", label: "Vet Schedule", icon: FiBriefcase },
  { id: "system", label: "System & AI Preferences", icon: FiSettings },
  { id: "audit", label: "System Audit Logs", icon: FiActivity },
  { id: "backup", label: "Backup & Restore", icon: FiDatabase },
  { id: "archive", label: "Archive & Recovery", icon: FiArchive },
  { id: "client_notifications", label: "Notification Templates", icon: FiSettings },
];

function Settings() {
  const [activeTab, setActiveTab] = useState("data");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="sticky top-24 h-fit space-y-4">
        <div className="card-shell p-2">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200",
                    active 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-dark-surface dark:hover:text-zinc-100"
                  )}
                >
                  <Icon className={clsx("h-4 w-4 shrink-0 transition-transform duration-200", active && "scale-110")} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Help/Inspiration Card (Optional but looks premium) */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-xl shadow-blue-500/10">
          <p className="text-xs font-bold uppercase tracking-wider opacity-60">Pro Tip</p>
          <p className="mt-1 text-xs leading-relaxed font-medium">
            Use Master Data to standardize categories across the entire clinic workflow.
          </p>
        </div>
      </aside>

      <main className="min-w-0">
        {activeTab === "clinic" && <ClinicProfileTab />}
        {activeTab === "data" && <MasterDataManagementTab />}
        {activeTab === "services" && <ServiceManagementTab />}
        {activeTab === "species" && <SpeciesBreedsTab />}
        {activeTab === "users" && <UserManagementTab />}
        { activeTab === "schedule" && <VetScheduleTab /> }
        { activeTab === "system" && <SystemPreferencesTab /> }
        { activeTab === "audit" && <AuditLogTab /> }
        { activeTab === "backup" && <BackupRestoreTab /> }
        { activeTab === "archive" && <ArchiveRecoveryTab /> }
        { activeTab === "client_notifications" && <NotificationTemplatesManager /> }
      </main>
    </div>
  );
}

export default Settings;
