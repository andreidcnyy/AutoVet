import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getPet } from '../api';
import { FiX, FiCalendar, FiEdit2 } from 'react-icons/fi';
import { LuPawPrint } from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { getActualPetImageUrl } from '../utils/petImages';
import { calculateAgeDisplay } from '../utils/petAgeGroups';
import { readCache, writeCache } from '../utils/swrCache';

function formatPortalDate(dateStr: string) {
  if (!dateStr) return 'N/A';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const normalized = clean.includes('-') ? clean.replace(/-/g, '/') : clean;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface PetProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  petId: number | null;
}

export default function PetProfileModal({ isOpen, onClose, petId }: PetProfileModalProps) {
  const navigate = useNavigate();
  const [pet, setPet] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && petId) {
      const CACHE_KEY = `portal_pet_modal_${petId}_cache`;
      const cached = readCache<any>(CACHE_KEY);
      if (cached?.pet) {
        setPet(cached.pet);
        setLoading(false);
      } else {
        setLoading(true);
      }
      getPet(petId)
        .then(res => {
          const petData = res.data.data || res.data;
          setPet(petData);
          writeCache(CACHE_KEY, { pet: petData });
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setPet(null);
    }
  }, [isOpen, petId]);

  if (!isOpen) return null;

  const rows = pet ? [
    { label: 'Breed / Species', value: pet.breed?.name || pet.species?.name || 'N/A' },
    { label: 'Sex', value: pet.sex || 'N/A' },
    { label: 'Age', value: calculateAgeDisplay(pet.date_of_birth) || pet.age_group || 'N/A' },
    { label: 'Weight', value: pet.weight ? `${Math.round(pet.weight)} ${pet.weight_unit || 'kg'}` : 'N/A' },
    { label: 'Color', value: pet.color || 'N/A' },
    { label: 'Size', value: pet.size_category?.name || 'N/A' },
    { label: 'Allergies', value: pet.allergies || 'None recorded' },
    { label: 'Last Visit', value: pet.last_visit && pet.last_visit !== 'No past visits' ? formatPortalDate(pet.last_visit) : 'No past visits' },
    { label: 'Next Due', value: pet.next_due && pet.next_due !== 'None scheduled' ? formatPortalDate(pet.next_due) : 'None scheduled' },
    ...(pet.notes ? [{ label: 'Notes', value: pet.notes }] : []),
  ] : [];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />

      {/* Modal card — stops click propagation so backdrop click closes, inner click doesn't */}
      <div
        className="relative w-full max-w-sm bg-white dark:bg-dark-card rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'min(88vh, 640px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-brand-600 dark:bg-brand-900/60 p-4 text-white shrink-0">
          <div className="flex items-center gap-3 pr-8">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center overflow-hidden shrink-0">
              {pet?.photo
                ? <img src={getActualPetImageUrl(pet.photo)} alt={pet.name} className="w-full h-full object-cover" />
                : <LuPawPrint className="w-7 h-7 text-white/60" />
              }
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black italic uppercase tracking-tight truncate">
                {loading ? 'Loading…' : (pet?.name || 'Pet Profile')}
              </h2>
              {pet && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[pet.breed?.name || pet.species?.name, pet.sex, pet.age_group].filter(Boolean).map(tag => (
                    <span key={tag} className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/15 border border-white/20">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <FiX className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Info table */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-brand-500" />
            </div>
          ) : pet ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap pt-0.5 shrink-0">
                    {label}
                  </span>
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 text-right">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm font-bold text-rose-500">Pet not found.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {pet && (
          <div className="shrink-0 p-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
            <Link to={`/pets/${pet.id}/edit`} className="flex-1" onClick={onClose}>
              <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                <FiEdit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </Link>
            <button
              onClick={() => { onClose(); navigate('/book'); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-all"
            >
              <FiCalendar className="w-3.5 h-3.5" /> Book Visit
            </button>
            <Link to={`/pets/${pet.id}`} className="flex-1" onClick={onClose}>
              <button className="w-full py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition-all">
                Full Profile
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
