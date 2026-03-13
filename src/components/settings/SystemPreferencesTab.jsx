import { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import Toggle from "./Toggle";

export default function SystemPreferencesTab() {
  const toast = useToast();
  const [aiForecasting, setAiForecasting] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [cloudSync, setCloudSync] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setMaintenanceMode(data.maintenance_mode === 'true' || data.maintenance_mode === true);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  }, []);

  const toggleMaintenance = async () => {
    const newValue = !maintenanceMode;
    setMaintenanceMode(newValue);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ settings: { maintenance_mode: newValue ? 'true' : 'false' } })
      });
      toast.success(newValue ? "Maintenance Mode enabled." : "Maintenance Mode disabled.");
    } catch {
      toast.error("Failed to update maintenance settings.");
      setMaintenanceMode(!newValue);
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading system preferences...</div>;

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
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">System Maintenance Mode</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Temporarily blocks users from accessing the clinic system.</p>
          </div>
          <Toggle checked={maintenanceMode} onChange={toggleMaintenance} />
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
