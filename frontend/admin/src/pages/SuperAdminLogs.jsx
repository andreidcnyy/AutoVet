import React, { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { FiActivity, FiServer, FiUser, FiClock, FiFilter, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import clsx from 'clsx';

export default function SuperAdminLogs() {
  const [logsData, setLogsData] = useState({ data: [], current_page: 1, last_page: 1 });
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState('all');
  const [page, setPage] = useState(1);
  const toast = useToast();

  const fetchLogs = async (pageNum = 1, clinicId = 'all') => {
    setLoading(true);
    try {
      const res = await api.get(`/api/super-admin/system-logs?page=${pageNum}&clinic_id=${clinicId}`);
      setLogsData(res);
    } catch (err) {
      toast.error('Failed to load system logs.');
    } finally {
      setLoading(false);
    }
  };

  const fetchClinics = async () => {
    try {
      const res = await api.get('/api/super-admin/clinics');
      setClinics(res);
    } catch (err) {
      console.error('Failed to fetch clinics for filter', err);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  useEffect(() => {
    fetchLogs(page, selectedClinic);
  }, [page, selectedClinic]);

  const handleClinicChange = (e) => {
    setSelectedClinic(e.target.value);
    setPage(1); 
  };

  const Pagination = () => {
    if (logsData.last_page <= 1) return null;
    return (
      <div className="flex items-center justify-between px-6 py-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
           Page {logsData.current_page} of {logsData.last_page}
        </p>
        <div className="flex gap-2">
          <button
            disabled={logsData.current_page === 1 || loading}
            onClick={() => setPage(p => p - 1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-sm border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 dark:bg-dark-card dark:border-dark-border dark:text-zinc-400 transition-all"
          >
            <FiChevronLeft className="h-5 w-5" />
          </button>
          <button
            disabled={logsData.current_page === logsData.last_page || loading}
            onClick={() => setPage(p => p + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-sm border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 dark:bg-dark-card dark:border-dark-border dark:text-zinc-400 transition-all"
          >
            <FiChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  if (loading && (!logsData.data || logsData.data.length === 0)) return <div className="p-8 text-zinc-500 font-bold uppercase tracking-widest animate-pulse">Synchronizing Logs...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-autovet-navy dark:text-zinc-50 uppercase tracking-tighter">System Audit Logs</h1>
          <p className="mt-1 text-base font-bold text-autovet-teal uppercase tracking-tight">Platform-wide administrative activity tracking.</p>
        </div>

        <div className="flex items-center gap-3 bg-zinc-100 dark:bg-dark-surface p-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-inner">
           <div className="pl-3 text-autovet-navy">
              <FiFilter className="h-4 w-4" />
           </div>
           <select 
             value={selectedClinic} 
             onChange={handleClinicChange}
             className="bg-zinc-100 dark:bg-dark-surface border-none text-xs font-black uppercase tracking-widest focus:ring-0 text-zinc-700 dark:text-zinc-200 pr-10 cursor-pointer"
           >
              <option value="all" className="bg-white dark:bg-dark-card text-zinc-900 dark:text-white">Global Activity</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-dark-card text-zinc-900 dark:text-white">
                  {c.clinic_name.toUpperCase()}
                </option>
              ))}
           </select>
        </div>
      </div>

      <div className="card-shell overflow-hidden border-t-4 border-autovet-navy">
        <div className="border-b border-zinc-100 bg-zinc-50/50 p-6 dark:border-dark-border dark:bg-dark-surface/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <FiServer className="h-5 w-5 text-autovet-navy" />
             <h3 className="text-xl font-black text-autovet-navy dark:text-zinc-50 uppercase tracking-tight">
               {selectedClinic === 'all' ? 'Recent Activity (Global)' : 'Clinic Activity Logs'}
             </h3>
          </div>
          {loading && <div className="text-[10px] font-black uppercase tracking-widest text-autovet-teal animate-pulse">Syncing...</div>}
        </div>
        
        {/* Top Pagination */}
        <div className="bg-zinc-50/30 dark:bg-dark-surface/30 border-b border-zinc-100 dark:border-dark-border">
           <Pagination />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-zinc-50/50 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:bg-dark-surface/30 dark:text-zinc-500">
              <tr>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Admin / User</th>
                <th className="px-6 py-4">Clinic Context</th>
                <th className="px-6 py-4">Entity Type</th>
                <th className="px-6 py-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
              {(!logsData.data || logsData.data.length === 0) ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-zinc-400 font-bold uppercase tracking-widest">
                    No logs found for this criteria.
                  </td>
                </tr>
              ) : (
                logsData.data.map((log) => (
                  <tr key={log.id} className="hover:bg-autovet-navy-light/30 transition-colors dark:hover:bg-dark-surface/40">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          log.action === 'created' ? "bg-emerald-100 text-emerald-600" :
                          log.action === 'updated' ? "bg-blue-100 text-blue-600" :
                          log.action === 'deleted' ? "bg-rose-100 text-rose-600" : "bg-zinc-100 text-zinc-600"
                        )}>
                          <FiActivity className="h-4 w-4" />
                        </div>
                        <div>
                           <p className="font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight text-xs">{log.action}</p>
                           <p className="text-[10px] font-bold text-zinc-400 tracking-widest mt-0.5 uppercase">ID: {log.model_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {log.user ? (
                        <div>
                           <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase">{log.user.name}</p>
                           <p className="text-[10px] font-black text-autovet-teal uppercase tracking-widest">{log.user.role}</p>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-zinc-400 italic">System Process</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                       {log.clinic_id ? (
                          <div className="flex items-center gap-2">
                             <span className="h-2 w-2 rounded-full bg-autovet-teal shadow-[0_0_8px_rgba(0,163,150,0.5)]"></span>
                             <span className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 tracking-tight">
                                {clinics.find(c => c.id === log.clinic_id)?.clinic_name || `Clinic #${log.clinic_id}`}
                             </span>
                          </div>
                       ) : (
                          <span className="text-[10px] font-black uppercase text-zinc-400 italic tracking-widest">Platform Level</span>
                       )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        {String(log.model_type).split('\\').pop()}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 tracking-tighter">
                         <FiClock className="h-3 w-3 text-autovet-teal" />
                         {new Date(log.created_at).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <div className="border-t border-zinc-100 bg-zinc-50/30 px-6 py-2 dark:border-dark-border dark:bg-dark-surface/30">
          <Pagination />
        </div>
      </div>
    </div>
  );
}
