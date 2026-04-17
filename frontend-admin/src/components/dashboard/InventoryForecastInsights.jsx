import { useState, useEffect } from 'react';
import { LuSparkles, LuTriangleAlert, LuCircleCheck, LuActivity, LuRefreshCw } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';

export default function InventoryForecastInsights() {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchForecasts = async (isManual = false) => {
    if (!user?.token) return;
    if (isManual) setRefreshing(true);
    
    try {
      const headers = { 
        'Authorization': `Bearer ${user.token}`,
        'Accept': 'application/json'
      };
      const res = await fetch('/api/dashboard/inventory-forecast', { headers });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setForecasts(data);
    } catch (err) {
      console.error("Forecast Insights fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchForecasts();
    
    // Listen for global refresh events (e.g., from Invoice completion)
    const handleGlobalRefresh = () => {
      // Small delay to allow the background job to start processing
      setTimeout(() => fetchForecasts(true), 1500);
    };

    window.addEventListener('inventory-forecast-refresh', handleGlobalRefresh);
    
    // Auto-refresh every 2 minutes for ambient updates
    const interval = setInterval(() => fetchForecasts(), 120000);
    
    return () => {
      window.removeEventListener('inventory-forecast-refresh', handleGlobalRefresh);
      clearInterval(interval);
    };
  }, [user?.token]);

  // Handle specialized status badges
  const getStatusBadge = (status) => {
    const baseClass = "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm";
    switch (status) {
      case 'Critical':
        return <span className={`${baseClass} bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800`}>
          <LuTriangleAlert className="mr-1 w-2.5 h-2.5" /> Critical
        </span>;
      case 'Reorder Soon':
        return <span className={`${baseClass} bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800`}>
          <LuActivity className="mr-1 w-2.5 h-2.5" /> Reorder Soon
        </span>;
      case 'Safe':
        return <span className={`${baseClass} bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800`}>
          <LuCircleCheck className="mr-1 w-2.5 h-2.5" /> Safe
        </span>;
      default:
        return <span className={`${baseClass} bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700`}>
          Calculating...
        </span>;
    }
  };

  if (loading) {
    return (
      <article className="card-shell p-6 animate-pulse min-h-[300px]">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-xl" />
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="card-shell p-6 relative overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <LuSparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Inventory Forecast Insights</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">AutoVet AI Model (Linear Regression) • {forecasts.length > 0 ? `Updated ${forecasts[0].last_forecasted}` : 'Datasets synchronized'}</p>
          </div>
        </div>
        <button 
          onClick={() => fetchForecasts(true)}
          disabled={refreshing}
          className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${refreshing ? 'animate-spin cursor-not-allowed opacity-50' : ''}`}
          title="Refresh forecasts"
        >
          <LuRefreshCw className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      {forecasts.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-3xl flex-grow flex flex-col justify-center">
          <LuActivity className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">No inventory consumption data recorded yet.</p>
          <p className="text-xs text-zinc-400 mt-1 px-4">Sync datasets or finalize an invoice to trigger your first AI forecast.</p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left border-separate border-spacing-y-3">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <th className="pb-2 pl-2">Item Detail</th>
                <th className="pb-2">Inventory State</th>
                <th className="pb-2 text-center">Sales Prediction (Weekly/Monthly)</th>
                <th className="pb-2 pr-2 text-right">Model Status</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((item) => (
                <tr key={item.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors rounded-xl">
                  <td className="py-4 pl-3 bg-transparent first:rounded-l-2xl last:rounded-r-2xl border-y border-zinc-100/50 dark:border-zinc-800/50 border-l border-zinc-100/50 dark:border-zinc-800/50">
                    <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-0.5">{item.code}</p>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate max-w-[180px]">{item.item_name}</p>
                  </td>
                  <td className="py-4 bg-transparent border-y border-zinc-100/50 dark:border-zinc-800/50">
                    <div className="flex flex-col">
                      <p className="font-black text-sm text-zinc-900 dark:text-zinc-50">
                        {item.days_until_stockout !== null ? `${item.days_until_stockout}d remaining` : 'No data'}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-bold">Stockout: {item.predicted_stockout_date ? new Date(item.predicted_stockout_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '---'}</p>
                    </div>
                  </td>
                  <td className="py-4 bg-transparent border-y border-zinc-100/50 dark:border-zinc-800/50 text-center">
                    <div className="inline-flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-tighter">Wkly</p>
                        <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">₱{Number(item.predicted_weekly_sales || 0).toLocaleString()}</p>
                      </div>
                      <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
                      <div className="text-center">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-tighter">Mnth</p>
                        <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">₱{Number(item.predicted_monthly_sales || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-3 text-right bg-transparent first:rounded-l-2xl last:rounded-r-2xl border-y border-zinc-100/50 dark:border-zinc-800/50 border-r border-zinc-100/50 dark:border-zinc-800/50">
                    {getStatusBadge(item.forecast_status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {refreshing && (
        <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-[1px] flex items-center justify-center z-20 transition-all rounded-3xl">
          <div className="flex flex-col items-center gap-2">
            <LuRefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Refreshing Forecast...</span>
          </div>
        </div>
      )}
    </article>
  );
}
