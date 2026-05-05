import { useEffect, useState } from "react";
import { FiMonitor, FiSmartphone, FiX, FiTrash2, FiWifi } from "react-icons/fi";
import clsx from "clsx";

function getDeviceIcon(name) {
  if (!name) return FiMonitor;
  const lower = name.toLowerCase();
  if (lower.includes("ios") || lower.includes("android") || lower.includes("iphone") || lower.includes("ipad")) {
    return FiSmartphone;
  }
  return FiMonitor;
}

function formatDate(dateStr) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ManageDevicesModal({ onClose, apiBase, token }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);
  const [error, setError] = useState(null);

  async function fetchDevices() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/profile/devices`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load devices.");
      const data = await res.json();
      setDevices(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDevices(); }, []);

  async function handleRevoke(deviceId) {
    setRevoking(deviceId);
    try {
      const res = await fetch(`${apiBase}/api/profile/devices/${deviceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to revoke session.");
      }
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (e) {
      setError(e.message);
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-dark-border dark:bg-dark-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <FiWifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Active Sessions</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[420px] overflow-y-auto px-6 py-4 slim-scroll">
          {loading && (
            <p className="py-8 text-center text-sm text-zinc-400">Loading sessions…</p>
          )}
          {error && (
            <p className="py-4 text-center text-sm font-medium text-red-500">{error}</p>
          )}
          {!loading && !error && devices.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">No active sessions found.</p>
          )}
          {!loading && !error && devices.length > 0 && (
            <ul className="space-y-3">
              {devices.map((device) => {
                const Icon = getDeviceIcon(device.name);
                return (
                  <li
                    key={device.id}
                    className={clsx(
                      "flex items-start gap-4 rounded-xl border p-4 transition-colors",
                      device.is_current
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/10"
                        : "border-zinc-100 bg-zinc-50 dark:border-dark-border dark:bg-dark-surface"
                    )}
                  >
                    <span className={clsx(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      device.is_current
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                    )}>
                      <Icon className="h-5 w-5" />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                          {device.name || "Unknown Device"}
                        </p>
                        {device.is_current && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            This device
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        IP: {device.ip_address || "Unknown"}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                        Last active: {formatDate(device.last_used_at)}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                        Signed in: {formatDate(device.created_at)}
                      </p>
                    </div>

                    {!device.is_current && (
                      <button
                        onClick={() => handleRevoke(device.id)}
                        disabled={revoking === device.id}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <FiTrash2 className="h-3 w-3" />
                        {revoking === device.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-100 px-6 py-4 dark:border-dark-border">
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
