import { useRouteError, Link } from "react-router-dom";

export default function RouterErrorElement() {
  const error = useRouteError();
  console.error("Router Error:", error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center dark:bg-dark-bg">
      <div className="mb-6 rounded-full bg-rose-100 p-4 dark:bg-rose-900/30">
        <svg className="h-12 w-12 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Unexpected Error</h1>
      <p className="mt-2 max-w-md text-zinc-500 dark:text-zinc-400">
        The application encountered an error while navigating. This is often caused by trying to render a backend error object.
      </p>
      
      <div className="mt-6 w-full max-w-lg overflow-auto rounded-xl bg-rose-50 p-4 text-left dark:bg-rose-900/10">
        <p className="font-mono text-xs text-rose-700 dark:text-rose-400 break-all">
          {error?.statusText || error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error))}
        </p>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950"
        >
          Reload Page
        </button>
        <Link
          to="/login"
          className="rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-sm font-bold text-zinc-600 transition-all hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-400"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
