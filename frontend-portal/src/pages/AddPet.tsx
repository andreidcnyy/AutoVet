import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { 
  FiArrowLeft, 
  FiCamera, 
  FiChevronDown, 
  FiCheckCircle, 
  FiAlertCircle 
} from 'react-icons/fi';
import { LuPawPrint } from 'react-icons/lu';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSpecies, getPetSizeCategories, getWeightRanges, createPet, getBreeds } from '../api';
import { getAgeGroup, calculateAgeDisplay } from '../utils/petAgeGroups';
import { getActualPetImageUrl } from '../utils/petImages';

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

export default function AddPet() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [speciesList, setSpeciesList] = useState<any[]>([]);
  const [availableBreeds, setAvailableBreeds] = useState<any[]>([]);
  const [weightRanges, setWeightRanges] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(petSchema),
    defaultValues: {
      name: "", species_id: "", breed_id: "", date_of_birth: "",
      sex: "Male", age_group: "Adult", color: "", weight: 0, weight_unit: "kg",
      photo: ""
    }
  });

  const photoValue = watch("photo");
  const speciesIdValue = watch("species_id");
  const dobValue = watch("date_of_birth");
  const weightValue = watch("weight");

  // Load Initial Master Data
  useEffect(() => {
    getSpecies()
      .then(res => {
        const data = res.data.data || res.data;
        if (Array.isArray(data)) setSpeciesList(data);
      })
      .catch(console.error);

    getWeightRanges().then(res => {
        const data = res.data.data || res.data;
        setWeightRanges(Array.isArray(data) ? data : []);
    }).catch(console.error);
  }, []);

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
        }).catch(console.error);
      }
    } else {
      setAvailableBreeds([]);
    }
  }, [speciesIdValue, speciesList]);

  // Logic: Auto-calculate Age Group
  useEffect(() => {
    if (speciesIdValue && dobValue) {
      const speciesName = speciesList.find(s => String(s.id) === String(speciesIdValue))?.name;
      const computedAgeGroup = getAgeGroup(speciesName, dobValue);
      setValue("age_group", computedAgeGroup);
    }
  }, [speciesIdValue, dobValue, speciesList, setValue]);

  // Logic: Auto-calculate Size Category
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
    setError(null);
    try {
      await createPet(data);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to register pet.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition font-semibold text-sm">
          <FiArrowLeft /> Back
        </button>
        <button 
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50"
        >
          <FiCheckCircle />
          {isSubmitting ? "Saving..." : "Register Pet"}
        </button>
      </div>

      <div className="card-shell p-8 bg-white dark:bg-dark-card">
        <h3 className="flex items-center gap-3 text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-8 italic uppercase tracking-tight">
          <span className="text-brand-500">/</span> Register Pet
        </h3>

        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400">
            <FiAlertCircle className="shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <form className="space-y-8">
          {/* Photo Upload Section */}
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
              <div className="input-field font-bold bg-zinc-50 dark:bg-dark-surface/50 flex flex-col justify-center text-zinc-500 px-4 min-h-[2.75rem]">
                {watch("age_group") ? (
                  <>
                    <span>{watch("age_group")}</span>
                    <span className="text-[10px] text-zinc-400 font-medium">{calculateAgeDisplay(dobValue)}</span>
                  </>
                ) : "Enter birth date to calculate"}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Medical Notes</label>
            <textarea 
              {...register("notes")}
              className="input-field h-32 py-4 resize-none font-medium text-base"
              placeholder="Any allergies or existing conditions?"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
