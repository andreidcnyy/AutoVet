import { useCallback, useEffect, useRef, useState } from 'react';

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
  state: MaintenanceState | null;
  /** Seconds left on whichever phase is running, or null when there is none. */
  remaining: number | null;
  refresh: () => void;
}

/**
 * Tracks the scheduled maintenance window.
 *
 * The countdown runs against the server's clock rather than this device's. Each
 * response carries server_time, and the difference from the local clock is
 * applied to every tick — a phone a few minutes out would otherwise show a
 * different number from the clinic's admin screen, and could count to zero
 * while the portal was still working.
 */
export function useMaintenanceWindow(pollMs = 15000): MaintenanceWindow {
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const clockOffset = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/maintenance-status', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;

      const data: MaintenanceState = await res.json();
      if (data.server_time) {
        clockOffset.current = new Date(data.server_time).getTime() - Date.now();
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

  let remaining: number | null = null;

  if (state?.enabled) {
    const target = state.active ? state.ends_at : state.starts_at;
    if (target) {
      remaining = Math.max(
        0,
        Math.ceil((new Date(target).getTime() - (now + clockOffset.current)) / 1000)
      );
    }
  }

  // The phase changes between polls, so pick the new one up the moment a
  // countdown runs out instead of waiting for the next interval.
  const hitZero = remaining === 0;
  useEffect(() => {
    if (hitZero) refresh();
  }, [hitZero, refresh]);

  return { state, remaining, refresh };
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
