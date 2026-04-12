import { useState, useEffect } from 'react';
import { getPets, getAppointments } from '../api';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiCalendar, FiHeart, FiClock, FiEdit2 } from 'react-icons/fi';
import clsx from 'clsx';

export default function Dashboard() {
  const navigate = useNavigate();
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

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading your dashboard...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 font-sans">Welcome back!</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Here is what's happening with your pets.</p>
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
            <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
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
                <Link key={pet.id} to={`/pets/${pet.id}`}>
                  <div className="card-shell p-5 flex items-center gap-4 hover:border-brand-500/50 transition-all cursor-pointer group">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-dark-border">
                      {pet.photo ? (
                        <img src={`http://localhost:8000/storage/${pet.photo}`} alt={pet.name} className="w-full h-full object-cover" />
                      ) : (
                        <FiHeart className="w-8 h-8 text-zinc-300 dark:text-zinc-600 group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg truncate">{pet.name}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 capitalize truncate">
                        {pet.breed?.name || pet.species?.name || 'Unknown Breed'}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/pets/${pet.id}/edit`);
                      }}
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface text-zinc-400 hover:text-brand-500 transition-colors"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full card-shell p-12 text-center space-y-3 bg-zinc-50/50 border-dashed">
                <p className="text-zinc-400">You haven't added any pets yet.</p>
                <Link to="/add-pet">
                  <button className="text-brand-600 font-semibold hover:underline">Register your first pet</button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Appointments Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
              <FiClock className="text-brand-500" />
              Upcoming
            </h2>
            <Link to="/appointments" className="text-xs font-bold text-brand-600 hover:underline">
              View All
            </Link>
          </div>
          
          <div className="card-shell bg-white dark:bg-dark-card overflow-hidden">
            {appointments.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-dark-border">
                {appointments.filter(a => a.status !== 'cancelled').slice(0, 5).map(appt => (
                  <div key={appt.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-dark-surface/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest truncate">{appt.service?.name}</span>
                           <span className={clsx(
                             "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md",
                             appt.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                           )}>
                             {appt.status}
                           </span>
                        </div>
                        <h4 className="font-bold text-zinc-800 dark:text-zinc-100 truncate mt-0.5">{appt.pet?.name}</h4>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-black text-zinc-900 dark:text-zinc-50 flex items-center justify-end gap-1">
                          <FiCalendar className="w-3 h-3 text-zinc-400" />
                          {new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-400 mt-0.5 flex items-center justify-end gap-1 uppercase tracking-tighter">
                          <FiClock className="w-3 h-3" />
                          {appt.time.substring(0, 5)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-400 text-sm">
                No upcoming appointments.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
