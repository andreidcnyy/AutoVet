import clsx from "clsx";
import { useState } from "react";
import { FiHome, FiSettings, FiUsers, FiBriefcase } from "react-icons/fi";

import ClinicProfileTab from "./ClinicProfileTab";
import UserManagementTab from "./UserManagementTab";
import ServiceManagementTab from "./ServiceManagementTab";
import DataManagementTab from "./DataManagementTab";
import SystemPreferencesTab from "./SystemPreferencesTab";

import SpeciesBreedsTab from "./SpeciesBreedsTab";
import VetScheduleTab from "./VetScheduleTab";

const tabs = [
  { id: "clinic", label: "Clinic Profile", icon: FiHome },
  { id: "data", label: "Data Lists", icon: FiSettings },
  { id: "services", label: "Service Management", icon: FiBriefcase },
  { id: "species", label: "Species & Breeds", icon: FiHome },
  { id: "users", label: "Users / Roles", icon: FiUsers },
  { id: "schedule", label: "Vet Schedule", icon: FiBriefcase },
  { id: "system", label: "System & AI Preferences", icon: FiSettings },
];

function Settings() {
  const [activeTab, setActiveTab] = useState("data");

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr]">
      <aside className="card-shell h-fit p-3">
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                  active ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main>
        {activeTab === "clinic" && <ClinicProfileTab />}
        {activeTab === "data" && <DataManagementTab />}
        {activeTab === "services" && <ServiceManagementTab />}
        {activeTab === "species" && <SpeciesBreedsTab />}
        {activeTab === "users" && <UserManagementTab />}
        {activeTab === "schedule" && <VetScheduleTab />}
        {activeTab === "system" && <SystemPreferencesTab />}
      </main>
    </div>
  );
}

export default Settings;
