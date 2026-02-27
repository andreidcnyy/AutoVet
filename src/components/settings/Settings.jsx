import clsx from "clsx";
import { useState } from "react";
import { FiHome, FiSave, FiSettings, FiTrash2, FiUserPlus, FiUsers } from "react-icons/fi";

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
        checked ? "bg-blue-600" : "bg-slate-300"
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
  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900">Clinic Profile</h3>
      <p className="mt-1 text-sm text-slate-500">Manage core clinic details and billing defaults.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">Clinic Name</label>
          <input
            defaultValue="AutoVet Downtown Clinic"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">Primary Email</label>
          <input
            defaultValue="support@autovetclinic.com"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">Phone Number</label>
          <input
            defaultValue="(415) 555-0123"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">Address</label>
          <input
            defaultValue="1234 Veterinary Lane, San Francisco, CA 94103"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
          />
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h4 className="text-lg font-bold text-slate-900">Billing Settings</h4>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">Default Tax Rate (%)</label>
            <input defaultValue="8.0" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">Currency</label>
            <input defaultValue="USD ($)" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700" />
          </div>
        </div>
      </div>

      <button
        onClick={() => alert("Clinic profile changes saved securely.")}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <FiSave className="h-4 w-4" />
        Save Changes
      </button>
    </section>
  );
}

function UserManagementTab() {
  return (
    <section className="card-shell p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">User Management</h3>
          <p className="mt-1 text-sm text-slate-500">Role-based access for clinic staff.</p>
        </div>
        <button onClick={() => alert("User creation form opened.")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          <FiUserPlus className="h-4 w-4" />
          Add New User
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {staffMembers.map((member) => (
              <tr key={member.id} className="border-b border-slate-200/80">
                <td className="px-4 py-4 text-sm font-medium text-slate-900">{member.name}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{member.role}</td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                      member.status === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-600"
                    )}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => alert(`Edit details for ${member.name}`)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Edit</button>
                    <button onClick={() => alert(`Requested deletion for ${member.name}`)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600">
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
  const [aiForecasting, setAiForecasting] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [cloudSync, setCloudSync] = useState(false);

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900">System &amp; AI Preferences</h3>
      <p className="mt-1 text-sm text-slate-500">Adjust automation and notification behavior.</p>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Enable AI Inventory Forecasting</p>
          <Toggle checked={aiForecasting} onChange={() => setAiForecasting((value) => !value)} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Low Stock Email Alerts</p>
          <Toggle checked={lowStockAlerts} onChange={() => setLowStockAlerts((value) => !value)} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Auto-sync with Cloud Server</p>
            <p className="mt-0.5 text-xs text-slate-500">Syncs offline local data when internet is available.</p>
          </div>
          <Toggle checked={cloudSync} onChange={() => setCloudSync((value) => !value)} />
        </div>
      </div>

      <button
        onClick={() => alert("Manual database backup initiated...")}
        className="mt-7 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
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
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
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
