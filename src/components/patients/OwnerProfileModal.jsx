import { useState, useEffect } from "react";
import { FiX, FiUser, FiPhone, FiMail, FiMapPin } from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function OwnerProfileModal({ ownerId, onClose, isOpen }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && ownerId && user?.token) {
      setLoading(true);
      fetch(`/api/owners/${ownerId}`, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load owner");
          return res.json();
        })
        .then((data) => {
          setOwner(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load owner profile:", err);
          setLoading(false);
        });
    }
  }, [isOpen, ownerId, user?.token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark-card dark:shadow-dark-soft">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-dark-border">
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-zinc-50">
            <FiUser className="h-5 w-5 text-blue-500" />
            Client Profile
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:text-zinc-500 dark:hover:bg-dark-surface dark:hover:text-zinc-300"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading profile data...</div>
          ) : owner ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-dark-border dark:bg-dark-surface">
                <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">{owner.name}</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 dark:text-zinc-300">
                  {owner.phone && <p className="flex items-center gap-2"><FiPhone className="h-4 w-4 text-slate-400" />{owner.phone}</p>}
                  {owner.email && <p className="flex items-center gap-2"><FiMail className="h-4 w-4 text-slate-400" />{owner.email}</p>}
                  {owner.address && <p className="flex items-start gap-2 sm:col-span-2"><FiMapPin className="h-4 w-4 mt-0.5 text-slate-400" />{`${owner.address}, ${owner.city} ${owner.zip || ''}`}</p>}
                </div>
              </div>

              <div>
                <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-zinc-50">
                  <LuPawPrint className="h-5 w-5 text-blue-500" />
                  Associated Pets ({owner.pets?.length || 0})
                </h4>
                
                {owner.pets?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {owner.pets.map((pet) => (
                      <Link 
                        key={pet.id}
                        to={`/patients/${pet.id}`}
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-300 hover:shadow-sm transition dark:border-dark-border dark:bg-dark-card dark:hover:border-blue-500/50"
                      >
                        <img 
                          src={pet.photo ? getActualPetImageUrl(pet.photo) : getPetImageUrl(pet.species?.name, pet.breed?.name)} 
                          alt={pet.name} 
                          className="h-12 w-12 rounded-full object-cover bg-slate-100 dark:bg-zinc-800" 
                        />
                        <div>
                          <p className="font-bold text-slate-900 dark:text-zinc-50">{pet.name}</p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">{pet.species?.name} • {pet.breed?.name}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 text-center dark:bg-dark-surface dark:border-dark-border dark:text-zinc-400">
                    No active pets recorded for this client.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-rose-500">Failed to load owner information.</div>
          )}
        </div>
      </div>
    </div>
  );
}
