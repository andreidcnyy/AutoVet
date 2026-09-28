import { FiAlertTriangle } from 'react-icons/fi';
import { formatCountdown } from '../hooks/useMaintenanceWindow';

interface Props {
  secondsRemaining: number;
  message?: string | null;
}

/**
 * Shown across the top of the portal during the warning period, while the
 * portal is still fully usable, so a client mid-booking can see how long they
 * have rather than being cut off without notice.
 */
export default function MaintenanceBanner({ secondsRemaining, message }: Props) {
  // Under two minutes the warning becomes urgent, so it changes colour.
  const urgent = secondsRemaining <= 120;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-[9998] w-full px-4 py-2.5 text-center ${
        urgent
          ? 'bg-red-500 text-white'
          : 'bg-amber-400 text-amber-950'
      }`}
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-bold">
        <FiAlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {message?.trim() || 'Scheduled maintenance is starting soon.'}
        </span>
        <span className="tabular-nums">
          The portal goes offline in {formatCountdown(secondsRemaining)}.
        </span>
      </div>
    </div>
  );
}
