import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface MaintenanceState {
  enabled: boolean;
  active: boolean;
  upcoming: boolean;
  starts_at: string | null;
  ends_at: string | null;
  seconds_until_start: number | null;
  seconds_until_end: number | null;
  message: string | null;
  server_time: string;
}

export interface MaintenanceWindow {
  /** Phase derived from the clock, not from whenever the last poll happened. */
  enabled: boolean;
  active: boolean;
  upcoming: boolean;
  message: string | null;
  hasEndTime: boolean;
  /** Seconds left on whichever phase is running, or null when there is none. */
  remaining: number | null;
  refresh: () => void;
}

const parse = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Tracks the scheduled maintenance window.
 *
 * The phase is worked out here from starts_at and ends_at rather than read off
 * the last response. Polling alone meant the banner could appear, and the portal
 * could go offline, up to a poll interval late — long enough to look broken.
 * The schedule itself only changes when an admin changes it, so the timestamps
 * are all the client needs to flip at the right second; the poll is just how a
 * new or cancelled schedule is discovered.
 *
 * Countdowns run against the server's clock. Each response carries server_time
 * and the difference from the local clock is applied to every tick, so a device
 * a few minutes out cannot disagree with the clinic's screen or reach zero while
 * the portal is still working.
 */
export function useMaintenanceWindow(pollMs = 10000): MaintenanceWindow {
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const clockOffset = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/maintenance-status', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return;

      const data: MaintenanceState = await res.json();
      if (data.server_time) {
        clockOffset.current = Date.parse(data.server_time) - Date.now();
      }
      setState(data);
    } catch {
      // Leave the last known state in place; the next poll will try again.
      // Going offline should not make a maintenance banner vanish.
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Mirrors MaintenanceWindow::state() on the server, so both sides agree on
  // which phase the window is in at any given moment.
  const derived = useMemo(() => {
    const serverNow = now + clockOffset.current;
    const startsAt = parse(state?.starts_at ?? null);
    const endsAt = parse(state?.ends_at ?? null);
    const flagged = Boolean(state?.enabled);

    const started = flagged && (startsAt === null || serverNow >= startsAt);
    const expired = flagged && endsAt !== null && serverNow >= endsAt;
    const active = started && !expired;
    const upcoming = flagged && !started && !expired;

    const target = active ? endsAt : upcoming ? startsAt : null;

    return {
      enabled: flagged && !expired,
      active,
      upcoming,
      message: state?.message ?? null,
      hasEndTime: endsAt !== null,
      remaining: target === null ? null : Math.max(0, Math.ceil((target - serverNow) / 1000)),
      nextBoundary: target,
    };
  }, [state, now]);

  // Refresh the moment the window changes phase rather than on the next poll,
  // so a cancelled or extended window is picked up immediately afterwards.
  const boundary = derived.nextBoundary;
  useEffect(() => {
    if (boundary === null) return;

    const delay = boundary - (Date.now() + clockOffset.current);
    if (delay <= 0) return;

    const id = setTimeout(refresh, delay + 250);
    return () => clearTimeout(id);
  }, [boundary, refresh]);

  return {
    enabled: derived.enabled,
    active: derived.active,
    upcoming: derived.upcoming,
    message: derived.message,
    hasEndTime: derived.hasEndTime,
    remaining: derived.remaining,
    refresh,
  };
}

/** 3671 -> "1:01:11", 154 -> "2:34". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
