/**
 * Whether to offer Google sign-in, and the loader for its script.
 *
 * The button depends on accounts.google.com being reachable, so on a machine
 * with no internet it can only fail — and it failed quietly, with a "Google
 * sign-in is loading, please try again in a moment" that never resolved.
 *
 * Leaving VITE_GOOGLE_CLIENT_ID empty hides the button and the divider above
 * it, so email and password are plainly the way in.
 *
 * The script is injected here rather than sitting in index.html, so an offline
 * build makes no request for it at all. A <script src> to a host that cannot be
 * resolved still costs a DNS failure on every page load, which is wasted time
 * on the one screen a demo opens first.
 */
export const googleSignInEnabled = Boolean(
  (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
);

const SRC = 'https://accounts.google.com/gsi/client';

/** Loads Google's client once, and only when sign-in is actually offered. */
export function loadGoogleScript(): void {
  if (!googleSignInEnabled) return;
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[src="${SRC}"]`)) return;

  const script = document.createElement('script');
  script.src = SRC;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}
