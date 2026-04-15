import { useState, useEffect } from 'react';
import { LuSparkles } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';

export default function InventoryAiStatusCard() {
  const [inventoryData, setInventoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.token) return;

    const fetchData = async () => {
      const headers = { 
        'Authorization': `Bearer ${user.token}`,
        'Accept': 'application/json'
      };

      try {
        const res = await fetch('/api/dashboard/inventory-forecast', { headers });
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        setInventoryData(data);
      } catch (err) {
        console.error("Inventory AI Status fetch error:", err);
        setInventoryData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.token]);

  if (loading) {
    return (
      <article className="card-shell p-6 animate-pulse min-h-[300px] flex items-center justify-center">
        <span className="text-zinc-400 font-medium">Loading AI Analysis...</span>
      </article>
    );
  }

  return (
    <article className="card-shell p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-10 dark:opacity-5 pointer-events-none">
          <LuSparkles className="w-32 h-32 text-emerald-500" />
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <LuSparkles className="h-6 w-6 text-emerald-500" />
        <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Inventory AI Status</h3>
      </div>
      <p className="text-base text-zinc-500 dark:text-zinc-400 mb-6 relative z-10">Real-time analysis of your most critical inventory items using linear regression.</p>
      
      {!inventoryData ? (
        <div className="py-12 text-center relative z-10">
          <p className="text-zinc-400 italic">Inventory analysis unavailable at this time.</p>
        </div>
      ) : (
        <div className="relative z-10">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Most Critical Item</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{inventoryData.item_name ?? '—'}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl bg-zinc-50 dark:bg-dark-surface p-5 border border-zinc-100 dark:border-dark-border">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Current Stock</p>
              <p className="text-4xl font-black text-zinc-900 dark:text-zinc-50">{inventoryData.current_stock ?? '—'}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-5 border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">Recommended Restock</p>
              <p className="text-4xl font-black text-emerald-700 dark:text-emerald-300">
                {inventoryData.recommended_stock ?? '—'} <span className="text-lg font-bold text-emerald-600/50">units</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />
              {inventoryData.growth_label ?? 'Stable Demand'}
            </span>
          </div>
          
          <div className="p-5 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-zinc-100 shadow-xl">
             <div className="flex items-center gap-2 mb-2">
                <LuSparkles className="w-4 h-4 text-emerald-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">AI Insight</p>
             </div>
             <p className="text-sm font-medium leading-relaxed">
               {inventoryData.analysis ?? 'Our AI model is currently processing your inventory data to provide actionable insights.'}
             </p>
          </div>
        </div>
      )}
    </article>
  );
}
