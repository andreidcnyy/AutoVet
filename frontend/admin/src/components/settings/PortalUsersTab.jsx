import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { FiSearch, FiRefreshCcw, FiUserCheck, FiUserX, FiAlertCircle, FiX } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../api";

const STATUS_BADGE = {
  active:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  suspended:   "bg-amber-100 text-amber-700 border-amber-200",
  deactivated: "bg-rose-100 text-rose-700 border-rose-200",
  deleted:     "bg-zinc-100 text-zinc-500 border-zinc-200",
};

export default function PortalUsersTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ last_page: 1, total: 0 });
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { user, action }

  const fetchUsers = useCallback(async (signal) => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const data = await api.get("/api/portal-users", {
        params: { search, status: statusFilter, page },
        signal,
      });
      setUsers(data?.data || []);
      setPagination({ last_page: data?.last_page || 1, total: data?.total || 0 });
    } catch (_) {}
    finally { setLoading(false); }
  }, [user?.token, search, statusFilter, page]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchUsers(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchUsers]);

  const handleAction = async (portalUserId, action) => {
    setActionLoading(portalUserId + action);
    try {
      const res = await api.post(`/api/portal-users/${portalUserId}/${action}`);
      toast.success(res?.message || `Action successful.`);
      setUsers(prev => prev.map(u => u.id === portalUserId ? { ...u, status: res?.status ?? u.status } : u));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Action failed.");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const openConfirm = (portalUser, action) => setConfirmModal({ user: portalUser, action });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black italic">Portal Users</h2>
          <p className="text-xs text-zinc-400 font-bold mt-1">{pagination.total} registered client accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name / email / phone..."
              className="h-10 pl-9 pr-9 rounded-xl border border-zinc-200 bg-white dark:bg-dark-surface dark:border-dark-border text-sm w-56"
            />
            {search && (
              <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                <FiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-10 px-3 rounded-xl border border-zinc-200 bg-white dark:bg-dark-surface dark:border-dark-border text-sm font-bold"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <button onClick={() => fetchUsers()} className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-dark-surface hover:bg-zinc-200 transition-all">
            <FiRefreshCcw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/50">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email / Phone</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-dark-border">
              {loading && users.length === 0
                ? Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-5"><div className="h-3 bg-zinc-100 rounded-full w-3/4" /></td>
                  </tr>
                ))
                : users.map(u => {
                  const status = u.deleted_at ? "deleted" : (u.status || "active");
                  return (
                    <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30 transition-all">
                      <td className="px-6 py-4">
                        <p className="font-black">{u.name}</p>
                        {u.owner?.name && <p className="text-xs text-zinc-400 font-bold">Owner: {u.owner.name}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold">{u.email}</p>
                        {u.phone && <p className="text-xs text-zinc-400">{u.phone}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx("px-3 py-1 rounded-xl text-[10px] font-black uppercase border", STATUS_BADGE[status] || STATUS_BADGE.active)}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-zinc-400">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {status === "active" && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openConfirm(u, "suspend")}
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 rounded-xl text-xs font-black uppercase border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all disabled:opacity-50"
                            >Suspend</button>
                            <button
                              onClick={() => openConfirm(u, "deactivate")}
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 rounded-xl text-xs font-black uppercase border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all disabled:opacity-50"
                            >Deactivate</button>
                          </div>
                        )}
                        {(status === "suspended" || status === "deactivated") && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openConfirm(u, "reactivate")}
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 rounded-xl text-xs font-black uppercase border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50"
                            >
                              <FiUserCheck className="inline h-3 w-3 mr-1" />Reactivate
                            </button>
                            {status === "suspended" && (
                              <button
                                onClick={() => openConfirm(u, "deactivate")}
                                disabled={!!actionLoading}
                                className="px-3 py-1.5 rounded-xl text-xs font-black uppercase border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all disabled:opacity-50"
                              >Deactivate</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              }
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-zinc-400 font-black italic uppercase text-sm">No portal users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={clsx("h-8 w-8 rounded-lg text-xs font-black border transition-all", page === p ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-dark-surface border-zinc-200 dark:border-dark-border text-zinc-500 hover:border-emerald-400")}>{p}</button>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-dark-card p-8 shadow-2xl">
            <div className={clsx("flex items-center gap-3 mb-4", confirmModal.action === "reactivate" ? "text-emerald-600" : confirmModal.action === "suspend" ? "text-amber-600" : "text-rose-600")}>
              {confirmModal.action === "reactivate" ? <FiUserCheck className="h-6 w-6" /> : <FiUserX className="h-6 w-6" />}
              <h3 className="text-lg font-black capitalize">{confirmModal.action} Account</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              {confirmModal.action === "suspend" && `This will temporarily block ${confirmModal.user.name} from logging in. You can reactivate at any time.`}
              {confirmModal.action === "deactivate" && `This will permanently block ${confirmModal.user.name} from logging in until reactivated.`}
              {confirmModal.action === "reactivate" && `This will restore login access for ${confirmModal.user.name}.`}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)} className="px-5 py-2.5 font-bold text-zinc-500 hover:text-zinc-700">Cancel</button>
              <button
                onClick={() => handleAction(confirmModal.user.id, confirmModal.action)}
                disabled={!!actionLoading}
                className={clsx("px-5 py-2.5 rounded-xl font-black text-white transition-all disabled:opacity-50",
                  confirmModal.action === "reactivate" ? "bg-emerald-600 hover:bg-emerald-700" :
                  confirmModal.action === "suspend" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                {actionLoading ? "Processing..." : `Confirm ${confirmModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
