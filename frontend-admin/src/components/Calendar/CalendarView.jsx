import { FiChevronLeft, FiChevronRight, FiX, FiCalendar, FiClock } from "react-icons/fi";
import { format, addMonths, subMonths, isToday } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import { generateCalendarGrid } from "../../utils/calendarUtils";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const eventStyles = {
  blue: "border-blue-200 bg-blue-100/70 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  purple: "border-violet-200 bg-violet-100/70 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  green: "border-emerald-200 bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rose: "border-rose-200 bg-rose-100/70 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  amber: "border-amber-200 bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  indigo: "border-indigo-200 bg-indigo-100/70 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  slate: "border-slate-200 dark:border-dark-border bg-slate-200/80 text-slate-700 dark:bg-zinc-700/60 dark:text-zinc-300 dark:text-zinc-300",
};

const panelAccentStyles = {
  blue: "border-l-blue-500",
  purple: "border-l-violet-500",
  green: "border-l-emerald-500",
  rose: "border-l-rose-500",
  amber: "border-l-amber-500",
  indigo: "border-l-indigo-500",
  slate: "border-l-slate-400",
};

function CalendarView() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (!user?.token) return;
    
    fetch("/api/appointments", {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then((res) => res.json())
      .then((data) => setAppointments(data))
      .catch((err) => console.error("Error fetching calendar appointments:", err));
  }, [user?.token]);

  const calendarDays = generateCalendarGrid(currentDate, appointments);

  const handleDayClick = (entry) => {
    // Toggle: clicking the same day again closes the panel
    if (selectedDay && selectedDay.dateString === entry.dateString) {
      setSelectedDay(null);
    } else {
      setSelectedDay(entry);
    }
  };

  return (
    <section className="card-shell h-[calc(100vh-11rem)] overflow-hidden p-0">
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-dark-border px-5 py-4">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Clinic Calendar</h2>
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface"
              aria-label="Previous month"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <p className="min-w-[160px] text-center text-lg font-semibold text-slate-800 dark:text-zinc-200">
              {format(currentDate, "MMMM yyyy")}
            </p>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface"
              aria-label="Next month"
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Body: side-by-side calendar + panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Calendar grid */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface">
              {weekDays.map((day) => (
                <div key={day} className="border-r border-slate-200 dark:border-dark-border px-2 py-3 text-center text-sm font-semibold text-slate-500 dark:text-zinc-400 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid flex-1 grid-cols-7 overflow-y-auto slim-scroll" style={{ gridAutoRows: "minmax(140px, max-content)" }}>
              {calendarDays.map((entry, index) => {
                const isSelected = selectedDay?.dateString === entry.dateString;
                const isTodayDate = isToday(entry.date);

                return (
                  <div
                    key={`${entry.day}-${index}`}
                    onClick={() => handleDayClick(entry)}
                    className={clsx(
                      "cursor-pointer flex flex-col border-b border-r border-slate-200 dark:border-dark-border p-2 last:border-r-0 transition-colors",
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400"
                        : "hover:bg-slate-50 dark:hover:bg-dark-surface/50 dark:bg-dark-surface"
                    )}
                  >
                    <p
                      className={clsx(
                        "inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium",
                        isTodayDate && "bg-blue-600 font-bold text-white",
                        !isTodayDate && entry.inMonth && "text-slate-700 dark:text-zinc-300",
                        !isTodayDate && !entry.inMonth && "text-slate-400 dark:text-zinc-500"
                      )}
                    >
                      {entry.day}
                    </p>
                    <div className="mt-1.5 flex-1 space-y-1.5 pb-2 pr-1">
                      {entry.events.map((event) => (
                        <article
                          key={event.id}
                          className={clsx(
                            "rounded-lg border px-2 py-1 text-xs font-medium",
                            eventStyles[event.tone] || eventStyles.slate
                          )}
                        >
                          <p className="font-semibold">{event.time}</p>
                          <p className="truncate">{event.title}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day Detail Panel */}
          {selectedDay && (
            <aside className="flex w-72 flex-col border-l border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-lg xl:w-80">
              {/* Panel header */}
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-dark-border px-4 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    {format(selectedDay.date, "EEEE")}
                  </p>
                  <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-zinc-50">
                    {format(selectedDay.date, "MMMM d, yyyy")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    {selectedDay.events.length === 0
                      ? "No appointments"
                      : `${selectedDay.events.length} appointment${selectedDay.events.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="mt-1 rounded-lg p-1.5 text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-dark-surface hover:text-slate-600 dark:hover:text-zinc-300"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>

              {/* Appointment list */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedDay.events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FiCalendar className="mb-3 h-10 w-10 text-slate-300 dark:text-zinc-600" />
                    <p className="font-semibold text-slate-500 dark:text-zinc-400">No appointments</p>
                    <p className="mt-1 text-sm text-slate-400 dark:text-zinc-500">Nothing is booked for this day yet.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {selectedDay.events.map((event) => (
                      <li
                        key={event.id}
                        className={clsx(
                          "rounded-xl border border-l-4 bg-white dark:bg-dark-card p-4 shadow-sm",
                          panelAccentStyles[event.tone] || panelAccentStyles.slate
                        )}
                      >
                        <p className="text-base font-bold text-slate-800 dark:text-zinc-200">{event.title}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400">
                          <FiClock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{event.time}</span>
                        </div>
                        {event.pet_owner && (
                          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                            <span className="font-medium">Owner:</span> {event.pet_owner}
                          </p>
                        )}
                        {event.pet_name && (
                          <p className="text-sm text-slate-500 dark:text-zinc-400">
                            <span className="font-medium">Patient:</span> {event.pet_name}
                          </p>
                        )}
                        {event.notes && (
                          <p className="mt-2 text-sm italic text-slate-400 dark:text-zinc-500">{event.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

export default CalendarView;
