import { useState, useEffect, useRef } from 'react';
import { 
  FiX, 
  FiCamera, 
  FiChevronDown, 
  FiCheckCircle, 
  FiAlertCircle 
} from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSpecies, getWeightRanges, updatePet, getBreeds, getPet } from '../api';
import { getAgeGroup } from '../utils/petAgeGroups';
import { getActualPetImageUrl } from '../utils/petImages';
import clsx from 'clsx';

const petSchema = z.object({
  name: z.string().min(1, "Pet name is required").max(255),
  species_id: z.coerce.string().min(1, "Species is required"),
  breed_id: z.coerce.string().optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  sex: z.string().max(50).optional(),
  age_group: z.string().optional().or(z.literal("")),
  color: z.string().max(255).optional(),
  weight: z.coerce.number().min(0.01, "Weight is required").max(500, "Invalid weight"),
  weight_unit: z.enum(["kg", "lbs"]).default("kg"),
  size_category_id: z.coerce.string().optional().or(z.literal("")),
  allergies: z.string().max(255).optional(),
  medication: z.string().max(255).optional(),
  notes: z.string().optional(),
  photo: z.string().optional()
});

interface EditPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  petId: number | null;
  onSuccess: () => void;
}

export default function EditPetModal({ isOpen, onClose, petId, onSuccess }: EditPetModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [speciesList, setSpeciesList] = useState<any[]>([]);
  const [availableBreeds, setAvailableBreeds] = useState<any[]>([]);
  const [weightRanges, setWeightRanges] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(petSchema),
  });

  const photoValue = watch("photo");
  const speciesIdValue = watch("species_id");
  const dobValue = watch("date_of_birth");
  const weightValue = watch("weight");

  useEffect(() => {
    if (isOpen && petId) {
      setLoading(true);
      setError(null);
      Promise.all([
        getSpecies(),
        getWeightRanges(),
        getPet(petId)
      ])
      .then(([speciesRes, weightRes, petRes]) => {
        const sData = speciesRes.data.data || speciesRes.data;
        setSpeciesList(Array.isArray(sData) ? sData : []);
        
        const wData = weightRes.data.data || weightRes.data;
        setWeightRanges(Array.isArray(wData) ? wData : []);

        const pet = petRes.data;
        reset({
          name: pet.name,
          species_id: String(pet.species_id),
          breed_id: pet.breed_id ? String(pet.breed_id) : "",
          date_of_birth: pet.date_of_birth || "",
          sex: pet.sex || "Male",
          age_group: pet.age_group || "Adult",
          color: pet.color || "",
          weight: pet.weight || 0,
          weight_unit: pet.weight_unit || "kg",
          size_category_id: pet.size_category_id ? String(pet.size_category_id) : "",
          allergies: pet.allergies || "",
          medication: pet.medication || "",
          notes: pet.notes || "",
          photo: pet.photo || ""
        });
      })
      .catch(err => {
        console.error("LOAD ERROR:", err);
        setError("Failed to load pet data.");
      })
      .finally(() => setLoading(false));
    }
  }, [isOpen, petId, reset]);

  // Sync Breeds when Species changes
  useEffect(() => {
    if (speciesIdValue) {
      const selected = speciesList.find(s => String(s.id) === String(speciesIdValue));
      if (selected && selected.breeds && selected.breeds.length > 0) {
        setAvailableBreeds(selected.breeds);
      } else {
        getBreeds(Number(speciesIdValue)).then(res => {
          const data = res.data.data || res.data;
          setAvailableBreeds(Array.isArray(data) ? data : []);
        }).catch(err => console.error("SYNC ERROR:", err));
      }
    } else {
      setAvailableBreeds([]);
    }
  }, [speciesIdValue, speciesList]);

  // Auto-calculate Age Group and Size Category
  useEffect(() => {
    if (speciesIdValue && dobValue) {
      const speciesName = speciesList.find(s => String(s.id) === String(speciesIdValue))?.name;
      const computedAgeGroup = getAgeGroup(speciesName, dobValue);
      setValue("age_group", computedAgeGroup);
    }
  }, [speciesIdValue, dobValue, speciesList, setValue]);

  useEffect(() => {
    if (weightValue && speciesIdValue) {
      const w = parseFloat(weightValue.toString());
      const match = weightRanges.find(r => {
        const isSameSpecies = String(r.species_id) === String(speciesIdValue);
        const min = r.min_weight || 0;
        const max = r.max_weight || Infinity;
        return isSameSpecies && w >= min && w <= max;
      });
      if (match) {
        setValue("size_category_id", String(match.size_category_id));
      }
    }
  }, [weightValue, speciesIdValue, weightRanges, setValue]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setValue("photo", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: any) => {
    if (!petId) return;
    setError(null);
    try {
      await updatePet(petId, data);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("SUBMIT ERROR:", err);
      setError(err.response?.data?.message || "Failed to update pet details.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-300 dark:bg-dark-card border border-zinc-200 dark:border-dark-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-8 py-5 dark:border-dark-border shrink-0">
          <h3 className="flex items-center gap-3 text-xl font-bold text-zinc-800 dark:text-zinc-100 italic uppercase tracking-tight">
            <span className="text-brand-500">/</span> Edit Pet Details
          </h3>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors dark:bg-zinc-800 dark:text-zinc-400"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar p-8">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-brand-600" />
                <p className="text-sm font-bold text-zinc-500">Loading pet data...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} id="edit-pet-form" className="space-y-8">
              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400">
                  <FiAlertCircle className="shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}

              <div className="flex flex-col items-center gap-4 py-4 border-b border-zinc-100 dark:border-dark-border">
                <button 
                  type="button" 
                  onClick={() => photoInputRef.current?.click()}
                  className="group relative w-32 h-32 rounded-[2.5rem] bg-zinc-50 dark:bg-dark-surface border-2 border-dashed border-zinc-200 dark:border-dark-border flex items-center justify-center overflow-hidden hover:border-brand-500 transition-all"
                >
                  {photoValue ? (
                    <img src={getActualPetImageUrl(photoValue)} className="w-full h-full object-cover" alt="Preview" />
                  ) : (
                    <div className="text-center">
                      <FiCamera className="w-10 h-10 text-zinc-300 mx-auto mb-1 group-hover:text-brand-500 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Add Photo</span>
                    </div>
                  )}
                </button>
                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Pet Name *</label>
                  <input 
                    {...register("name")}
                    className={clsx("input-field font-bold text-lg", errors.name && "border-rose-500")}
                    placeholder="Buddy, Daisy, etc."
                  />
                  {errors.name && <p className="mt-1 text-[10px] text-rose-500 font-bold uppercase">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Species *</label>
                  <div className="relative">
                    <select 
                      {...register("species_id")}
                      className="input-field font-bold appearance-none pr-10"
                    >
                      <option value="">— Select Species —</option>
                      {speciesList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Breed</label>
                  <div className="relative">
                    <select 
                      {...register("breed_id")}
                      disabled={!speciesIdValue || availableBreeds.length === 0}
                      className="input-field font-bold appearance-none pr-10 disabled:opacity-50"
                    >
                      <option value="">{availableBreeds.length > 0 ? "— Select Breed —" : "No breeds found"}</option>
                      {availableBreeds.map((b: any) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Gender</label>
                  <select {...register("sex")} className="input-field font-bold">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Male (Neutered)">Male (Neutered)</option>
                    <option value="Female (Spayed)">Female (Spayed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Birth Date</label>
                  <input type="date" {...register("date_of_birth")} className="input-field font-bold" />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Weight (kg) *</label>
                  <input type="number" step="any" {...register("weight")} className="input-field font-bold" placeholder="0.0" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Age Classification</label>
                  <div className="input-field font-bold bg-zinc-50 dark:bg-dark-surface/50 flex items-center text-zinc-500 px-4">
                    {watch("age_group") || "Determined by birth date"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Allergies</label>
                  <input {...register("allergies")} className="input-field font-medium" placeholder="Pollen, Penicillin, etc." />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Current Medication</label>
                  <input {...register("medication")} className="input-field font-medium" placeholder="Daily vitamins, etc." />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Medical Notes</label>
                <textarea 
                  {...register("notes")}
                  className="input-field h-32 py-4 resize-none font-medium text-base"
                  placeholder="Any other details the vet should know?"
                />
              </div>
            </form>
          )}
        </div>

        <div className="border-t bg-zinc-50 px-8 py-5 dark:border-dark-border dark:bg-dark-surface/50 shrink-0 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 font-bold hover:bg-zinc-50 transition-all dark:bg-dark-card dark:border-dark-border dark:text-zinc-400"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="edit-pet-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-xl bg-brand-500 text-white font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50"
          >
            <FiCheckCircle />
            {isSubmitting ? "Updating..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
