import { useState, useEffect } from "react";
import { FiPlus, FiTrash2, FiClock } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function VetScheduleTab() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedVetId, setSelectedVetId] = useState("");
  
  const [dayOfWeek, setDayOfWeek] = useState("Monday");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  const fetchData = async () => {
    try {
      const [usersRes, schedulesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/vet-schedules")
      ]);
      if (usersRes.ok && schedulesRes.ok) {
        const usersData = await usersRes.json();
        const schedulesData = await schedulesRes.json();
        
        // Filter out non-vet users
        const vetsOnly = usersData.filter(u => {
          if (!u.role) return false;
          const r = u.role.toLowerCase();
          return r.includes("vet") || r.includes("doctor");
        });
        
        setUsers(vetsOnly);
        setSchedules(schedulesData);
        if (vetsOnly.length > 0 && !selectedVetId) {
          setSelectedVetId(vetsOnly[0].id.toString());
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load schedule data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!selectedVetId) return toast.error("Select a vet first.");
    
    const payload = {
      user_id: selectedVetId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      break_start: breakStart || null,
      break_end: breakEnd || null,
      is_available: isAvailable,
      max_appointments: null
    };

    try {
      const res = await fetch("/api/vet-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success("Schedule added.");
        setBreakStart("");
        setBreakEnd("");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to save schedule.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm("Remove this schedule?")) return;
    try {
      const res = await fetch(`/api/vet-schedules/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Schedule removed.");
        fetchData();
      }
    } catch {
      toast.error("Failed to delete schedule.");
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading schedules...</div>;

  const currentVetSchedules = schedules.filter(s => s.user_id.toString() === selectedVetId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <section className="card-shell p-6 h-fit">
        <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Veterinarians</h3>
        <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-zinc-400">Select a vet to manage.</p>
        
        <div className="space-y-2">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedVetId(u.id.toString())}
              className={`w-full text-left rounded-lg p-3 transition-colors ${selectedVetId === u.id.toString() ? 'bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 dark:bg-dark-card dark:border-dark-border dark:text-zinc-300'}`}
            >
              <div className="font-semibold">{u.name}</div>
              <div className="text-xs opacity-80">{u.role}</div>
            </button>
          ))}
          {users.length === 0 && <p className="text-sm text-slate-500">No vets found.</p>}
        </div>
      </section>

      <section className="card-shell p-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Schedule Configuration</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage daily availability and business hours.</p>

        {selectedVetId ? (
          <>
            <form onSubmit={handleAddSchedule} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200 dark:bg-dark-surface dark:border-dark-border">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">Day of Week</label>
                <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200">
                  {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">Start Time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">End Time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">Break Start (Opt)</label>
                <input type="time" value={breakStart} onChange={e => setBreakStart(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">Break End (Opt)</label>
                <input type="time" value={breakEnd} onChange={e => setBreakEnd(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
              </div>

              <div className="flex items-center h-10 gap-2 px-2">
                <input type="checkbox" id="isAvail" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="isAvail" className="text-sm font-medium text-slate-700 dark:text-zinc-300">Available</label>
              </div>

              <div className="col-span-1 md:col-span-2 flex justify-end">
                <button type="submit" className="h-10 w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 transition">
                  <FiPlus /> Save Schedule
                </button>
              </div>
            </form>

            <div className="mt-8">
              <h4 className="font-semibold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2"><FiClock /> Current Weekly Schedule</h4>
              <div className="space-y-3">
                {DAYS_OF_WEEK.map(day => {
                  const daySchedules = currentVetSchedules.filter(s => s.day_of_week === day);
                  return (
                    <div key={day} className="flex flex-col md:flex-row md:items-start justify-between py-3 border-b border-slate-100 dark:border-dark-border last:border-0">
                      <div className="w-32 font-medium text-slate-800 dark:text-zinc-200">{day}</div>
                      <div className="flex-1 flex flex-col gap-2 mt-2 md:mt-0">
                        {daySchedules.length > 0 ? daySchedules.map(schedule => (
                          <div key={schedule.id} className="flex items-center gap-4 text-sm bg-slate-50 dark:bg-dark-surface p-2 rounded-lg border border-slate-200 dark:border-dark-border">
                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${schedule.is_available ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                              {schedule.is_available ? 'Working' : 'Off'}
                            </span>
                            <span className="text-slate-700 font-medium dark:text-zinc-300">
                              {schedule.start_time.substring(0,5)} - {schedule.end_time.substring(0,5)}
                            </span>
                            {schedule.break_start && (
                              <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-1 rounded dark:bg-amber-900/30 dark:text-amber-400">
                                Break: {schedule.break_start.substring(0,5)} - {schedule.break_end.substring(0,5)}
                              </span>
                            )}
                            <button onClick={() => handleDeleteSchedule(schedule.id)} className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <FiTrash2 className="h-4 w-4"/>
                            </button>
                          </div>
                        )) : (
                          <div className="text-sm text-slate-400 italic py-2">No schedule defined</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-dark-border dark:bg-dark-surface">
            Please select a veterinarian from the left menu.
          </div>
        )}
      </section>
    </div>
  );
}
