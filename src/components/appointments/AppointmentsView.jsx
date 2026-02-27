import { useState, useEffect } from "react";
import clsx from "clsx";
import {
  FiBell,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiPlusCircle,
} from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { format, addMonths, subMonths } from "date-fns";
import { generateCalendarGrid } from "../../utils/calendarUtils";

const viewModes = ["Month", "Week", "Day"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const eventToneStyles = {
  green: "border-green-500 bg-green-100/70 text-green-800 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600",
  amber: "border-amber-500 bg-amber-100/70 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600",
  indigo: "border-indigo-500 bg-indigo-100/70 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-600",
  rose: "border-rose-500 bg-rose-100/70 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-600",
  slate: "border-slate-400 bg-slate-200/80 text-slate-700 dark:bg-zinc-700/60 dark:text-zinc-300 dark:border-zinc-500",
};

const webRequests = [
  {
    id: "wr-1",
    petName: "Bella",
    breed: "Golden Retriever",
    request: "Vaccination Follow-up",
    time: "Today @ 2:15 PM",
    ago: "18m ago",
    avatar: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=120&q=80",
  },
  {
    id: "wr-2",
    petName: "Whiskers",
    breed: "Siamese Cat",
    request: "Eye Infection Review",
    time: "Tomorrow @ 9:30 AM",
    ago: "1h ago",
    avatar: "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=120&q=80",
  },
];

function AppointmentsView() {
  const [activeViewMode, setActiveViewMode] = useState("Month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);

  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newTone, setNewTone] = useState("green");

  const fetchAppointments = () => {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => setAppointments(data))
      .catch((err) => console.error("Error fetching appointments:", err));
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleQuickAdd = () => {
    if (!newTitle || !newDate || !newTime) {
      return alert("Title, Date, and Time are required!");
    }
    fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, date: newDate, time: newTime, tone: newTone }),
    })
      .then((res) => res.json())
      .then(() => {
        alert("Appointment Scheduled!");
        setNewTitle(""); setNewDate(""); setNewTime("");
        fetchAppointments();
      })
      .catch((err) => alert("Error scheduling: " + err.message));
  };

  const calendarDays = generateCalendarGrid(currentDate, appointments);

  // shared input class for Quick Add form
  const qInput = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500";

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[2.35fr_1fr]">
      {/* ── Calendar panel ── */}
      <section className="card-shell overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-dark-border">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-dark-surface">
            {viewModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveViewMode(mode)}
                className={clsx(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  activeViewMode === mode
                    ? "bg-white text-blue-600 shadow-sm dark:bg-dark-card dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <p className="min-w-[160px] text-center text-lg font-semibold text-slate-800 dark:text-zinc-100">
              {format(currentDate, "MMMM yyyy")}
            </p>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Week-day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-dark-surface">
          {weekDays.map((day) => (
            <div
              key={day}
              className="border-r border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-500 last:border-r-0 dark:border-dark-border dark:text-zinc-400"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((entry, index) => (
            <div
              key={`${entry.day}-${index}`}
              className="min-h-[136px] border-b border-r border-slate-200 p-2 last:border-r-0 dark:border-dark-border"
            >
              <p className={clsx("text-sm font-medium", entry.inMonth ? "text-slate-700 dark:text-zinc-300" : "text-slate-400 dark:text-zinc-600")}>
                {entry.day}
              </p>
              <div className="mt-2 space-y-2">
                {entry.events.map((event) => (
                  <article
                    key={event.id}
                    className={clsx(
                      "rounded-lg border-l-2 px-2 py-1.5 text-xs font-medium",
                      eventToneStyles[event.tone] || eventToneStyles.slate
                    )}
                  >
                    <p className="font-semibold">{event.time}</p>
                    <p className="truncate">{event.title}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sidebar panels ── */}
      <aside className="space-y-5">
        {/* Quick Add */}
        <section className="card-shell p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">QUICK ADD</h3>
            <button onClick={() => alert("Form cleared.")} className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              Clear
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Event Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Bella - Vaccination"
                className={qInput}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Date</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={qInput} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Time</label>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className={qInput} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Event Color Tag</label>
              <div className="relative">
                <select
                  value={newTone}
                  onChange={(e) => setNewTone(e.target.value)}
                  className={clsx(qInput, "appearance-none pr-9")}
                >
                  <option value="green">Green (General)</option>
                  <option value="blue">Blue (Wellness)</option>
                  <option value="indigo">Indigo (Checkup)</option>
                  <option value="amber">Amber (Warning)</option>
                  <option value="rose">Rose (Emergency)</option>
                  <option value="slate">Slate (Admin)</option>
                </select>
                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-400" />
              </div>
            </div>

            <button
              onClick={handleQuickAdd}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <FiPlusCircle className="h-4 w-4" />
              Schedule
            </button>
          </div>
        </section>

        {/* Web Requests */}
        <section className="card-shell p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">WEB REQUESTS</h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              2 New
            </span>
          </div>

          <div className="space-y-3">
            {webRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-dark-border dark:bg-dark-surface">
                <div className="flex items-start gap-3">
                  <img src={request.avatar} alt={request.petName} className="h-10 w-10 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-slate-900 dark:text-zinc-50">{request.petName}</p>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">{request.breed}</p>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">{request.ago}</p>
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-dark-border dark:bg-dark-card">
                  <p className="text-sm text-slate-600 dark:text-zinc-300">Request: {request.request}</p>
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{request.time}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => alert("Reschedule requested sent to user.")}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 dark:hover:bg-dark-surface"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => alert("Request approved and booked.")}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Approve
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* AI Forecast Alert */}
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-600/30 dark:bg-blue-600/10">
          <div className="mb-2 inline-flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <LuSparkles className="h-4 w-4" />
            <p className="text-sm font-bold uppercase tracking-wide">AI Forecast Alert</p>
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-300">
            Increased flea and dermatology visits are expected next week due to humidity trends. Review inventory and block triage slots in advance.
          </p>
          <button
            onClick={() => alert("Opened AI scheduling hints.")}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <FiBell className="h-4 w-4" />
            Review planning hints
          </button>
        </section>
      </aside>
    </div>
  );
}

export default AppointmentsView;
