import clsx from "clsx";
import { useState, useEffect } from "react";
import { FiPlus, FiTrash2, FiClock } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function VetScheduleTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedVetId, setSelectedVetId] = useState("");
  const [selectedDays, setSelectedDays] = useState(["Monday"]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [maxAppointments, setMaxAppointments] = useState(10);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isOverwriting, setIsOverwriting] = useState(false);

  const fetchData = async () => {
    if (!user?.token) return;
    try {
      const headers = { 
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      };
      const [usersRes, schedulesRes] = await Promise.all([
        fetch("/api/users", { headers }),
        fetch("/api/vet-schedules", { headers })
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
  }, [user?.token]);

  const toggleDay = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const selectWeekdays = () => setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const selectAll = () => setSelectedDays([...DAYS_OF_WEEK]);
  const clearSelection = () => setSelectedDays([]);

  const handleSaveSchedule = async (e, forceOverwrite = false) => {
    if (e) e.preventDefault();
    if (!selectedVetId) return toast.error("Select a vet first.");
    if (selectedDays.length === 0) return toast.error("Select at least one day.");
    
    const payload = {
      user_id: selectedVetId,
      days: selectedDays,
      start_time: startTime,
      end_time: endTime,
      break_start: breakStart || null,
      break_end: breakEnd || null,
      max_appointments: maxAppointments,
      is_available: isAvailable,
      overwrite_existing: forceOverwrite
    };

    try {
      const res = await fetch("/api/vet-schedules/bulk", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Schedules saved.");
        setBreakStart("");
        setBreakEnd("");
        fetchData();
        setIsOverwriting(false);
      } else if (res.status === 409) {
        const confirmOverwrite = window.confirm(
          `Schedule conflict detected for: ${data.conflicting_days.join(", ")}. \n\nDo you want to overwrite existing schedules for these days?`
        );
        if (confirmOverwrite) {
          handleSaveSchedule(null, true);
        }
      } else {
        toast.error(data.message || "Failed to save schedule.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error.");
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm("Remove this schedule?")) return;
    try {
      const res = await fetch(`/api/vet-schedules/${id}`, { 
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      if (res.ok) {
        toast.success("Schedule removed.");
        fetchData();
      }
    } catch {
      toast.error("Failed to delete schedule.");
    }
  };

  if (loading) return <div className="p-6 text-zinc-500">Loading schedules...</div>;

  const currentVetSchedules = schedules.filter(s => s.user_id.toString() === selectedVetId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <section className="card-shell p-6 h-fit">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Veterinarians</h3>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">Select a vet to manage.</p>
        
        <div className="space-y-2">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedVetId(u.id.toString())}
              className={`w-full text-left rounded-lg p-3 transition-colors ${selectedVetId === u.id.toString() ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-white border border-zinc-200 text-zinc-700 hover:border-emerald-300 dark:bg-dark-card dark:border-dark-border dark:text-zinc-300'}`}
            >
              <div className="font-semibold">{u.name}</div>
              <div className="text-xs opacity-80">{u.role}</div>
            </button>
          ))}
          {users.length === 0 && <p className="text-sm text-zinc-500">No vets found.</p>}
        </div>
      </section>

      <section className="card-shell p-6">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Schedule Configuration</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage daily availability and business hours.</p>

        {selectedVetId ? (
          <>
            <form onSubmit={handleSaveSchedule} className="mt-6 space-y-6 bg-zinc-50 p-6 rounded-xl border border-zinc-200 dark:bg-dark-surface dark:border-dark-border">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Select Days</label>
                    <div className="flex gap-3">
                      <button type="button" onClick={selectWeekdays} className="text-[10px] font-bold text-emerald-600 hover:underline dark:text-emerald-400">Weekdays</button>
                      <button type="button" onClick={selectAll} className="text-[10px] font-bold text-emerald-600 hover:underline dark:text-emerald-400">All</button>
                      <button type="button" onClick={clearSelection} className="text-[10px] font-bold text-rose-600 hover:underline">Clear</button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={clsx(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            isSelected 
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20" 
                              : "bg-white border-zinc-200 text-zinc-500 hover:border-emerald-300 dark:bg-dark-card dark:border-dark-border dark:text-zinc-400"
                          )}
                        >
                          {day.substring(0,3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Start Time</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">End Time</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div className="grid grid-cols-2 gap-4 md:col-span-1">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Break Start (Opt)</label>
                    <input type="time" value={breakStart} onChange={e => setBreakStart(e.target.value)} className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Break End (Opt)</label>
                    <input type="time" value={breakEnd} onChange={e => setBreakEnd(e.target.value)} className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Max Appointments (per shift)</label>
                  <input type="number" min="1" max="100" value={maxAppointments} onChange={e => setMaxAppointments(parseInt(e.target.value))} className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200" />
                </div>

                <div className="flex items-center h-10 gap-2 mb-0.5">
                  <input type="checkbox" id="isAvail" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                  <label htmlFor="isAvail" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Available</label>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-dark-border">
                <div className="mb-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Schedule Preview</p>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {selectedDays.length > 0 ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {selectedDays.map(d => (
                          <span key={d} className="inline-flex items-center gap-1">
                            <span className="font-bold text-zinc-700 dark:text-zinc-300">{d}:</span> {startTime} - {endTime}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="italic text-zinc-400">No days selected. Choose days above to generate schedules.</span>
                    )}
                  </div>
                </div>
                
                <button type="submit" className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20 active:scale-95">
                  Apply to Selected Days ({selectedDays.length})
                </button>
              </div>
            </form>

            <div className="mt-8">
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2"><FiClock /> Current Weekly Schedule</h4>
              <div className="space-y-3">
                {DAYS_OF_WEEK.map(day => {
                  const daySchedules = currentVetSchedules.filter(s => s.day_of_week === day);
                  return (
                    <div key={day} className="flex flex-col md:flex-row md:items-start justify-between py-3 border-b border-zinc-100 dark:border-dark-border last:border-0">
                      <div className="w-32 font-medium text-zinc-800 dark:text-zinc-200">{day}</div>
                      <div className="flex-1 flex flex-col gap-2 mt-2 md:mt-0">
                        {daySchedules.length > 0 ? daySchedules.map(schedule => (
                          <div key={schedule.id} className="flex items-center gap-4 text-sm bg-zinc-50 dark:bg-dark-surface p-2 rounded-lg border border-zinc-200 dark:border-dark-border">
                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${schedule.is_available ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                              {schedule.is_available ? 'Working' : 'Off'}
                            </span>
                            <span className="text-zinc-700 font-medium dark:text-zinc-300">
                              {schedule.start_time.substring(0,5)} - {schedule.end_time.substring(0,5)}
                            </span>
                            {schedule.break_start && (
                              <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-1 rounded dark:bg-amber-900/30 dark:text-amber-400">
                                Break: {schedule.break_start.substring(0,5)} - {schedule.break_end.substring(0,5)}
                              </span>
                            )}
                            <button onClick={() => handleDeleteSchedule(schedule.id)} className="ml-auto p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <FiTrash2 className="h-4 w-4"/>
                            </button>
                          </div>
                        )) : (
                          <div className="text-sm text-zinc-400 italic py-2">No schedule defined</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 dark:border-dark-border dark:bg-dark-surface">
            Please select a veterinarian from the left menu.
          </div>
        )}
      </section>
    </div>
  );
}
