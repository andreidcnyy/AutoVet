import { useState, useMemo, useEffect } from "react";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import * as Icons from "react-icons/fi";
import * as LuIcons from "react-icons/lu";
import { LuSparkles } from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import { useApi } from "../hooks/useApi";
import api from "../api";
import { useToast } from "../context/ToastContext";
import clsx from "clsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList
} from 'recharts';

const AVG_PRICE_PER_CATEGORY = {
  consultation: 375,
  grooming:     750,
  vaccination:  887.50,
  laboratory:   800,
};

const CATEGORY_LABELS = {
  consultation: 'Consultation',
  grooming:     'Grooming',
  vaccination:  'Vaccination',
  laboratory:   'Laboratory',
};

const CATEGORY_SUBTITLES = {
  consultation: 'General check-ups & follow-ups',
  grooming:     'Basic & full grooming sessions',
  vaccination:  'All vaccine types combined',
  laboratory:   'Lab service requests',
};

const CATEGORY_COLORS = {
  consultation: '#10b981',
  grooming:     '#a855f7',
  vaccination:  '#3b82f6',
  laboratory:   '#f59e0b',
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const HISTORICAL_WINDOW = 12;   
const FORECAST_WINDOW   = 3;    

// Helper: Format Month Label (Short)
const formatMonth = (monthStr) => {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const [year, month] = parts;
  const labels = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${labels[parseInt(month) - 1]} ${year.slice(2)}`;
};

// Helper: Format Month Label (Full)
const formatMonthFull = (monthStr) => {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  const [year, month] = parts;
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d    = payload[0];
  const isFc = d?.payload?.type === 'forecast';
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-white font-black text-xs mb-1 uppercase tracking-widest">{label}</p>
      <p className="text-white font-black text-xl">{d.value} visits</p>
      <p className={`text-[10px] font-black uppercase tracking-tighter mt-1 ${isFc ? 'text-purple-400' : 'text-emerald-400'}`}>
        {isFc ? '🔮 AI forecast' : '📊 Actual Data'}
      </p>
    </div>
  );
};

const CategoryBadge = ({ category, service }) => {
  const colors = { 'Consultation': 'bg-blue-500/20 text-blue-300', 'Grooming': 'bg-purple-500/20 text-purple-300', 'Vaccination': 'bg-teal-500/20 text-teal-300', 'Laboratory': 'bg-orange-500/20 text-orange-300', 'Preventive Care':'bg-yellow-500/20 text-yellow-300' };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{service}</span>
      <span className={clsx("text-[9px] font-black uppercase tracking-widest w-fit px-1.5 py-0.5 rounded", colors[category] ?? 'bg-white/10 text-white/60')}>{category}</span>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const colors = { 'Approved': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', 'Pending': 'bg-amber-500/10 text-amber-600 dark:text-amber-400', 'Completed': 'bg-blue-500/10 text-blue-600 dark:text-blue-400', 'Cancelled': 'bg-rose-500/10 text-rose-600 dark:text-rose-400', 'Declined': 'bg-rose-600/10 text-rose-500', 'cancelled': 'bg-rose-500/10 text-rose-600 dark:text-rose-400', 'declined': 'bg-rose-600/10 text-rose-500' };
  return <span className={clsx("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full", colors[status] ?? 'bg-white/10 text-white/50')}>{status}</span>;
};

function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isStaff = user?.role === ROLES.STAFF;
  const enabled = !!user?.token;

  const [activeCategory, setActiveCategory] = useState('consultation');
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [historyPage, setHistoryPage] = useState(0);

  // Unified Modal State
  const [modal, setModal] = useState({ open: false, type: null, title: "", data: null, loading: false, error: null, pagination: null });
  const closeModal = () => setModal(prev => ({ ...prev, open: false }));

  const openModal = async (type, title, page = 1) => {
    const endpoints = {
      today: '/api/dashboard/appointments/today',
      upcoming: '/api/dashboard/appointments/upcoming',
      pets: '/api/dashboard/pets',
      clients: '/api/dashboard/clients',
      cancelled: '/api/dashboard/appointments/cancelled'
    };
    
    setModal(prev => ({ ...prev, open: true, type, title, data: null, pagination: null, loading: true, error: null }));
    
    try {
      const data = await api.get(`${endpoints[type]}?page=${page}`);
      const responseData = data.data || data; // Handle both paginated and non-paginated responses
      const pagination = data.pagination || { current_page: 1, last_page: 1, total: responseData.length };
      
      setModal(prev => prev.open && prev.type === type ? { ...prev, data: responseData, pagination, loading: false } : prev);
    } catch (err) {
      setModal(prev => prev.open && prev.type === type ? { ...prev, loading: false, error: err.message } : prev);
    }
  };

  const { data: stats, refetch: refetchStats } = useApi(['dashboard-stats'], '/api/dashboard/stats', { enabled, cacheKey: 'dashboard_stats_cache' });
  const { data: notifications, refetch: refetchNotifications } = useApi(['dashboard-notifications'], '/api/dashboard/notifications', { enabled, staleTime: 60 * 1000, cacheKey: 'dashboard_notifications_cache' });
  const { data: serviceForecast, refetch: refetchForecast } = useApi(['dashboard-service-forecast'], '/api/forecast/services', { enabled: enabled && !isStaff, cacheKey: 'dashboard_service_forecast_v8_cache' });

  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    if (!enabled) return;
    
    import("../utils/echo").then(module => {
        const echo = module.default;
        const channel = echo.private('admin.appointments')
            .listen('.appointment.created', () => {
                refetchStats();
                refetchNotifications();
                setLastUpdate(Date.now());
            })
            .listen('.appointment.status.updated', () => {
                refetchStats();
                refetchNotifications();
                setLastUpdate(Date.now());
            })
            .listen('.appointment.deleted', () => {
                refetchStats();
                refetchNotifications();
                setLastUpdate(Date.now());
            });
            
        return () => echo.leave('admin.appointments');
    });
  }, [enabled, refetchStats, refetchNotifications]);

  // Real-time Modal Refresh
  useEffect(() => {
    if (modal.open && ['today', 'upcoming', 'cancelled'].includes(modal.type)) {
       // Silent refresh if possible, but openModal currently sets loading: true.
       // To avoid flickering, we could implement a silent version or just accept it.
       // For now, let's just refetch.
       openModal(modal.type, modal.title, modal.pagination?.current_page || 1);
    }
  }, [lastUpdate]);

  useEffect(() => {
    const handleRefresh = () => { refetchStats?.(); refetchNotifications?.(); refetchForecast?.(); };
    window.addEventListener('inventory-forecast-refresh', handleRefresh);
    return () => window.removeEventListener('inventory-forecast-refresh', handleRefresh);
  }, [refetchStats, refetchNotifications, refetchForecast]);

  const historical = useMemo(() => serviceForecast?.historical || [], [serviceForecast]);
  const forecast = serviceForecast?.forecast || [];

  // Align forecast labels
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const visibleForecast = useMemo(() => (forecast.length > 0 ? forecast.slice(0, FORECAST_WINDOW) : []).map((m, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
    const alignedMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { ...m, month: alignedMonthStr, is_forecast: true };
  }), [forecast, now]);

  // Priority: Selected > Current Month (Actual) > Current Month (Forecast) > Next Forecast > Last Historical
  const displayPoint = useMemo(() => {
    if (selectedPoint) return selectedPoint;
    
    const currentActual = historical.find(h => h.month === currentMonthStr);
    if (currentActual) return currentActual;
    
    const currentForecast = visibleForecast.find(f => f.month === currentMonthStr);
    if (currentForecast) return currentForecast;

    return visibleForecast[0] || historical[historical.length - 1];
  }, [selectedPoint, historical, visibleForecast, currentMonthStr]);

  // Derive Jump Options
  const historicalYears = useMemo(() => {
    const years = historical.map(h => h.month.split('-')[0]);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [historical]);

  const currentYearSelected = displayPoint?.month.split('-')[0];
  const currentMonthSelected = displayPoint?.month.split('-')[1];

  const handleJumpChange = (type, value) => {
    let targetMonth = currentMonthSelected;
    let targetYear = currentYearSelected;
    if (type === 'year') targetYear = value;
    if (type === 'month') targetMonth = value;

    const targetStr = `${targetYear}-${targetMonth}`;
    const idx = historical.findIndex(p => p.month === targetStr);
    
    if (idx !== -1) {
      const found = historical[idx];
      setSelectedPoint(found);
      const page = Math.floor((historical.length - 1 - idx) / HISTORICAL_WINDOW);
      setHistoryPage(page);
    }
  };

  // Paged Chart Window
  const chartHistorical = useMemo(() => {
    const total = historical.length;
    const end = Math.max(0, total - (historyPage * HISTORICAL_WINDOW));
    const start = Math.max(0, end - HISTORICAL_WINDOW);
    return historical.slice(start, end);
  }, [historical, historyPage]);

  const categoryData = displayPoint?.by_category?.[activeCategory] || {
    volume: displayPoint?.[activeCategory] || 0,
    estimated_revenue: (displayPoint?.[activeCategory] || 0) * (AVG_PRICE_PER_CATEGORY[activeCategory] || 0),
    estimated_customers: Math.round((displayPoint?.[activeCategory] || 0) * 0.85) 
  };

  const cardCustomers = categoryData?.estimated_customers ?? 0;
  const cardVolume    = categoryData?.volume              ?? 0;

  // 1. Planning Baseline: Average of the last 3 available historical months (including current)
  const stableBaselineVal = useMemo(() => {
    if (historical.length === 0) return 0;
    
    // Use the last 3 months of history as the baseline for a 3-month planning window
    const last3 = historical.slice(-3);
    const sum = last3.reduce((acc, curr) => acc + (Number(curr[activeCategory]) || 0), 0);
    return sum / (last3.length || 1);
  }, [historical, activeCategory]);

  // 2. Planning Target: Average of the next 3 forecasted months
  const next3Avg = useMemo(() => {
    if (visibleForecast.length === 0) return 0;
    const sum = visibleForecast.reduce((acc, curr) => acc + (Number(curr[activeCategory]) || 0), 0);
    return sum / (visibleForecast.length || 1);
  }, [visibleForecast, activeCategory]);

  const pctChange = (!stableBaselineVal || stableBaselineVal === 0) 
    ? null 
    : Math.round(((next3Avg - stableBaselineVal) / stableBaselineVal) * 100);

  const pctLabel = pctChange === null ? 'N/A' : pctChange > 0 ? `+${pctChange}%` : `${pctChange}%`;
  const pctColor = pctChange === null ? 'text-zinc-400 bg-zinc-500/10' : pctChange > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10';

  const chartData = [
    ...chartHistorical.map(m => ({ month: formatMonth(m.month), value: m[activeCategory] ?? 0, type: 'historical', raw: m })),
    ...visibleForecast.map(m => ({ month: formatMonth(m.month), value: m[activeCategory] ?? 0, type: 'forecast', raw: m })),
  ];

  const visibleVals  = chartHistorical.map(m => m[activeCategory] ?? 0);
  const avgPerMonth  = visibleVals.length ? Math.round(visibleVals.reduce((a, b) => a + b, 0) / visibleVals.length) : 0;
  const peakVol      = visibleVals.length ? Math.max(...visibleVals) : 0;
  const lowestVol    = visibleVals.length ? Math.min(...visibleVals) : 0;

  const isFuture = displayPoint?.is_forecast || false;
  const verb = isFuture ? 'Projected' : 'Recorded';
  const period = displayPoint?.month ? formatMonthFull(displayPoint.month) : '';

  const plainSummary = {
    consultation: `${verb} ${cardVolume} consultation visits for ${period}. ${isFuture ? 'Based on AI trend analysis.' : 'Actual volume from system records.'}`,
    grooming:     `${verb} ${cardVolume} grooming sessions for ${period}. ${isFuture ? 'Based on AI trend analysis.' : 'Actual volume from system records.'}`,
    vaccination:  `${verb} ${cardVolume} vaccination visits for ${period}. ${isFuture ? 'Based on AI trend analysis.' : 'Actual volume from system records.'}`,
    laboratory:   `${verb} ${cardVolume} lab requests for ${period}. ${isFuture ? 'Based on AI trend analysis.' : 'Actual volume from system records.'}`,
  };

  const mappedMetrics = (Array.isArray(stats) ? stats : [])
    .map(stat => {
      const typeMap = { 'stat-pets': 'pets', 'stat-owners': 'clients', 'stat-appts-today': 'today', 'stat-appts-upcoming': 'upcoming', 'stat-cancelled': 'cancelled' };
      const type = typeMap[stat.id];
      return { ...stat, icon: Icons[stat.iconName] || LuIcons[stat.iconName] || Icons.FiActivity, onClick: type ? () => openModal(type, stat.title) : null };
    });

  const mappedNotifications = (notifications || []).map(notif => ({ ...notif, icon: Icons[notif.iconName] || LuIcons[notif.iconName] || Icons.FiBell }));

  const handleMarkAllRead = async () => {
    try {
      await api.post('/api/dashboard/notifications/mark-all-read', {});
      
      // Force clear persistent caches
      localStorage.removeItem('dashboard_stats_cache');
      localStorage.removeItem('dashboard_notifications_cache');
      api.invalidateCache();

      refetchStats();
      refetchNotifications();
      toast.success("All notifications marked as read.");
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      toast.error("Action failed. Please try again.");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Archive all notifications permanently?")) return;
    try {
      await api.post('/api/dashboard/notifications/clear-all', {});
      
      // Force clear persistent caches
      localStorage.removeItem('dashboard_stats_cache');
      localStorage.removeItem('dashboard_notifications_cache');
      api.invalidateCache();

      refetchStats();
      refetchNotifications();
      toast.success("Notification history cleared.");
    } catch (err) {
      console.error("Failed to clear notifications:", err);
      toast.error("Action failed. Please try again.");
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.post(`/api/dashboard/notifications/${id}/dismiss`, {});
      refetchStats();
      refetchNotifications();
    } catch (err) {
      console.error("Failed to dismiss notification:", err);
      toast.error("Action failed.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        {mappedMetrics.map((card) => (
          <MetricCard key={card.id || card.title} card={card} />
        ))}
      </section>

      {!isStaff && (
        <section className="rounded-[32px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm overflow-hidden">
          <div className="rounded-2xl border border-zinc-100 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-purple-600 text-xl font-black">✦</span>
                  <h2 className="text-zinc-900 dark:text-zinc-50 font-black text-xl tracking-wide uppercase">Next 3 Months Planning Forecast</h2>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest ml-8">Historical-Data-Based Projection · Current-Month Aligned</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">History Jump:</span>
                  <div className="flex gap-1">
                    <select value={currentMonthSelected} onChange={(e) => handleJumpChange('month', e.target.value)} className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-tight focus:outline-none cursor-pointer">
                      {MONTH_NAMES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                    </select>
                    <select value={currentYearSelected} onChange={(e) => handleJumpChange('year', e.target.value)} className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-tight focus:outline-none cursor-pointer">
                      {historicalYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white dark:bg-zinc-800/50 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-700 shadow-sm">
                <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-3">👥 Est. Customers — {CATEGORY_LABELS[activeCategory]}</p>
                <p className="text-4xl font-black text-purple-600 dark:text-purple-400 tracking-tighter">{cardCustomers}</p>
                <p className="text-zinc-600 dark:text-zinc-300 text-[10px] font-black mt-2 uppercase tracking-tighter italic">Data for {formatMonthFull(displayPoint?.month)}</p>
              </div>
              <div className="bg-white dark:bg-zinc-800/50 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-700 shadow-sm">
                <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-3">📋 Service Demand — {CATEGORY_LABELS[activeCategory]}</p>
                <p className="text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{cardVolume}</p>
                <p className="text-zinc-600 dark:text-zinc-300 text-[10px] font-black mt-2 uppercase tracking-tighter italic">Visits for {formatMonthFull(displayPoint?.month)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {['consultation', 'grooming', 'vaccination', 'laboratory'].map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={clsx("px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all", activeCategory === cat ? "text-white shadow-lg" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700")} style={activeCategory === cat ? { backgroundColor: CATEGORY_COLORS[cat], boxShadow: `0 4px 14px ${CATEGORY_COLORS[cat]}40` } : {}}>{CATEGORY_LABELS[cat]}</button>
              ))}
            </div>

            <p className="text-zinc-900 dark:text-zinc-50 text-xs font-black italic mb-4 uppercase tracking-tight">{CATEGORY_SUBTITLES[activeCategory]}</p>

            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-6">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[activeCategory] }} /><span className="text-zinc-900 dark:text-zinc-100 text-[10px] font-black uppercase">ACTUAL DATA</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm opacity-50 border-2" style={{ borderColor: CATEGORY_COLORS[activeCategory], backgroundColor: 'transparent' }} /><span className="text-zinc-900 dark:text-zinc-100 text-[10px] font-black uppercase">AI forecast</span></div>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={(historyPage + 1) * HISTORICAL_WINDOW >= historical.length} onClick={() => setHistoryPage(p => p + 1)} className="h-8 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 disabled:opacity-30 border border-zinc-300 dark:border-zinc-700"><Icons.FiChevronLeft className="inline mr-1" /> Prev 12 Months</button>
                <button disabled={historyPage === 0} onClick={() => setHistoryPage(p => p - 1)} className="h-8 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 disabled:opacity-30 border border-zinc-300 dark:border-zinc-700">Next 12 Months <Icons.FiChevronRight className="inline ml-1" /></button>
              </div>
            </div>

            <div className="h-[320px] w-full min-h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={40} margin={{ top: 30, right: 10, left: -20, bottom: 0 }} onClick={(data) => { if (data && data.activePayload) setSelectedPoint(data.activePayload[0].payload.raw); }}>
                  <XAxis dataKey="month" tick={{ fill: '#e4e4e7', fontSize: 11, fontWeight: '900' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} animationDuration={0} isAnimationActive={false} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive={true} className="cursor-pointer">
                    <LabelList dataKey="value" position="top" offset={10} style={{ fill: '#ffffff', fontSize: '12px', fontWeight: '900' }} />
                    {chartData.map((entry, index) => {
                      const isSelected = displayPoint?.month === entry.raw.month;
                      return <Cell key={index} fill={CATEGORY_COLORS[activeCategory]} fillOpacity={entry.type === 'historical' ? 1 : 0.4} stroke={isSelected ? '#fff' : (entry.type === 'forecast' ? CATEGORY_COLORS[activeCategory] : 'none')} strokeWidth={isSelected ? 3 : (entry.type === 'forecast' ? 2 : 0)} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 px-4 py-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-inner">
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-wider mb-1">📌 Operational Insight</p>
              <p className="text-zinc-900 dark:text-zinc-100 text-sm leading-relaxed font-black">{plainSummary[activeCategory]}</p>
              <p className="text-zinc-600 dark:text-zinc-300 text-[10px] mt-2 italic font-black">⚠️ Forecast view aligned to current calendar month. Click a bar to select or use the window buttons to navigate blocks of 12 months.</p>
            </div>
          </div>
        </section>
      )}

      <RecentNotificationsCard items={mappedNotifications} onMarkAllRead={handleMarkAllRead} onClearAll={handleClearAll} onDismiss={handleDismiss} />

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={closeModal}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
              <div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{modal.title}</h2>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">{modal.loading ? 'Updating records...' : (modal.data?.date ?? `System record as of ${new Date().toLocaleDateString()}`)}</p>
              </div>
              <button onClick={closeModal} className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 transition-colors"><LuIcons.LuX className="h-5 w-5" /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              {modal.loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4"><div className="h-10 w-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" /><p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Loading records...</p></div>
              ) : modal.error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4"><div className="h-16 w-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-500"><Icons.FiAlertCircle className="h-8 w-8" /></div><p className="text-xs font-black text-rose-500 uppercase tracking-widest">Error: {modal.error}</p></div>
              ) : (
                <div className="overflow-x-auto">
                  {modal.pagination && modal.pagination.last_page > 1 && (
                    <div className="px-8 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 flex items-center justify-between">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Showing <span>{(modal.pagination.current_page - 1) * modal.pagination.per_page + 1}-{Math.min(modal.pagination.current_page * modal.pagination.per_page, modal.pagination.total)}</span> of <span>{modal.pagination.total}</span> records</div>
                      <div className="flex items-center gap-2">
                        <button disabled={modal.pagination.current_page === 1 || modal.loading} onClick={() => openModal(modal.type, modal.title, modal.pagination.current_page - 1)} className="h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-600 text-[10px] font-black uppercase disabled:opacity-50 shadow-sm">Prev</button>
                        <span className="text-[10px] font-black text-zinc-400 px-1">{modal.pagination.current_page} / {modal.pagination.last_page}</span>
                        <button disabled={modal.pagination.current_page === modal.pagination.last_page || modal.loading} onClick={() => openModal(modal.type, modal.title, modal.pagination.current_page + 1)} className="h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-600 text-[10px] font-black uppercase disabled:opacity-50 shadow-sm">Next</button>
                      </div>
                    </div>
                  )}
                  {modal.type === 'pets' && (
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-zinc-50/50 dark:bg-zinc-800/30"><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase">Pet Name</th><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase">Species</th><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase">Breed</th><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase text-right">Owner</th></tr></thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{modal.data?.pets?.map(p => (<tr key={p.id} className="hover:bg-zinc-50/50 transition-colors"><td className="px-8 py-5 text-sm font-black text-zinc-900 dark:text-zinc-100">{p.name}</td><td className="px-8 py-5 text-sm text-zinc-600 dark:text-zinc-400">{p.species}</td><td className="px-8 py-5 text-sm text-zinc-600 dark:text-zinc-400">{p.breed}</td><td className="px-8 py-5 text-right text-sm font-bold text-zinc-500">{p.owner_name}</td></tr>))}</tbody>
                    </table>
                  )}
                  {modal.type === 'clients' && (
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-zinc-50/50 dark:bg-zinc-800/30"><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase">Name</th><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase">Email</th><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase text-right">Pets</th></tr></thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{modal.data?.clients?.map(c => (<tr key={c.id} className="hover:bg-zinc-50/50 transition-colors"><td className="px-8 py-5 text-sm font-black text-zinc-900 dark:text-zinc-100">{c.name}</td><td className="px-8 py-5 text-sm text-zinc-600 dark:text-zinc-400">{c.email}</td><td className="px-8 py-5 text-right"><span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-bold text-zinc-500">{c.pet_count}</span></td></tr>))}</tbody>
                    </table>
                  )}
                  {(modal.type === 'today' || modal.type === 'upcoming' || modal.type === 'cancelled') && (
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-zinc-50/50 dark:bg-zinc-800/30">{(modal.type === 'upcoming' || modal.type === 'cancelled') && <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase">Date</th>}<th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase">Time</th><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase">Pet & Owner</th><th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase text-right">Status</th></tr></thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{modal.data?.appointments?.map(a => (<tr key={a.id} className="hover:bg-zinc-50/50 transition-colors">{(modal.type === 'upcoming' || modal.type === 'cancelled') && <td className="px-8 py-5 text-sm font-bold text-zinc-900 dark:text-zinc-100">{a.date}</td>}<td className="px-8 py-5 text-sm font-black text-zinc-500">{a.time || 'N/A'}</td><td className="px-8 py-5"><div className="flex flex-col"><span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{a.pet_name}</span><span className="text-[10px] font-bold text-zinc-500 uppercase">{a.owner_name}</span></div></td><td className="px-8 py-5 text-right"><StatusBadge status={a.status} /></td></tr>))}</tbody>
                    </table>
                  )}
                  {(!modal.data || (modal.type === 'pets' && modal.data?.pets?.length === 0) || (modal.type === 'clients' && modal.data?.clients?.length === 0) || (['today', 'upcoming', 'cancelled'].includes(modal.type) && modal.data?.appointments?.length === 0)) && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4"><div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400"><Icons.FiInbox className="h-8 w-8" /></div><p className="text-xs font-black text-zinc-400 uppercase">No records found</p></div>
                  )}
                </div>
              )}
            </div>
            <div className="px-8 py-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">{modal.pagination && modal.pagination.last_page > 1 && (<div className="flex items-center gap-2"><button disabled={modal.pagination.current_page === 1 || modal.loading} onClick={() => openModal(modal.type, modal.title, modal.pagination.current_page - 1)} className="h-9 px-4 rounded-xl bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase hover:bg-zinc-200 disabled:opacity-50 transition-colors">Previous</button><span className="text-[10px] font-black text-zinc-400 px-2">Page {modal.pagination.current_page} of {modal.pagination.last_page}</span><button disabled={modal.pagination.current_page === modal.pagination.last_page || modal.loading} onClick={() => openModal(modal.type, modal.title, modal.pagination.current_page + 1)} className="h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-600 text-[10px] font-black uppercase hover:bg-zinc-200 disabled:opacity-50 transition-colors">Next</button></div>)}</div>
              <button onClick={closeModal} className="px-6 py-2.5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase hover:scale-105 transition-transform">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
