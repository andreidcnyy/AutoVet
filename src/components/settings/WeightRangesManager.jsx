import { useState, useEffect, useCallback } from "react";
import { FiEdit2, FiTrash2, FiPlus, FiSearch, FiX, FiSave, FiChevronLeft, FiChevronRight, FiCheckCircle, FiCircle } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

export default function WeightRangesManager() {
  const { error, success } = useToast();
  const { user } = useAuth();
  const [species, setSpecies] = useState([]);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [sizeCategories, setSizeCategories] = useState([]);
  
  const [ranges, setRanges] = useState([]);
  const [loadingRanges, setLoadingRanges] = useState(false);
  const [loadingSpecies, setLoadingSpecies] = useState(true);
  
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const initialForm = {
    label: "",
    min_weight: 0,
    max_weight: "",
    unit: "kg",
    size_category_id: "",
    status: "Active",
    species_id: ""
  };
  const [formData, setFormData] = useState(initialForm);

  // Fetch species and size categories on mount
  useEffect(() => {
    if (!user?.token) {
      setLoadingSpecies(false);
      return;
    }
    
    let isMounted = true;
    const init = async () => {
      if (isMounted) setLoadingSpecies(true);
      try {
        const headers = {
          "Authorization": `Bearer ${user.token}`,
          "Accept": "application/json"
        };
        
        const specPromise = fetch("/api/species", { headers }).then(r => r.ok ? r.json() : null).catch(e => { console.error("Error fetching species:", e); return null; });
        const sizePromise = fetch("/api/pet-size-categories", { headers }).then(r => r.ok ? r.json() : null).catch(e => { console.error("Error fetching sizes:", e); return null; });
        
        const [specData, sizeData] = await Promise.all([specPromise, sizePromise]);
        
        if (!isMounted) return;

        if (specData) {
          const speciesList = Array.isArray(specData.data) ? specData.data : (Array.isArray(specData) ? specData : []);
          setSpecies(speciesList);
          if (speciesList.length > 0) {
            setSelectedSpecies(speciesList[0]);
          }
        } else {
          error("Failed to load species data.");
        }
        
        if (sizeData) {
          const sizeList = Array.isArray(sizeData.data) ? sizeData.data : (Array.isArray(sizeData) ? sizeData : []);
          setSizeCategories(sizeList);
        } else {
          error("Failed to load pet size categories.");
        }
      } catch (err) {
        console.error("Initialization error:", err);
        if (isMounted) error(err.message || "Failed to load initial data");
      } finally {
        if (isMounted) setLoadingSpecies(false);
      }
    };
    init();
    return () => { isMounted = false; };
  }, [error, user?.token]);

  const fetchRanges = useCallback(async () => {
    if (!selectedSpecies || !user?.token) {
      setLoadingRanges(false);
      return;
    }
    setLoadingRanges(true);
    try {
      const query = new URLSearchParams({
        species_id: selectedSpecies.id,
        search: search,
        per_page: "100" // Load all for this species for now
      });
      const res = await fetch(`/api/weight-ranges?${query.toString()}`, {
        headers: {
          "Authorization": `Bearer ${user.token}`,
          "Accept": "application/json"
        }
      });
      if (!res.ok) {
        console.error(`[fetchRanges error] Status: ${res.status}`);
        throw new Error("Failed to load weight ranges");
      }
      const result = await res.json();
      
      // Normalize: Handle both { data: [...] } and direct array [...]
      const normalizedData = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
      setRanges(normalizedData);
    } catch (err) {
      console.error("[fetchRanges catch]:", err);
      error("Failed to load weight ranges");
    } finally {
      setLoadingRanges(false);
    }
  }, [selectedSpecies, search, error, user?.token]);

  useEffect(() => {
    fetchRanges();
  }, [fetchRanges]);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        ...item,
        max_weight: item.max_weight === null ? "" : item.max_weight
      });
    } else {
      setEditingItem(null);
      setFormData({
        ...initialForm,
        species_id: selectedSpecies.id
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const isEditing = !!editingItem;
    const url = isEditing ? `/api/weight-ranges/${editingItem.id}` : "/api/weight-ranges";
    const method = isEditing ? "PUT" : "POST";

    // Prepare data
    const payload = {
      ...formData,
      max_weight: formData.max_weight === "" ? null : formData.max_weight
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 
            "Content-Type": "application/json", 
            "Accept": "application/json",
            "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const result = await res.json();
        console.error("[handleSave error]:", result);
        throw new Error(result.message || "Failed to save range");
      }
      
      success(`Weight range ${isEditing ? "updated" : "added"} successfully`);
      fetchRanges();
      setIsModalOpen(false);
    } catch (err) {
      console.error("[handleSave catch]:", err);
      error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this weight range?")) return;
    try {
      const res = await fetch(`/api/weight-ranges/${id}`, { 
          method: "DELETE",
          headers: {
              "Authorization": `Bearer ${user?.token}`,
              "Accept": "application/json"
          }
      });
      if (!res.ok) {
          console.error(`[handleDelete error] Status: ${res.status}`);
          throw new Error("Failed to delete range");
      }
      success("Weight range deleted");
      fetchRanges();
    } catch (err) {
      console.error("[handleDelete catch]:", err);
      error(err.message);
    }
  };

  if (loadingSpecies) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-500 animate-pulse font-medium">Loading species master data...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 min-h-[500px]">
      {/* Sidebar: Compact Species List */}
      <div className="w-full xl:w-56 flex-shrink-0">
        <div className="mb-4 flex items-center justify-between px-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Species</h3>
        </div>
        <div className="flex flex-row xl:flex-col gap-2 overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
          {species?.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSpecies(s)}
              className={clsx(
                "flex min-w-[120px] flex-1 items-center justify-between whitespace-nowrap rounded-xl px-4 py-2.5 transition-all duration-200 group xl:w-full",
                selectedSpecies?.id === s.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-dark-border"
              )}
            >
              <span className="text-sm font-bold">{s.name}</span>
              {selectedSpecies?.id === s.id ? (
                <FiCheckCircle className="shrink-0 text-blue-100" />
              ) : (
                <div className="h-2 w-2 shrink-0 rounded-full bg-slate-200 dark:bg-zinc-700 group-hover:bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Weight Ranges for Selected Species */}
      <div className="flex-1 min-w-0">
        {!selectedSpecies ? (
          <div className="flex aspect-video items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 p-12 text-center">
            <div className="max-w-xs">
               <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                 <FiChevronRight size={24} />
               </div>
               <p className="text-sm font-medium text-slate-500">Select a species from the left to manage its weight ranges.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">{selectedSpecies.name} Ranges</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  Configure weight tiers for {selectedSpecies.name.toLowerCase()}s.
                </p>
              </div>
              <div className="flex items-center gap-3">
                 <div className="relative flex-1 sm:w-64">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search ranges..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                  />
                </div>
                <button 
                  onClick={() => handleOpenModal()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all hover:-translate-y-0.5"
                >
                  <FiPlus className="h-4 w-4" />
                  <span>Add Range</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-dark-surface/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-5 py-4">Label</th>
                    <th className="px-5 py-4 text-center">Min (kg)</th>
                    <th className="px-5 py-4 text-center">Max (kg)</th>
                    <th className="px-5 py-4">Size Category</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-border text-slate-700 dark:text-zinc-300">
                  {loadingRanges ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading ranges...</td></tr>
                  ) : ranges.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No ranges configured yet.</td></tr>
                  ) : ranges.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-dark-surface/50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-zinc-100">{item.label}</td>
                      <td className="px-5 py-4 text-center tabular-nums">{item.min_weight}</td>
                      <td className="px-5 py-4 text-center tabular-nums">{item.max_weight || "∞"}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {item.size_category?.name || "Unlinked"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={clsx(
                          "inline-flex h-2 w-2 rounded-full ring-4 ring-white dark:ring-dark-card",
                          item.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'
                        )} />
                        <span className="ml-2 text-xs font-medium">{item.status}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleOpenModal(item)} 
                            title="Edit"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-800 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)} 
                            title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-all hover:bg-red-50 hover:text-red-500 dark:border-zinc-800 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Customized for Weight Range */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">
                  {editingItem ? 'Edit' : 'Add'} {selectedSpecies?.name} Range
                </h3>
                <p className="text-sm text-slate-500">Fine-tune weight bracket and size association.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-dark-surface transition"
              >
                <FiX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Label</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Small, Medium"
                    value={formData.label} 
                    onChange={e => setFormData({ ...formData, label: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Min Weight (kg)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      min="0"
                      value={formData.min_weight} 
                      onChange={e => setFormData({ ...formData, min_weight: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Max Weight (kg)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="Leave blank for NuLL"
                      value={formData.max_weight} 
                      onChange={e => setFormData({ ...formData, max_weight: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                    />
                    <p className="mt-1 text-[10px] text-slate-400 text-right">Leave empty for open-ended</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Size Category</label>
                  <select 
                    required
                    value={formData.size_category_id} 
                    onChange={e => setFormData({ ...formData, size_category_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white appearance-none"
                  >
                    <option value="">Select a size...</option>
                    {sizeCategories?.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Unit</label>
                    <select 
                      value={formData.unit} 
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                    >
                      <option value="kg">kilogram (kg)</option>
                      <option value="lb">pound (lb)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Status</label>
                    <select 
                      value={formData.status} 
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-dark-surface transition"
                >
                  Cancel
                </button>
                <button 
                  disabled={isSaving} 
                  type="submit" 
                  className="flex-2 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-xl shadow-blue-500/25 disabled:opacity-50 transition"
                >
                  <FiSave size={18} /> {isSaving ? "Saving..." : editingItem ? "Update Range" : "Create Range"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
