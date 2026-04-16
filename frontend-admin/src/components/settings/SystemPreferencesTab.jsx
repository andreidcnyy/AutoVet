import { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import Toggle from "./Toggle";

export default function SystemPreferencesTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [aiForecasting, setAiForecasting] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [cloudSync, setCloudSync] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) return;
    fetch("/api/settings", {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        setMaintenanceMode(data.maintenance_mode === 'true' || data.maintenance_mode === true);
        setAiForecasting(data.enable_ai_forecasting !== 'false' && data.enable_ai_forecasting !== false);
        setLowStockAlerts(data.enable_low_stock_alerts !== 'false' && data.enable_low_stock_alerts !== false);
        setCloudSync(data.enable_cloud_sync === 'true' || data.enable_cloud_sync === true);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  }, [user?.token]);

  const updateSetting = async (key, value) => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify({ settings: { [key]: value ? 'true' : 'false' } })
      });
      toast.success("Preference updated successfully.");
    } catch {
      toast.error("Failed to update settings.");
    }
  };

  const toggleMaintenance = () => {
    const newValue = !maintenanceMode;
    setMaintenanceMode(newValue);
    updateSetting('maintenance_mode', newValue);
  };

  const toggleAiForecasting = () => {
    const newValue = !aiForecasting;
    setAiForecasting(newValue);
    updateSetting('enable_ai_forecasting', newValue);
  };

  const toggleLowStockAlerts = () => {
    const newValue = !lowStockAlerts;
    setLowStockAlerts(newValue);
    updateSetting('enable_low_stock_alerts', newValue);
  };

  const toggleCloudSync = () => {
    const newValue = !cloudSync;
    setCloudSync(newValue);
    updateSetting('enable_cloud_sync', newValue);
  };

  const [processingBackup, setProcessingBackup] = useState(false);

  const initiateManualBackup = async () => {
    setProcessingBackup(true);
    toast.info("Manual database backup initiated...");
    try {
      const res = await fetch("/api/backups", { 
        method: "POST",
        headers: {
          "Authorization": `Bearer ${user?.token}`,
          "Accept": "application/json"
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create backup");
      toast.success(data.message || "Backup created successfully.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingBackup(false);
    }
  };

  if (loading) return <div className="p-6 text-zinc-500">Loading system preferences...</div>;

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">System &amp; AI Preferences</h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Adjust automation and notification behavior.</p>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Enable AI Inventory Forecasting</p>
          <Toggle checked={aiForecasting} onChange={toggleAiForecasting} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Low Stock Email Alerts</p>
          <Toggle checked={lowStockAlerts} onChange={toggleLowStockAlerts} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">System Maintenance Mode</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Temporarily blocks users from accessing the clinic system.</p>
          </div>
          <Toggle checked={maintenanceMode} onChange={toggleMaintenance} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-dark-border dark:bg-dark-surface">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Auto-sync with Cloud Server</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Syncs offline local data when internet is available.</p>
          </div>
          <Toggle checked={cloudSync} onChange={toggleCloudSync} />
        </div>
      </div>

      <button
        onClick={initiateManualBackup}
        disabled={processingBackup}
        className="mt-7 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:bg-dark-surface disabled:opacity-50"
      >
        {processingBackup ? "Processing Backup..." : "Perform Manual Backup"}
      </button>
    </section>
  );
}
