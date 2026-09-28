import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import Toggle from "./Toggle";

const UNITS = [
  { value: "seconds", label: "seconds" },
  { value: "minutes", label: "minutes" },
  { value: "hours", label: "hours" },
];

/** 3671 -> "1:01:11", 154 -> "2:34". */
function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n) => String(n).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/**
 * Schedules a maintenance window rather than flipping a switch.
 *
 * Toggling on takes a warning period and a duration: portal users keep working
 * through the warning while a countdown shows, then the outage runs and lifts
 * itself. Nothing here has to be switched back off by hand.
 *
 * Every countdown is measured against the server clock, not the browser's. The
 * status response carries server_time, and the offset between that and this
 * machine is applied to every tick — otherwise a laptop running a few minutes
 * fast would show a time that disagrees with the one portal users see.
 */
export default function MaintenanceModeCard() {
  const toast = useToast();
  const { user } = useAuth();

  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingScheduled, setPendingScheduled] = useState(false);
  const [startsIn, setStartsIn] = useState(5);
  const [startsInUnit, setStartsInUnit] = useState("minutes");
  const [lastsFor, setLastsFor] = useState(30);
  const [lastsForUnit, setLastsForUnit] = useState("minutes");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // server clock - this machine's clock, in ms.
  const clockOffset = useRef(0);

  const loadStatus = useCallback(async () => {
    try {
      // no-store because this is read on a timer to decide whether the portal is
      // up: a cached copy would show a window that has already changed. The old
      // toggle read maintenance_mode out of a 5-minute localStorage cache, which
      // is why a change could appear to take minutes to show.
      const res = await fetch("/api/maintenance-status", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = await res.json();
      if (data.server_time) {
        clockOffset.current = new Date(data.server_time).getTime() - Date.now();
      }
      setStatus(data);
    } catch {
      // A failed poll should leave the last known state on screen rather than
      // blanking the card; the next tick will try again.
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const poll = setInterval(loadStatus, 10000);
    return () => clearInterval(poll);
  }, [loadStatus]);

  // Drives the countdown. Kept separate from the poll so the number moves every
  // second without hitting the API every second.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const serverNow = now + clockOffset.current;

  // Worked out from the timestamps rather than read off the last response, so
  // the card flips from Scheduled to Offline on the second it happens instead
  // of whenever the next poll lands. Mirrors MaintenanceWindow::state().
  const phase = useMemo(() => {
    const flagged = Boolean(status?.enabled);
    const startsAt = status?.starts_at ? Date.parse(status.starts_at) : null;
    const endsAt = status?.ends_at ? Date.parse(status.ends_at) : null;

    const started = flagged && (startsAt === null || serverNow >= startsAt);
    const expired = flagged && endsAt !== null && serverNow >= endsAt;
    const active = started && !expired;
    const upcoming = flagged && !started && !expired;
    const target = active ? endsAt : upcoming ? startsAt : null;

    return {
      scheduled: flagged && !expired,
      active,
      hasEndTime: endsAt !== null,
      remaining: target === null ? null : Math.max(0, Math.ceil((target - serverNow) / 1000)),
      boundary: target,
    };
  }, [status, serverNow]);

  // Re-read the window the instant it changes phase, rather than up to a poll
  // interval later.
  const boundary = phase.boundary;
  useEffect(() => {
    if (boundary === null) return;

    const delay = boundary - (Date.now() + clockOffset.current);
    if (delay <= 0) return;

    const id = setTimeout(loadStatus, delay + 250);
    return () => clearTimeout(id);
  }, [boundary, loadStatus]);

  const save = async (body) => {
    setPendingScheduled(Boolean(body.enabled));
    setSaving(true);
    try {
      const res = await fetch("/api/maintenance", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Request failed");
      }

      const data = await res.json();
      if (data.server_time) {
        clockOffset.current = new Date(data.server_time).getTime() - Date.now();
      }
      setStatus(data);
      return true;
    } catch (e) {
      toast.error(e.message || "Failed to update maintenance mode.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const schedule = async () => {
    const ok = await save({
      enabled: true,
      starts_in: Number(startsIn) || 0,
      starts_in_unit: startsInUnit,
      lasts_for: Number(lastsFor) || 0,
      lasts_for_unit: lastsForUnit,
      message: message.trim() || null,
    });

    if (ok) {
      const when = Number(startsIn) > 0 ? `in ${startsIn} ${startsInUnit}` : "now";
      toast.success(`Maintenance scheduled to begin ${when}.`);
    }
  };

  const cancel = async () => {
    if (await save({ enabled: false })) {
      toast.success("Maintenance mode cancelled.");
    }
  };

  // While a save is in flight, show the state being moved to rather than the one
  // being left. The round trip is about a second, and without this the toggle
  // sits still long enough to look like the click was missed — so people click
  // again.
  const scheduled = saving ? pendingScheduled : phase.scheduled;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-dark-border dark:bg-dark-surface">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            System Maintenance Mode
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Schedules an outage for the client portal. Clinic staff are never blocked.
          </p>
        </div>
        <Toggle
          checked={scheduled}
          onChange={scheduled ? cancel : schedule}
          disabled={saving}
        />
      </div>

      {!scheduled && (
        <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-dark-border">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Starts in
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={startsIn}
                  onChange={(e) => setStartsIn(e.target.value)}
                  className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-card dark:text-zinc-100"
                />
                <select
                  value={startsInUnit}
                  onChange={(e) => setStartsInUnit(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-card dark:text-zinc-100"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <span className="mt-1 block text-[11px] text-zinc-400">
                Portal stays usable, with a countdown shown to clients.
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Lasts for
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={lastsFor}
                  onChange={(e) => setLastsFor(e.target.value)}
                  className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-card dark:text-zinc-100"
                />
                <select
                  value={lastsForUnit}
                  onChange={(e) => setLastsForUnit(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-card dark:text-zinc-100"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <span className="mt-1 block text-[11px] text-zinc-400">
                Leave 0 to stay in maintenance until switched off.
              </span>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Message to clients <span className="font-normal normal-case">(optional)</span>
            </span>
            <input
              type="text"
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Upgrading the booking system."
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-dark-border dark:bg-dark-card dark:text-zinc-100"
            />
          </label>
        </div>
      )}

      {scheduled && (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-dark-border">
          <div
            className={`rounded-lg p-4 ${
              phase.active
                ? "bg-red-50 dark:bg-red-900/20"
                : "bg-amber-50 dark:bg-amber-900/20"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-wide ${
                phase.active
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {phase.active ? "Portal is offline" : "Scheduled"}
            </p>

            {phase.remaining !== null && (
              <p className="mt-1 text-2xl font-black tabular-nums text-zinc-800 dark:text-zinc-100">
                {formatCountdown(phase.remaining)}
                <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {phase.active ? "Back online" : "Until maintenance"}
                </span>
              </p>
            )}

            {phase.active && !phase.hasEndTime && (
              <p className="mt-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Until switched off manually
              </p>
            )}

            {status?.message && (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                “{status.message}”
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="mt-3 w-full rounded-lg border-2 border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-dark-border dark:text-zinc-300 dark:hover:bg-dark-card"
          >
            {saving ? "Working…" : phase.active ? "End maintenance now" : "Cancel scheduled maintenance"}
          </button>
        </div>
      )}
    </div>
  );
}
