import { useState } from 'react';
import { FiVolume2, FiX } from 'react-icons/fi';
import clsx from 'clsx';

const STYLES = {
  warning: 'bg-amber-50 border-amber-400 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200',
  error:   'bg-rose-50 border-rose-400 text-rose-900 dark:bg-rose-900/20 dark:text-rose-200',
  success: 'bg-emerald-50 border-emerald-400 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200',
  info:    'bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200',
};

export default function BroadcastBanner({ announcements }) {
  const [dismissedIds, setDismissedIds] = useState([]);
  const visible = announcements.filter(a => !dismissedIds.includes(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col">
      {visible.map(a => (
        <div
          key={a.id}
          className={clsx(
            'flex items-center gap-3 border-l-4 px-4 py-2.5',
            STYLES[a.type] ?? STYLES.info
          )}
        >
          <FiVolume2 className="w-4 h-4 shrink-0 opacity-60" />
          <p className="flex-1 text-sm min-w-0">
            <span className="font-semibold">{a.title}</span>
            {a.message && <span className="opacity-75 ml-1.5">{a.message}</span>}
          </p>
          <button
            onClick={() => setDismissedIds(prev => [...prev, a.id])}
            className="shrink-0 p-1 rounded hover:opacity-60 transition-opacity"
            aria-label="Dismiss"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
