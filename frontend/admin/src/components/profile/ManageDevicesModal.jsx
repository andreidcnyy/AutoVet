import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiMonitor, FiSmartphone, FiTablet, FiX, FiTrash2, FiWifi,
  FiClock, FiCalendar, FiGlobe, FiShield,
} from "react-icons/fi";
import clsx from "clsx";

// ── UA parsing ────────────────────────────────────────────────────────────────
function parseUA(ua) {
  if (!ua) return { browser: "Unknown Browser", os: "Unknown OS", isMobile: false };

  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let isMobile = false;

  // Browser (order matters — Edge/OPR must come before Chrome)
  if (/Edg\//.test(ua))                          browser = "Microsoft Edge";
  else if (/OPR\/|Opera\//.test(ua))             browser = "Opera";
  else if (/SamsungBrowser\//.test(ua))          browser = "Samsung Browser";
  else if (/Chrome\//.test(ua))                  browser = "Google Chrome";
  else if (/Firefox\//.test(ua))                 browser = "Mozilla Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/MSIE|Trident\//.test(ua))            browser = "Internet Explorer";

  // OS
  if (/iPhone/.test(ua))                         { os = "iPhone";   isMobile = true; }
  else if (/iPad/.test(ua))                      { os = "iPad";     isMobile = true; }
  else if (/Android/.test(ua))                   { os = "Android";  isMobile = true; }
  else if (/Windows NT 10/.test(ua))             os = "Windows 10/11";
  else if (/Windows NT 6\.3/.test(ua))           os = "Windows 8.1";
  else if (/Windows NT 6\.1/.test(ua))           os = "Windows 7";
  else if (/Windows/.test(ua))                   os = "Windows";
  else if (/Macintosh|Mac OS X/.test(ua))        os = "macOS";
  else if (/Linux/.test(ua))                     os = "Linux";

  return { browser, os, isMobile };
}

function getDeviceIcon(ua) {
  if (!ua) return FiMonitor;
  if (/iPhone|Android.*Mobile/.test(ua)) return FiSmartphone;
  if (/iPad|Android/.test(ua))           return FiTablet;
  return FiMonitor;
}

function getBrowserColor(browser) {
  if (browser.includes("Chrome"))  return "text-amber-500";
  if (browser.includes("Firefox")) return "text-orange-500";
  if (browser.includes("Safari"))  return "text-blue-500";
  if (browser.includes("Edge"))    return "text-indigo-500";
  return "text-zinc-500";
}

function formatDate(dateStr) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)   return "Just now";
  if (mins < 60)  return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
// ─────────────────────────────────────────────────────────────────────────────

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
      if (!res.ok) throw new Error("Failed to load sessions.");
      setDevices(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDevices(); }, []);

  async function handleRevoke(deviceId) {
    setRevoking(deviceId);
    setError(null);
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-dark-border dark:bg-dark-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-7 py-5 dark:border-dark-border">
          <div>
            <div className="flex items-center gap-2">
              <FiShield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Active Sessions</h2>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              All devices currently signed in to your account
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="max-h-[500px] overflow-y-auto px-7 py-5 slim-scroll">
          {loading && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <p className="text-sm text-zinc-400">Loading sessions…</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/40 dark:bg-red-900/10">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && devices.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-400">No active sessions found.</p>
          )}

          {!loading && !error && devices.length > 0 && (
            <ul className="space-y-3">
              {devices.map((device) => {
                const { browser, os, isMobile } = parseUA(device.user_agent);
                const Icon = getDeviceIcon(device.user_agent);
                const browserColor = getBrowserColor(browser);
                const lastActive = device.last_used_at || device.created_at;

                return (
                  <li
                    key={device.id}
                    className={clsx(
                      "rounded-2xl border p-5 transition-colors",
                      device.is_current
                        ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-900/10"
                        : "border-zinc-200 bg-zinc-50 dark:border-dark-border dark:bg-dark-surface"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Device icon */}
                      <div className={clsx(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                        device.is_current
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      )}>
                        <Icon className={clsx(
                          "h-6 w-6",
                          device.is_current ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"
                        )} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={clsx("text-sm font-bold", browserColor)}>{browser}</span>
                          <span className="text-zinc-300 dark:text-zinc-600">·</span>
                          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{os}</span>
                          {isMobile && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                              Mobile
                            </span>
                          )}
                          {device.is_current && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              This device
                            </span>
                          )}
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <FiGlobe className="h-3 w-3 shrink-0" />
                            <span className="truncate">{device.ip_address || "IP unknown"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <FiClock className="h-3 w-3 shrink-0" />
                            <span>{timeAgo(lastActive)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <FiCalendar className="h-3 w-3 shrink-0" />
                            <span>Signed in {formatDate(device.created_at)}</span>
                          </div>
                        </div>

                        {device.user_agent && (
                          <p className="mt-2 truncate text-[11px] text-zinc-400 dark:text-zinc-600" title={device.user_agent}>
                            {device.user_agent}
                          </p>
                        )}
                      </div>

                      {/* Revoke button */}
                      {!device.is_current && (
                        <button
                          onClick={() => handleRevoke(device.id)}
                          disabled={revoking === device.id}
                          className="flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                          {revoking === device.id ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-7 py-4 dark:border-dark-border">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {devices.length} active session{devices.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-5 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-colors dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
