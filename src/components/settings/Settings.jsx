import clsx from "clsx";
import { useState } from "react";
import { FiHome, FiSave, FiSettings, FiTrash2, FiUserPlus, FiUsers } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";

const tabs = [
  { id: "clinic", label: "Clinic Profile", icon: FiHome },
  { id: "users", label: "User Management", icon: FiUsers },
  { id: "system", label: "System & AI Preferences", icon: FiSettings },
];

const staffMembers = [
  { id: "u-1", name: "Dr. Sarah Jenkins", role: "Admin", status: "Active" },
  { id: "u-2", name: "Dr. Michael Ross", role: "Veterinarian", status: "Active" },
  { id: "u-3", name: "Emma Carter", role: "Staff", status: "Active" },
  { id: "u-4", name: "Kevin Patel", role: "Staff", status: "Inactive" },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={clsx(
        "relative inline-flex h-6 w-11 items-center rounded-full transition",
        checked ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-600"
      )}
    >
      <span
        className={clsx(
          "inline-block h-4 w-4 transform rounded-full bg-white transition",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function ClinicProfileTab() {
  const toast = useToast();
  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Clinic Profile</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage core clinic details and billing defaults.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Clinic Name</label>
          <input
            defaultValue="AutoVet Downtown Clinic"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Primary Email</label>
          <input
            defaultValue="support@autovetclinic.com"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Phone Number</label>
          <input
            defaultValue="(415) 555-0123"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Address</label>
          <input
            defaultValue="1234 Veterinary Lane, San Francisco, CA 94103"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6 dark:border-dark-border">
        <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Billing Settings</h4>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Default Tax Rate (%)</label>
            <input defaultValue="8.0" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Currency</label>
            <input defaultValue="USD ($)" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
      </div>

      <button
        onClick={() => toast.success("Clinic profile changes saved securely.")}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <FiSave className="h-4 w-4" />
        Save Changes
      </button>
    </section>
  );
}

function UserManagementTab() {
  const toast = useToast();
  return (
    <section className="card-shell p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">User Management</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Role-based access for clinic staff.</p>
        </div>
        <button onClick={() => toast.info("User creation form opened.")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          <FiUserPlus className="h-4 w-4" />
          Add New User
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {staffMembers.map((member) => (
              <tr key={member.id} className="border-b border-slate-200/80 dark:border-dark-border">
                <td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-zinc-50">{member.name}</td>
                <td className="px-4 py-4 text-sm text-slate-700 dark:text-zinc-300">{member.role}</td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                      member.status === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-100 text-slate-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400"
                    )}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toast.info(`Edit details for ${member.name}`)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface">Edit</button>
                    <button onClick={() => toast.warning(`Requested deletion for ${member.name}`)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30">
                      <FiTrash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SystemPreferencesTab() {
  const toast = useToast();
  const [aiForecasting, setAiForecasting] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [cloudSync, setCloudSync] = useState(false);

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">System &amp; AI Preferences</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Adjust automation and notification behavior.</p>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Enable AI Inventory Forecasting</p>
          <Toggle checked={aiForecasting} onChange={() => setAiForecasting((value) => !value)} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Low Stock Email Alerts</p>
          <Toggle checked={lowStockAlerts} onChange={() => setLowStockAlerts((value) => !value)} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Auto-sync with Cloud Server</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Syncs offline local data when internet is available.</p>
          </div>
          <Toggle checked={cloudSync} onChange={() => setCloudSync((value) => !value)} />
        </div>
      </div>

      <button
        onClick={() => toast.info("Manual database backup initiated...")}
        className="mt-7 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:bg-dark-surface"
      >
        Perform Manual Backup
      </button>
    </section>
  );
}

function Settings() {
  const [activeTab, setActiveTab] = useState("clinic");

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
        {activeTab === "users" && <UserManagementTab />}
        {activeTab === "system" && <SystemPreferencesTab />}
      </main>
    </div>
  );
}

export default Settings;
