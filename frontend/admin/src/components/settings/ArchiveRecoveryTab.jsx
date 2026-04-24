import React, { useState, useEffect } from "react";
import clsx from "clsx";
import { FiRefreshCcw, FiTrash2, FiAlertTriangle } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

const ARCHIVE_TYPES = [
  { id: "pets", label: "Pets" },
  { id: "owners", label: "Owners" },
  { id: "services", label: "Services" },
  { id: "inventories", label: "Inventory" },
  { id: "admins", label: "Users" },
];

export default function ArchiveRecoveryTab() {
  const [activeType, setActiveType] = useState("pets");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 20
  });
  const toast = useToast();
  const { user } = useAuth();
  const controllerRef = React.useRef(null);

  const fetchArchives = async (type, page = 1) => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/archives/${type}?page=${page}`, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch archived records.");
      const data = await response.json();
      setItems(data.data || []);
      setPagination({
        current_page: data.current_page,
        last_page: data.last_page,
        total: data.total,
        per_page: data.per_page
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      toast.error(err.message);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchArchives(activeType, 1);
    }
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [activeType, user?.token]);

  const handlePageChange = (page) => {
    fetchArchives(activeType, page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRestore = async (id, name) => {
    if (!window.confirm(`Are you sure you want to restore "${name}"? It will be active again.`)) return;

    try {
      const res = await fetch(`/api/archives/${activeType}/${id}/restore`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to restore.");

      toast.success(data.message || "Restored successfully.");
      // Refresh current page
      fetchArchives(activeType, pagination.current_page);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleForceDelete = async (id, name) => {
    if (!window.confirm(`PERMANENT DELETE: Cannot be undone.\nAre you absolutely sure you want to purge "${name}" forever?`)) return;

    try {
      const res = await fetch(`/api/archives/${activeType}/${id}/force`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to permanently delete.");

      toast.success(data.message || "Item permanently purged.");
      // Refresh current page
      fetchArchives(activeType, pagination.current_page);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const getRecordName = (item) => {
    return item.name || item.item_name || item.title || `Unknown ID: ${item.id}`;
  };

  const PaginationControls = ({ isTop = false }) => (
    pagination.last_page > 1 && (
      <div className={clsx(
        "flex items-center justify-between border border-zinc-200 bg-zinc-50/50 px-6 py-3 dark:border-dark-border dark:bg-dark-surface/30 rounded-xl",
        isTop ? "mb-4" : "mt-4"
      )}>
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Showing <span className="text-zinc-900 dark:text-zinc-50">{(pagination.current_page - 1) * pagination.per_page + 1}-{Math.min(pagination.current_page * pagination.per_page, pagination.total)}</span> of <span className="text-zinc-900 dark:text-zinc-50">{pagination.total}</span> records
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.current_page - 1)}
            disabled={pagination.current_page === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center gap-1">
            {[...Array(Math.min(5, pagination.last_page))].map((_, i) => {
              let pageNum;
              if (pagination.last_page <= 5) pageNum = i + 1;
              else if (pagination.current_page <= 3) pageNum = i + 1;
              else if (pagination.current_page >= pagination.last_page - 2) pageNum = pagination.last_page - 4 + i;
              else pageNum = pagination.current_page - 2 + i;

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={clsx(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black transition-all",
                    pagination.current_page === pageNum
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                      : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(pagination.current_page + 1)}
            disabled={pagination.current_page === pagination.last_page}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    )
  );

  return (
    <div className="card-shell p-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Archive & Recovery</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Restore soft-deleted records or permanently purge them from the database.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-dark-border">
        {ARCHIVE_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveType(t.id)}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              activeType === t.id
                ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <PaginationControls isTop={true} />
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-dark-border dark:text-zinc-400">
              <tr>
                <th className="py-3 pr-4 font-semibold">Record Name</th>
                <th className="py-3 px-4 font-semibold">Deleted At</th>
                <th className="py-3 px-4 font-semibold">Deleted By</th>
                <th className="py-3 px-4 font-semibold">Expires On</th>
                <th className="py-3 pl-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-zinc-500">
                    Loading archives...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No {ARCHIVE_TYPES.find(t => t.id === activeType)?.label.toLowerCase()} in the archive.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const name = getRecordName(item);
                  const isExpired = item.restore_until && new Date(item.restore_until) < new Date();
                  
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-dark-surface/50">
                      <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {name}
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">
                        {new Date(item.deleted_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">
                        {item.deleter?.name || "System/Unknown"}
                      </td>
                      <td className="py-3 px-4">
                        {item.restore_until ? (
                          <span className={clsx(
                            "inline-flex items-center gap-1 font-semibold",
                            isExpired ? "text-rose-500" : "text-amber-600 dark:text-amber-400"
                          )}>
                            {isExpired && <FiAlertTriangle className="h-3 w-3" />}
                            {new Date(item.restore_until).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-zinc-400">Never</span>
                        )}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleRestore(item.id, name)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                          >
                            <FiRefreshCcw className="h-3.5 w-3.5" />
                            Restore
                          </button>
                          <button
                            onClick={() => handleForceDelete(item.id, name)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" />
                            Purge
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls />
      </div>
    </div>
  );
}
