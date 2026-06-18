import { useState } from "react";
import { LuSparkles } from "react-icons/lu";
import { FiAlertTriangle, FiCheckCircle, FiSearch, FiX } from "react-icons/fi";
import api from "../api";
import clsx from "clsx";

const urgencyConfig = {
  emergency: { label: "Emergency", color: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/40" },
  "same-day": { label: "Same-Day Attention", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/40" },
  routine:   { label: "Routine", color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/40" },
};

function AiClinicalSupportPage() {
  const [petId, setPetId] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [petResults, setPetResults] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const searchPets = async (query) => {
    if (query.length < 2) { setPetResults([]); return; }
    setSearching(true);
    try {
      const data = await api.get(`/api/patients?search=${encodeURIComponent(query)}&per_page=8`);
      setPetResults(data.data || data || []);
    } catch {
      setPetResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectPet = (pet) => {
    setSelectedPet(pet);
    setPetId(pet.id);
    setPetSearch(`${pet.name} — ${pet.owner_name || pet.owner?.name || ""}`);
    setPetResults([]);
    setResult(null);
    setError(null);
  };

  const clearPet = () => {
    setSelectedPet(null);
    setPetId("");
    setPetSearch("");
    setPetResults([]);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!petId || !symptoms.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await api.post("/api/ai/clinical-support", { pet_id: petId, symptoms });
      setResult(data);
    } catch (err) {
      setError(err.message || "AI service failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const urgency = result ? (urgencyConfig[result.urgency] || urgencyConfig.routine) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
          <LuSparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">AI Clinical Support</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Symptom-based differential reference for the attending veterinarian</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/20">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          <FiAlertTriangle className="inline mr-1.5 h-3.5 w-3.5" />
          AI-generated suggestions only. Final assessment and diagnosis are the sole responsibility of the attending veterinarian.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="card-shell p-6 space-y-5">
        {/* Pet Search */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">Patient</label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={petSearch}
              onChange={(e) => { setPetSearch(e.target.value); searchPets(e.target.value); }}
              placeholder="Search patient by name..."
              className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface pl-9 pr-9 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {selectedPet && (
              <button type="button" onClick={clearPet} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-rose-500">
                <FiX className="h-4 w-4" />
              </button>
            )}
            {petResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-lg overflow-hidden">
                {petResults.map((pet) => (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => selectPet(pet)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{pet.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{pet.species} · {pet.owner_name || pet.owner?.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Symptoms */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
            Reported Symptoms
          </label>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            rows={4}
            placeholder="Describe the symptoms observed by the owner or staff (e.g. vomiting for 2 days, loss of appetite, pale gums)..."
            className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          <p className="mt-1 text-[11px] text-zinc-400">{symptoms.length}/1000</p>
        </div>

        <button
          type="submit"
          disabled={loading || !petId || !symptoms.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <LuSparkles className={clsx("h-4 w-4", loading && "animate-spin")} />
          {loading ? "Analyzing..." : "Generate Clinical Support"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-900/20">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Urgency */}
          <div className="card-shell p-5 flex items-start gap-4">
            <span className={clsx("rounded-xl border px-3 py-1 text-xs font-black uppercase tracking-widest", urgency.color)}>
              {urgency.label}
            </span>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{result.urgency_reason}</p>
          </div>

          {/* Differentials */}
          <div className="card-shell p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">Differential Considerations</h3>
            <div className="space-y-4">
              {result.differentials?.map((d, i) => (
                <div key={i} className="rounded-xl border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FiCheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{d.condition}</p>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">{d.relevance}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                    Recommended Diagnostics: <span className="normal-case font-normal">{d.recommended_diagnostics}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pre-visit notes */}
          {result.pre_visit_notes && (
            <div className="card-shell p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">Pre-Visit Notes for Owner</h3>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{result.pre_visit_notes}</p>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic text-center">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

export default AiClinicalSupportPage;
