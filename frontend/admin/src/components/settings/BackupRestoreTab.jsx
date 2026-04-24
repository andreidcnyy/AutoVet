import React, { useState, useEffect } from "react";
import { FiDatabase, FiDownload, FiRefreshCw, FiTrash2, FiAlertTriangle, FiCheckCircle, FiFileText } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

function BackupRestoreTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(null);

  const authHeader = {
    "Authorization": `Bearer ${user?.token}`,
    "Accept": "application/json"
  };

  const controllerRef = React.useRef(null);

  const fetchBackups = () => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    fetch("/api/backups", { headers: authHeader, signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
           throw new Error("Failed to connect to backup server.");
        }
        return res.json();
      })
      .then((payload) => {
        const data = payload.data || [];
        setBackups(data);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error("Backup Fetch Error:", err);
        toast.error("Could not load backups. Please check your connection.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  };

  useEffect(() => {
    fetchBackups();
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  const createBackup = () => {
    setProcessing(true);
    fetch("/api/backups", { 
      method: "POST",
      headers: authHeader
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to create backup");
        return data;
      })
      .then((data) => {
        toast.success(data.message);
        fetchBackups();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setProcessing(false));
  };

  const deleteBackup = (filename) => {
    if (!confirm(`Are you sure you want to delete backup: ${filename}?`)) return;
    
    setProcessing(true);
    fetch(`/api/backups/${filename}`, { 
      method: "DELETE",
      headers: authHeader
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to delete backup");
        return data;
      })
      .then((data) => {
        toast.success(data.message);
        fetchBackups();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setProcessing(false));
  };

  const restoreBackup = (filename) => {
    setProcessing(true);
    setShowConfirmRestore(null);
    fetch("/api/backups/restore", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to restore database");
        return data;
      })
      .then((data) => {
        toast.success(data.message);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setProcessing(false));
  };

  const downloadBackup = (filename) => {
    setProcessing(true);
    fetch(`/api/backups/download/${filename}`, {
      headers: authHeader
    })
      .then(async (res) => {
        if (!res.ok) {
           const data = await res.json();
           throw new Error(data.message || "Failed to download backup");
        }
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Download started");
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setProcessing(false));
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="card-shell flex min-h-[500px] flex-col">
      <div className="border-b border-zinc-200 px-6 py-5 dark:border-dark-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
              <FiDatabase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Backup & Restore</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage database snapshots and disaster recovery</p>
            </div>
          </div>
          <button
            onClick={createBackup}
            disabled={processing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50 transition-all duration-200"
          >
            {processing ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiDatabase className="h-4 w-4" />}
            Create New Backup
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="mx-6 mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-900/10">
        <div className="flex gap-3">
          <FiAlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-bold">Important Notice</p>
            <p className="mt-1 leading-relaxed opacity-80">
              Restoring a backup will overwrite the current database. All data added since the backup was created will be permanently lost. Use with extreme caution.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-zinc-500">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-500 dark:border-dark-border">
            <FiFileText className="mb-2 h-8 w-8 text-zinc-300" />
            <p className="font-medium">No backups found</p>
            <p className="text-sm">Kick off your first manual backup to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {backups.map((backup) => (
              <div
                key={backup.filename}
                className="group relative rounded-2xl border border-zinc-200 bg-white p-4 transition-all duration-200 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/5 dark:border-dark-border dark:bg-dark-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-dark-surface dark:text-zinc-400">
                      <FiDatabase className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">{backup.filename}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{new Date(backup.created_at).toLocaleString()}</span>
                        <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                        <span>{formatSize(backup.size)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex animate-in fade-in slide-in-from-bottom-2 items-center justify-end gap-2 border-t border-zinc-50 pt-3 dark:border-dark-border/50">
                  <button
                    onClick={() => downloadBackup(backup.filename)}
                    disabled={processing}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-dark-surface"
                    title="Download Backup"
                  >
                    {processing ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiDownload className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setShowConfirmRestore(backup.filename)}
                    disabled={processing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/40 dark:bg-indigo-900/20 dark:text-indigo-400"
                  >
                    <FiRefreshCw className="h-3.5 w-3.5" />
                    Restore
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.filename)}
                    disabled={processing}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/10"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Confirm Restore Overlay */}
                {showConfirmRestore === backup.filename && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/95 p-4 text-center backdrop-blur-sm dark:bg-dark-card/95">
                    <FiAlertTriangle className="mb-2 h-8 w-8 text-rose-500" />
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Restore this backup?</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">This action cannot be undone.</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setShowConfirmRestore(null)}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200 dark:bg-dark-surface dark:text-zinc-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => restoreBackup(backup.filename)}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                      >
                        Yes, Restore Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BackupRestoreTab;
