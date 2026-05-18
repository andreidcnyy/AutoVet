import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import clsx from 'clsx';

const TYPE_CLASSES: Record<string, string> = {
  warning: 'bg-amber-50 border-amber-500 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200',
  error:   'bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-900/20 dark:text-rose-200',
  success: 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200',
  info:    'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
};

interface Announcement {
  id: number;
  title: string;
  message?: string;
  type: string;
}

interface Props {
  announcements: Announcement[];
}

export default function BroadcastBanner({ announcements }: Props) {
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const visible = announcements.filter(a => !dismissedIds.includes(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {visible.map(a => (
        <div
          key={a.id}
          className={clsx(
            'rounded-2xl p-4 shadow-sm border-l-4 relative group',
            TYPE_CLASSES[a.type] ?? TYPE_CLASSES.info
          )}
        >
          <button
            onClick={() => setDismissedIds(prev => [...prev, a.id])}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <FiX className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-lg">📢</span>
            <div className="pr-8">
              <p className="font-black uppercase text-[10px] tracking-widest opacity-60">{a.title}</p>
              {a.message && <p className="font-bold text-sm">{a.message}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
