import React, { useState, useEffect } from "react";
import { FiActivity, FiSearch, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

function AuditLogTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action_type: "",
    model_type: "",
    date_from: "",
    date_to: "",
  });
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams(filters);
    fetch(`/api/audit-logs?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${user?.token}`,
        "Accept": "application/json"
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch audit logs");
        return res.json();
      })
      .then((data) => {
        setLogs(data.data || []);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const actionColors = {
    created: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200",
    updated: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200",
    deleted: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200",
  };

  return (
    <div className="card-shell flex min-h-[600px] flex-col">
      <div className="border-b border-zinc-200 px-6 py-5 dark:border-dark-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            <FiActivity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">System Audit Logs</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">View detailed records of system actions</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 border-b border-zinc-200 bg-zinc-50/50 p-6 sm:grid-cols-4 dark:border-dark-border dark:bg-dark-surface/50">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Action</label>
          <select 
            value={filters.action_type}
            onChange={(e) => setFilters({...filters, action_type: e.target.value})}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200"
          >
            <option value="">All Actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Model Type</label>
          <input 
            type="text" 
            placeholder="e.g. Invoice, Patient"
            value={filters.model_type}
            onChange={(e) => setFilters({...filters, model_type: e.target.value})}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Date From</label>
          <input 
            type="date" 
            value={filters.date_from}
            onChange={(e) => setFilters({...filters, date_from: e.target.value})}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Date To</label>
          <input 
            type="date" 
            value={filters.date_to}
            onChange={(e) => setFilters({...filters, date_to: e.target.value})}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-zinc-500">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-zinc-500">
            <FiSearch className="mb-2 h-6 w-6 text-zinc-300" />
            <p>No audit logs found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-dark-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600 dark:bg-dark-surface dark:text-zinc-400 border-b border-zinc-200 dark:border-dark-border">
                <tr>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-dark-border dark:bg-dark-card">
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="transition hover:bg-zinc-50 dark:hover:bg-dark-surface/50">
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {log.user ? log.user.name : "System"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
                          actionColors[log.action] || "bg-zinc-100 text-zinc-800"
                        )}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {log.model_type ? log.model_type.split("\\").pop() : "Unknown"} <span className="opacity-50">#{log.model_id}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(log.old_values || log.new_values) && (
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="inline-flex items-center justify-end gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            {expandedId === log.id ? "Hide Details" : "View Data"}
                            {expandedId === log.id ? <FiChevronUp /> : <FiChevronDown />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr className="bg-zinc-50 dark:bg-dark-surface/30">
                        <td colSpan={5} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl bg-zinc-900 p-4 font-mono text-xs text-green-400 overflow-x-auto shadow-inner">
                            <div>
                              <p className="mb-2 font-bold text-zinc-400">Old Values:</p>
                              <pre className="whitespace-pre-wrap">{log.old_values ? JSON.stringify(log.old_values, null, 2) : "{}"}</pre>
                            </div>
                            <div>
                              <p className="mb-2 font-bold text-zinc-400">New Values:</p>
                              <pre className="whitespace-pre-wrap">{log.new_values ? JSON.stringify(log.new_values, null, 2) : "{}"}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLogTab;
