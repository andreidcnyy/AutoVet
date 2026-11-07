import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile bot check for the sign-up form.
 *
 * Shown only when VITE_TURNSTILE_SITE_KEY is set, so offline and local builds
 * make no request to Cloudflare. The backend enforces it only when
 * TURNSTILE_SECRET_KEY is set; set both or neither.
 */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY);

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loader: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")));
      script.onerror = () => { loader = null; reject(new Error("Turnstile failed to load")); };
      document.head.appendChild(script);
    });
  }
  return loader;
}

type Props = {
  onToken: (token: string) => void;
  /** Bump to get a fresh token: each one can be verified only once. */
  resetKey?: number;
};

export default function Turnstile({ onToken, resetKey = 0 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!turnstileEnabled) return;
    let cancelled = false;

    loadTurnstile().then((ts) => {
      if (cancelled || !box.current || widgetId.current) return;
      const dark = document.documentElement.classList.contains("dark");
      widgetId.current = ts.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: dark ? "dark" : "light",
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });
    }).catch(() => onTokenRef.current(""));

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey && widgetId.current && window.turnstile) {
      onTokenRef.current("");
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  if (!turnstileEnabled) return null;
  return <div ref={box} className="flex justify-center min-h-[65px]" />;
}
