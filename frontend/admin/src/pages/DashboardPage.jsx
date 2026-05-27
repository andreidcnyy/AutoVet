import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import MetricCard from "../components/dashboard/MetricCard";
import AnalyticsChartsCard from "../components/dashboard/AnalyticsChartsCard";
import SalesSummaryCard from "../components/dashboard/SalesSummaryCard";
import * as Icons from "react-icons/fi";
import * as LuIcons from "react-icons/lu";
import { LuSparkles } from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import { useApi } from "../hooks/useApi";
import api from "../api";
import { useToast } from "../context/ToastContext";
import clsx from "clsx";


const StatusBadge = ({ status }) => {
  const colors = { 'approved': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', 'pending': 'bg-amber-500/10 text-amber-600 dark:text-amber-400', 'completed': 'bg-blue-500/10 text-blue-600 dark:text-blue-400', 'cancelled': 'bg-rose-500/10 text-rose-600 dark:text-rose-400', 'declined': 'bg-rose-600/10 text-rose-500' };
  return <span className={clsx("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full", colors[status?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400')}>{status}</span>;
};

function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isStaff = user?.role === ROLES.STAFF;
  const enabled = !!user?.token;

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

  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    if (!enabled) return;

    let echoInstance = null;
    import("../utils/echo").then(module => {
        echoInstance = module.default;
        const refresh = () => { refetchStats(); refetchNotifications(); setLastUpdate(Date.now()); };
        echoInstance.private('admin.appointments')
            .listen('.appointment.created', refresh)
            .listen('.appointment.status.updated', refresh)
            .listen('.appointment.deleted', refresh);
    });

    return () => { if (echoInstance) echoInstance.leave('admin.appointments'); };
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
    const handleRefresh = () => { refetchStats?.(); refetchNotifications?.(); };
    window.addEventListener('inventory-forecast-refresh', handleRefresh);
    return () => window.removeEventListener('inventory-forecast-refresh', handleRefresh);
  }, [refetchStats, refetchNotifications]);

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

      <section className="grid grid-cols-1 gap-6">
        <AnalyticsChartsCard />
      </section>

      {!isStaff && (
        <section className="grid grid-cols-1 gap-6">
          <SalesSummaryCard />
        </section>
      )}

      {modal.open && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}

export default DashboardPage;
