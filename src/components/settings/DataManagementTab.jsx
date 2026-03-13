import { useState, useEffect } from "react";
import { FiSave } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";

export default function DataManagementTab() {
  const toast = useToast();
  const [speciesList, setSpeciesList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [serviceCategoryList, setServiceCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newSpecies, setNewSpecies] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        try {
          setSpeciesList(data.species_list ? JSON.parse(data.species_list) : ["Canine", "Feline", "Avian", "Reptile", "Exotic", "Other"]);
          setCategoryList(data.inventory_categories ? JSON.parse(data.inventory_categories) : ["Vaccines", "Antibiotics", "Supplies", "Diagnostics"]);
          setServiceCategoryList(data.service_categories ? JSON.parse(data.service_categories) : ["Consultation", "Grooming", "Surgery", "Diagnostics"]);
        } catch {
          setSpeciesList(["Canine", "Feline", "Avian", "Reptile", "Exotic", "Other"]);
          setCategoryList(["Vaccines", "Antibiotics", "Supplies", "Diagnostics"]);
          setServiceCategoryList(["Consultation", "Grooming", "Surgery", "Diagnostics"]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          settings: {
            species_list: JSON.stringify(speciesList),
            inventory_categories: JSON.stringify(categoryList),
            service_categories: JSON.stringify(serviceCategoryList)
          }
        })
      });
      toast.success("Data lists updated securely.");
    } catch {
      toast.error("Failed to update lists.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSpecies = (e) => {
    e.preventDefault();
    const name = newSpecies.trim();
    if (name && !speciesList.includes(name)) {
      setSpeciesList([...speciesList, name]);
      setNewSpecies("");
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (name && !categoryList.includes(name)) {
      setCategoryList([...categoryList, name]);
      setNewCategory("");
    }
  };

  const handleAddServiceCategory = (e) => {
    e.preventDefault();
    const name = newServiceCategory.trim();
    if (name && !serviceCategoryList.includes(name)) {
      setServiceCategoryList([...serviceCategoryList, name]);
      setNewServiceCategory("");
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading data management...</div>;

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Data Management</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage dynamic list values used across the clinic system.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Species List</h4>
          </div>
          <form onSubmit={handleAddSpecies} className="flex gap-2">
            <input
              type="text"
              value={newSpecies}
              onChange={(e) => setNewSpecies(e.target.value)}
              placeholder="e.g. Amphibian"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {speciesList.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {s} <button onClick={() => setSpeciesList(speciesList.filter(i => i !== s))} className="ml-1 text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Inventory Categories</h4>
          </div>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Preventatives"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categoryList.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {c} <button onClick={() => setCategoryList(categoryList.filter(i => i !== c))} className="ml-1 text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Service Categories</h4>
          </div>
          <form onSubmit={handleAddServiceCategory} className="flex gap-2">
            <input
              type="text"
              value={newServiceCategory}
              onChange={(e) => setNewServiceCategory(e.target.value)}
              placeholder="e.g. Grooming"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {serviceCategoryList.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {c} <button onClick={() => setServiceCategoryList(serviceCategoryList.filter(i => i !== c))} className="ml-1 text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <FiSave className="h-4 w-4" />
        {isSaving ? "Saving..." : "Save List Changes"}
      </button>
    </section>
  );
}
