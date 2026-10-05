import { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import Toggle from "./Toggle";
import MaintenanceModeCard from "./MaintenanceModeCard";

export default function SystemPreferencesTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [aiForecasting, setAiForecasting] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) return;

    const CACHE_KEY = 'settings_clinic_cache';
    const CACHE_TTL = 5 * 60 * 1000;

    const applyData = (data) => {
      // Maintenance is no longer a plain setting — MaintenanceModeCard owns it
      // and reads the scheduled window from /api/maintenance-status.
      setAiForecasting(data.enable_ai_forecasting !== 'false' && data.enable_ai_forecasting !== false);
      setLowStockAlerts(data.enable_low_stock_alerts !== 'false' && data.enable_low_stock_alerts !== false);
    };

    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL && cached.data) {
        applyData(cached.data);
        setLoading(false);
      }
    } catch (_) {}

    const controller = new AbortController();
    fetch("/api/settings", {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        applyData(data);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch (_) {}
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setLoading(false);
      });

    return () => controller.abort();
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

        <MaintenanceModeCard />
      </div>

    </section>
  );
}
