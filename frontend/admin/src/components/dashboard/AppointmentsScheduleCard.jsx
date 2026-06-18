import { FiCalendar, FiClock, FiUser } from "react-icons/fi";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";

const StatusBadge = ({ status }) => {
  const colors = { 
    'approved': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', 
    'pending': 'bg-amber-500/10 text-amber-600 dark:text-amber-400', 
    'completed': 'bg-blue-500/10 text-blue-600 dark:text-blue-400', 
    'cancelled': 'bg-rose-500/10 text-rose-600 dark:text-rose-400', 
    'declined': 'bg-rose-600/10 text-rose-500' 
  };
  return (
    <span className={clsx("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", colors[status?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600')}>
      {status}
    </span>
  );
};

function AppointmentsScheduleCard({ appointments, loading }) {
  const navigate = useNavigate();

  return (
    <div className="card-shell overflow-hidden flex flex-col h-full bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5 dark:border-dark-border bg-zinc-50/30 dark:bg-dark-surface/10">
        <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2 uppercase">
          <FiCalendar className="text-autovet-teal" />
          Today's Schedule
        </h3>
        <button
          onClick={() => navigate("/appointments")}
          className="text-[10px] font-black uppercase tracking-widest text-autovet-teal hover:opacity-80 transition-opacity"
        >
          View Calendar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto slim-scroll max-h-[450px]">
        {loading ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 space-y-4">
            <div className="h-8 w-8 border-4 border-autovet-teal/20 border-t-autovet-teal rounded-full animate-spin" />
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Fetching schedule...</p>
          </div>
        ) : (!appointments || appointments.length === 0) ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="rounded-full bg-zinc-100 p-4 dark:bg-dark-surface">
              <FiCalendar className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            </div>
            <div>
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">No Appointments</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">The clinic schedule is clear for today.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-dark-border">
            {appointments.map((appt) => (
              <div key={appt.id} className="px-6 py-3.5 hover:bg-zinc-50/50 dark:hover:bg-dark-surface/30 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-autovet-teal">
                    <FiClock className="h-3 w-3" />
                    <span className="text-[11px] font-black uppercase tracking-tight">{appt.time}</span>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight truncate">{appt.pet_name}</h4>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1 truncate">
                      <FiUser className="h-2 w-2" /> {appt.owner_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Service</p>
                    <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase truncate max-w-[120px]">{appt.service}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-50/50 dark:bg-dark-surface/10 border-t border-zinc-100 dark:border-dark-border">
         <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">
            {appointments?.length || 0} confirmed session{appointments?.length === 1 ? '' : 's'} today
         </p>
      </div>
    </div>
  );
}

export default AppointmentsScheduleCard;
