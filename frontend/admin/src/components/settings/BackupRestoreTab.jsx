import React, { useState, useEffect } from "react";
import { FiDatabase, FiDownload, FiRefreshCw, FiTrash2, FiCheckCircle, FiFileText } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

/** "Today", "Yesterday", "3 days ago" — so staleness reads at a glance. */
function describeAge(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.round(days / 30);
  return months <= 1 ? "About a month ago" : `About ${months} months ago`;
}

function BackupRestoreTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  // Restore is not available for CSV backups

  const authHeader = {
    "Authorization": `Bearer ${user?.token}`,
    "Accept": "application/json"
  };

  const controllerRef = React.useRef(null);
  // Track "busy" in a ref too, so the polling interval can skip a refresh
  // while the user is creating/deleting/downloading (avoids races that make
  // items flicker or disappear).
  const processingRef = React.useRef(false);
  const setBusy = (v) => { processingRef.current = v; setProcessing(v); };

  const fetchBackups = (showLoading = false) => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (showLoading) setLoading(true);
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
    fetchBackups(true);
    const poll = setInterval(() => { if (!processingRef.current) fetchBackups(false); }, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchBackups(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const createBackup = () => {
    setBusy(true);
    fetch("/api/backups", {
      method: "POST",
      headers: authHeader
    })
      .then(async (res) => {
        // A gateway that times out mid-backup returns an empty (or non-JSON)
        // body, so parse defensively — otherwise every such failure surfaces
        // as "Unexpected end of JSON input" instead of the real status.
        const text = await res.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }

        if (!res.ok) {
          throw new Error(data?.message || `Failed to create backup (HTTP ${res.status}).`);
        }
        if (!data) {
          throw new Error(
            "The server closed the connection before the backup finished. It may still be running — check the list again in a moment."
          );
        }
        return data;
      })
      .then((data) => {
        toast.success(data.message);
        if (data.backup) {
          // Prepend instantly; guard against a background poll having already added it
          setBackups((prev) =>
            prev.some((b) => b.filename === data.backup.filename)
              ? prev
              : [data.backup, ...prev]
          );
        } else {
          fetchBackups();
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setBusy(false));
  };

  const deleteBackup = (filename) => {
    if (!confirm(`Are you sure you want to delete backup: ${filename}?`)) return;

    setBusy(true);
    // Remove from the list immediately so it disappears without a refresh.
    const previous = backups;
    setBackups((prev) => prev.filter((b) => b.filename !== filename));
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
      })
      .catch((err) => {
        // Restore the item if the delete failed on the server.
        toast.error(err.message);
        setBackups(previous);
      })
      .finally(() => setBusy(false));
  };

  const downloadBackup = (filename) => {
    setBusy(true);
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
      .finally(() => setBusy(false));
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
              <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Backups</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Keep a copy of your clinic records somewhere safe</p>
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

      {/* Written for whoever runs the clinic, not for whoever wrote the export:
          what a backup is, what to do with it, and what it will not do. */}
      <div className="mx-6 mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800/30 dark:bg-sky-900/10">
        <div className="flex gap-3">
          <FiCheckCircle className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="text-sm text-sky-800 dark:text-sky-200">
            <p className="font-bold">How this works</p>
            <ul className="mt-1.5 space-y-1 leading-relaxed opacity-80">
              <li>Press <b>Create New Backup</b> to save a snapshot of your clients, patients, appointments, invoices and stock as they are right now.</li>
              <li>Press <b>Download</b> on any backup to save the file to this computer. Keep it somewhere separate, such as a USB drive or cloud storage.</li>
              <li>The file opens in Excel or Google Sheets, one sheet per kind of record.</li>
              <li>Backups are a copy for safekeeping. Restoring one back into the system is done by your IT support, not from this page.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-zinc-500">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-500 dark:border-dark-border">
            <FiFileText className="mb-2 h-8 w-8 text-zinc-300" />
            <p className="font-medium">No backups yet</p>
            <p className="text-sm">Press Create New Backup above to make your first one.</p>
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
                    {/* When it was taken is what anyone actually looks for.
                        The filename is kept, but demoted to a caption. */}
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {new Date(backup.created_at).toLocaleDateString(undefined, {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>
                          {new Date(backup.created_at).toLocaleTimeString(undefined, {
                            hour: "numeric", minute: "2-digit",
                          })}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                        <span>{describeAge(backup.created_at)}</span>
                        <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                        <span>{formatSize(backup.size)}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                        {backup.filename}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex animate-in fade-in slide-in-from-bottom-2 items-center justify-end gap-2 border-t border-zinc-50 pt-3 dark:border-dark-border/50">
                  <button
                    onClick={() => downloadBackup(backup.filename)}
                    disabled={processing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400"
                    title="Download CSV Backup"
                  >
                    {processing ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiDownload className="h-3.5 w-3.5" />}
                    Download
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.filename)}
                    disabled={processing}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/10"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BackupRestoreTab;
