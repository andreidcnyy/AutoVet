import { useState, useEffect } from 'react';
import { getPets, getAppointments } from '../api';
import { Link } from 'react-router-dom';
import { FiPlus, FiCalendar, FiHeart, FiClock } from 'react-icons/fi';

export default function Dashboard() {
  const [pets, setPets] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPets(), getAppointments()])
      .then(([petsRes, apptsRes]) => {
        setPets(petsRes.data);
        setAppointments(apptsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading your dashboard...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 font-sans">Welcome back!</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">Here is what's happening with your pets.</p>
        </div>
        <Link to="/book">
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white font-semibold shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all hover:-translate-y-0.5 active:translate-y-0">
            <FiCalendar className="w-5 h-5" />
            <span>Book Appointment</span>
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pets Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-2">
              <FiHeart className="text-rose-500" />
              My Pets
            </h2>
            <Link to="/add-pet" className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              <FiPlus /> Add Pet
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pets.length > 0 ? (
              pets.map(pet => (
                <div key={pet.id} className="card-shell p-5 flex items-center gap-4 hover:border-brand-500/50 transition-all cursor-pointer group">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-dark-border">
                    {pet.photo ? (
                      <img src={`http://localhost:8000/storage/${pet.photo}`} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <FiHeart className="w-8 h-8 text-slate-300 dark:text-zinc-600 group-hover:scale-110 transition-transform" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-lg">{pet.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 capitalize">
                      {pet.breed?.name || pet.species?.name || 'Unknown Breed'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full card-shell p-12 text-center space-y-3 bg-slate-50/50 border-dashed">
                <p className="text-slate-400">You haven't added any pets yet.</p>
                <Link to="/add-pet">
                  <button className="text-brand-600 font-semibold hover:underline">Register your first pet</button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Appointments Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-2">
            <FiClock className="text-brand-500" />
            Upcoming
          </h2>
          
          <div className="space-y-3">
            {appointments.length > 0 ? (
              appointments.filter(a => a.status !== 'cancelled').slice(0, 5).map(appt => (
                <div key={appt.id} className="card-shell p-4 border-l-4 border-l-brand-500 bg-white dark:bg-dark-card shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-brand-600 uppercase tracking-wider">{appt.service?.name}</div>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-100 mt-1">{appt.pet?.name}</h4>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      appt.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {appt.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-sm text-slate-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <FiCalendar className="w-3.5 h-3.5" />
                      {new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1">
                      <FiClock className="w-3.5 h-3.5" />
                      {appt.time.substring(0, 5)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="card-shell p-8 text-center text-slate-400 text-sm">
                No upcoming appointments.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
