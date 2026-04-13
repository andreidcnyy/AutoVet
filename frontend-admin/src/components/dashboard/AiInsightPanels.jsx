import { useState, useEffect } from 'react';
import { LuSparkles } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';

export default function AiInsightPanels() {
  const [apptData, setApptData] = useState(null);
  const [patientData, setPatientData] = useState(null);
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

      const [apptResult, patientResult, invResult] = await Promise.allSettled([
        fetch('/api/dashboard/appointment-forecast', { headers }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch('/api/dashboard/patient-visit-predictions', { headers }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch('/api/dashboard/inventory-forecast', { headers }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      ]);

      setApptData(apptResult.status === 'fulfilled' ? apptResult.value : null);
      setPatientData(patientResult.status === 'fulfilled' ? patientResult.value : null);
      setInventoryData(invResult.status === 'fulfilled' ? invResult.value : null);
      setLoading(false);
    };

    fetchData();
  }, [user?.token]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="card-shell p-5 animate-pulse h-48" />
        <div className="card-shell p-5 animate-pulse h-48" />
        <div className="card-shell p-5 animate-pulse h-48" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* CARD 1: Appointment Forecast */}
      <article className="card-shell p-5">
        <div className="flex items-center gap-2 mb-1">
          <LuSparkles className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Appointment Forecast</h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Next 7 days · linear regression model</p>

        {!apptData ? (
          <p className="text-xs text-zinc-400 py-6 text-center">Appointment forecast unavailable.</p>
        ) : (
          <>
            {apptData.model && (
              <div className="flex flex-wrap gap-1 mb-3">
                <span className="rounded-full bg-zinc-100 dark:bg-dark-surface border border-zinc-200 dark:border-dark-border px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                  Next wk: {apptData.model.forecast_week_1} appts
                </span>
                <span className="rounded-full bg-zinc-100 dark:bg-dark-surface border border-zinc-200 dark:border-dark-border px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                  R² = {apptData.model.r2}
                </span>
                <span className="rounded-full bg-zinc-100 dark:bg-dark-surface border border-zinc-200 dark:border-dark-border px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {apptData.model.algorithm}
                </span>
              </div>
            )}

            <div className="flex items-end gap-1 h-14 mb-1">
              {(apptData.daily_next7 ?? []).map((day, i) => {
                const maxCount = Math.max(...(apptData.daily_next7 ?? []).map(d => d.count), 1);
                const heightPct = Math.round((day.count / maxCount) * 100);
                const barColor = day.count >= 10 ? 'bg-rose-400' : day.count >= 6 ? 'bg-amber-400' : 'bg-emerald-400';
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-[9px] text-zinc-400">{day.count}</span>
                    <div className={`w-full rounded-t-sm ${barColor}`} style={{ height: `${Math.max(heightPct * 0.48, 4)}px` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mb-3">
              {(apptData.daily_next7 ?? []).map((day, i) => (
                <span key={i} className="flex-1 text-center text-[9px] text-zinc-400">{day.label}</span>
              ))}
            </div>

            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mb-3">Surge threshold: 10+ appts/day</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-2">{apptData.insight ?? 'No forecast available.'}</p>

            <ul className="space-y-1">
              {(apptData.hints ?? []).map((hint, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                  {hint}
                </li>
              ))}
            </ul>

            {apptData.model && (
              <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-600">
                slope m={apptData.model.slope} · R²={apptData.model.r2} · trained on 8 weeks of appointment history
              </p>
            )}
          </>
        )}
      </article>

      {/* CARD 2: Inventory AI Status */}
      <article className="card-shell p-5">
        <div className="flex items-center gap-2 mb-1">
          <LuSparkles className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Inventory AI Status</h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Most critical item · LR model</p>
        
        {!inventoryData ? (
          <p className="text-xs text-zinc-400 py-6 text-center">Inventory analysis unavailable.</p>
        ) : (
          <>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-3">{inventoryData.item_name ?? '—'}</p>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg bg-zinc-50 dark:bg-dark-surface p-2.5">
                <p className="text-[10px] text-zinc-400 mb-1">Current stock</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{inventoryData.current_stock ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">Recommended restock</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  {inventoryData.recommended_stock ?? '—'} <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">units</span>
                </p>
              </div>
            </div>

            <span className="inline-block rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {inventoryData.growth_label ?? '—'}
            </span>
            
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {inventoryData.analysis ?? 'No inventory analysis data available.'}
            </p>
          </>
        )}
      </article>

      {/* CARD 3: Patient Visit Prediction */}
      <article className="card-shell p-5">
        <div className="flex items-center gap-2 mb-1">
          <LuSparkles className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Patient Visit Prediction</h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Follow-up dates from medical records</p>

        {!patientData ? (
          <p className="text-xs text-zinc-400 py-6 text-center">Patient visit data unavailable.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <span className="rounded-full bg-rose-100 dark:bg-rose-900/30 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                {patientData.total_overdue ?? 0} overdue
              </span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                {patientData.total_upcoming ?? 0} upcoming
              </span>
            </div>

            {(!patientData.patients || patientData.patients.length === 0) ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-600 py-4 text-center">No overdue or upcoming follow-ups found.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="pb-2 text-left font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-widest text-[9px]">Pet</th>
                    <th className="pb-2 text-left font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-widest text-[9px]">Owner</th>
                    <th className="pb-2 text-left font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-widest text-[9px]">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {patientData.patients.slice(0, 6).map((p, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-dark-border">
                      <td className="py-2 font-medium text-zinc-800 dark:text-zinc-200">{p.pet}</td>
                      <td className="py-2 text-zinc-500 dark:text-zinc-400">{p.owner}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.tone === 'danger'  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                          p.tone === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          p.tone === 'info'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {p.status_label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-600 leading-tight">{patientData.summary ?? ''}</p>
            <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-600">Sourced from medical records · follow_up_date field</p>
          </>
        )}
      </article>
    </div>
  );
}
