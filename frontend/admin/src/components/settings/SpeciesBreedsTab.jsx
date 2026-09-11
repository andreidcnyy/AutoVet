import { useState, useEffect } from "react";
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

export default function SpeciesBreedsTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecies, setSelectedSpecies] = useState(null);

  const [newSpeciesName, setNewSpeciesName] = useState("");
  const [newBreedName, setNewBreedName] = useState("");
  const [newBreedDefaultSize, setNewBreedDefaultSize] = useState("");

  const [editingSpecies, setEditingSpecies] = useState(null);
  const [editSpeciesName, setEditSpeciesName] = useState("");
  const [editingBreed, setEditingBreed] = useState(null);
  const [editBreedName, setEditBreedName] = useState("");
  const [editBreedDefaultSize, setEditBreedDefaultSize] = useState("");
  const [sizeCategories, setSizeCategories] = useState([]);

  const SPECIES_CACHE_KEY = 'settings_species_cache';
  const SIZE_CATS_CACHE_KEY = 'settings_size_cats_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  const invalidateCache = () => {
    try { localStorage.removeItem(SPECIES_CACHE_KEY); } catch (_) {}
  };

  const fetchSpecies = async (signal) => {
    if (!user?.token) { setLoading(false); return; }
    try {
      const res = await fetch("/api/species", {
        signal,
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user.token}` }
      });
      if (res.ok) {
        const result = await res.json();
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setSpecies(normalized);
        try { localStorage.setItem(SPECIES_CACHE_KEY, JSON.stringify({ data: normalized, ts: Date.now() })); } catch (_) {}
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      toast.error("Failed to load species.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSizeCategories = async (signal) => {
    if (!user?.token) return;
    try {
      const res = await fetch("/api/pet-size-categories?per_page=100", {
        signal,
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user.token}` }
      });
      if (res.ok) {
        const result = await res.json();
        const cats = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setSizeCategories(cats);
        try { localStorage.setItem(SIZE_CATS_CACHE_KEY, JSON.stringify({ data: cats, ts: Date.now() })); } catch (_) {}
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Failed to load size categories", err);
    }
  };

  useEffect(() => {
    try {
      const speciesCached = JSON.parse(localStorage.getItem(SPECIES_CACHE_KEY) || 'null');
      if (speciesCached && Date.now() - speciesCached.ts < CACHE_TTL && Array.isArray(speciesCached.data)) {
        setSpecies(speciesCached.data);
        setLoading(false);
      }
      const sizeCached = JSON.parse(localStorage.getItem(SIZE_CATS_CACHE_KEY) || 'null');
      if (sizeCached && Date.now() - sizeCached.ts < CACHE_TTL && Array.isArray(sizeCached.data)) {
        setSizeCategories(sizeCached.data);
      }
    } catch (_) {}

    const controller = new AbortController();
    fetchSpecies(controller.signal);
    fetchSizeCategories(controller.signal);
    const onVisible = () => { if (document.visibilityState === 'visible') { fetchSpecies(); fetchSizeCategories(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  const handleAddSpecies = async (e) => {
    e.preventDefault();
    if (!newSpeciesName.trim()) return;
    try {
      const res = await fetch("/api/species", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${user?.token}` },
        body: JSON.stringify({ name: newSpeciesName.trim(), status: "Active" })
      });
      if (res.ok) {
        const created = await res.json();
        const newEntry = { ...created, breeds: created.breeds || [] };
        setSpecies(prev => [...prev, newEntry]);
        invalidateCache();
        toast.success("Species added.");
        setNewSpeciesName("");
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to add species.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const handleDeleteSpecies = async (id) => {
    if (!window.confirm("Are you sure? This may affect linked pets.")) return;
    try {
      const res = await fetch(`/api/species/${id}`, {
        method: "DELETE",
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
      });
      if (res.ok) {
        setSpecies(prev => prev.filter(s => s.id !== id));
        invalidateCache();
        if (selectedSpecies?.id === id) setSelectedSpecies(null);
        toast.success("Species removed.");
      }
    } catch {
      toast.error("Failed to delete species.");
    }
  };

  const handleUpdateSpecies = async (id) => {
    if (!editSpeciesName.trim()) return;
    try {
      const res = await fetch(`/api/species/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${user?.token}` },
        body: JSON.stringify({ name: editSpeciesName.trim() })
      });
      if (res.ok) {
        setSpecies(prev => prev.map(s => s.id === id ? { ...s, name: editSpeciesName.trim() } : s));
        invalidateCache();
        if (selectedSpecies?.id === id) setSelectedSpecies(prev => ({ ...prev, name: editSpeciesName.trim() }));
        setEditingSpecies(null);
        toast.success("Species updated.");
      }
    } catch {
      toast.error("Failed to update species.");
    }
  };

  const handleAddBreed = async (e) => {
    e.preventDefault();
    if (!newBreedName.trim() || !selectedSpecies) return;
    try {
      const res = await fetch("/api/breeds", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${user?.token}` },
        body: JSON.stringify({
          species_id: selectedSpecies.id,
          name: newBreedName.trim(),
          default_size_category_id: newBreedDefaultSize || null,
          status: "Active"
        })
      });
      if (res.ok) {
        const created = await res.json();
        setSpecies(prev => prev.map(s =>
          s.id === selectedSpecies.id
            ? { ...s, breeds: [...(s.breeds || []), created] }
            : s
        ));
        invalidateCache();
        toast.success("Breed added.");
        setNewBreedName("");
        setNewBreedDefaultSize("");
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to add breed.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const handleDeleteBreed = async (id) => {
    if (!window.confirm("Delete this breed?")) return;
    try {
      const res = await fetch(`/api/breeds/${id}`, {
        method: "DELETE",
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
      });
      if (res.ok) {
        setSpecies(prev => prev.map(s => ({
          ...s,
          breeds: (s.breeds || []).filter(b => b.id !== id)
        })));
        invalidateCache();
        toast.success("Breed removed.");
      }
    } catch {
      toast.error("Failed to delete breed.");
    }
  };

  const handleUpdateBreed = async (breed) => {
    if (!editBreedName.trim()) return;
    const sizeCat = sizeCategories.find(c => c.id.toString() === editBreedDefaultSize.toString()) || null;
    try {
      const res = await fetch(`/api/breeds/${breed.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${user?.token}` },
        body: JSON.stringify({
          species_id: breed.species_id,
          name: editBreedName.trim(),
          default_size_category_id: editBreedDefaultSize || null
        })
      });
      if (res.ok) {
        setSpecies(prev => prev.map(s => ({
          ...s,
          breeds: (s.breeds || []).map(b =>
            b.id === breed.id
              ? { ...b, name: editBreedName.trim(), default_size_category_id: editBreedDefaultSize || null, default_size_category: sizeCat }
              : b
          )
        })));
        invalidateCache();
        setEditingBreed(null);
        toast.success("Breed updated.");
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to update breed.");
      }
    } catch {
      toast.error("Failed to update breed.");
    }
  };

  if (loading) return <div className="p-6 text-zinc-500">Loading species data...</div>;

  const currentSpeciesData = species.find(s => s.id === selectedSpecies?.id);

  const filteredSpecies = newSpeciesName.trim()
    ? species.filter(s => s.name.toLowerCase().includes(newSpeciesName.toLowerCase()))
    : species;

  // The size select narrows the list as well as supplying the default size for
  // a breed added from this form. It only did the latter, so choosing a size
  // left every other size on screen and read as a filter that does nothing.
  const filteredBreeds = (currentSpeciesData?.breeds || []).filter(b => {
    const matchesName = !newBreedName.trim()
      || b.name.toLowerCase().includes(newBreedName.toLowerCase());
    const matchesSize = !newBreedDefaultSize
      || String(b.default_size_category_id ?? "") === String(newBreedDefaultSize);
    return matchesName && matchesSize;
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="card-shell p-6">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Species</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage base species (e.g., Canine, Feline).</p>

        <form onSubmit={handleAddSpecies} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newSpeciesName}
              onChange={(e) => setNewSpeciesName(e.target.value)}
              placeholder="Search or add species..."
              className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 pr-8 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            {newSpeciesName && (
              <button type="button" onClick={() => setNewSpeciesName("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                <FiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button type="submit" disabled={!newSpeciesName.trim()} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <FiPlus /> Add
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {filteredSpecies.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${selectedSpecies?.id === s.id ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-900/20' : 'border-zinc-200 bg-white hover:border-emerald-300 dark:border-dark-border dark:bg-dark-card'}`}
            >
              {editingSpecies === s.id ? (
                <div className="flex flex-1 items-center gap-2 mr-2">
                  <input
                    autoFocus
                    type="text"
                    value={editSpeciesName}
                    onChange={(e) => setEditSpeciesName(e.target.value)}
                    className="h-8 w-full rounded border border-zinc-300 px-2 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-100"
                  />
                  <button onClick={() => handleUpdateSpecies(s.id)} className="text-green-600 hover:text-green-700 p-1"><FiCheck /></button>
                  <button onClick={() => setEditingSpecies(null)} className="text-zinc-400 hover:text-zinc-600 p-1"><FiX /></button>
                </div>
              ) : (
                <div
                  className="cursor-pointer flex-1 font-medium text-zinc-700 dark:text-zinc-200"
                  onClick={() => { setSelectedSpecies(s); setBreedSearch(""); }}
                >
                  {s.name} <span className="text-xs text-zinc-400 ml-2">({s.breeds?.length || 0} breeds)</span>
                </div>
              )}

              {editingSpecies !== s.id && (
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingSpecies(s.id); setEditSpeciesName(s.name); }}
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-dark-surface"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSpecies(s.id)}
                    className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
          {filteredSpecies.length === 0 && <p className="text-sm text-zinc-500">{newSpeciesName ? "No species match your search." : "No species found."}</p>}
        </ul>
      </section>

      <section className={`card-shell p-6 transition-opacity ${selectedSpecies ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {selectedSpecies ? `Breeds for ${selectedSpecies.name}` : 'Select a Species'}
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage associated breeds.</p>

        {selectedSpecies && (
          <>
            <form onSubmit={handleAddBreed} className="mt-6 flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={newBreedName}
                    onChange={(e) => setNewBreedName(e.target.value)}
                    placeholder={`Search or add ${selectedSpecies.name} breed...`}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 pr-8 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                  />
                  {newBreedName && (
                    <button type="button" onClick={() => setNewBreedName("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <select
                  value={newBreedDefaultSize}
                  onChange={(e) => setNewBreedDefaultSize(e.target.value)}
                  className="h-10 w-48 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                >
                  <option value="">All Sizes</option>
                  {sizeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <button type="submit" disabled={!newBreedName.trim()} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <FiPlus /> Add
                </button>
              </div>
            </form>

            <ul className="mt-4 space-y-2">
              {filteredBreeds.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 dark:border-dark-border dark:bg-dark-card">
                  {editingBreed === b.id ? (
                    <div className="flex flex-1 flex-col gap-2 mr-2">
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={editBreedName}
                          onChange={(e) => setEditBreedName(e.target.value)}
                          className="h-8 w-full rounded border border-zinc-300 px-2 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-100"
                        />
                        <select
                          value={editBreedDefaultSize}
                          onChange={(e) => setEditBreedDefaultSize(e.target.value)}
                          className="h-8 w-40 rounded border border-zinc-300 px-2 text-sm dark:border-dark-border dark:bg-dark-surface dark:text-zinc-100"
                        >
                          <option value="">Size...</option>
                          {sizeCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <button onClick={() => handleUpdateBreed(b)} className="text-green-600 p-1"><FiCheck /></button>
                        <button onClick={() => setEditingBreed(null)} className="text-zinc-400 p-1"><FiX /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-between">
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">{b.name}</span>
                      {b.default_size_category && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                          {b.default_size_category.name}
                        </span>
                      )}
                    </div>
                  )}

                  {editingBreed !== b.id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingBreed(b.id); setEditBreedName(b.name); setEditBreedDefaultSize(b.default_size_category_id || ""); }}
                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-dark-surface"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBreed(b.id)}
                        className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {filteredBreeds.length === 0 && (
                <p className="text-sm text-zinc-500">
                  {newBreedName || newBreedDefaultSize ? "No breeds match your search." : "No breeds added yet."}
                </p>
              )}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
