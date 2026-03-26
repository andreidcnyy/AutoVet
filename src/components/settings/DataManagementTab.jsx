import { useState, useEffect } from "react";
import { FiSave } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";

export default function DataManagementTab() {
  const toast = useToast();
  const [inventoryCategories, setInventoryCategories] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newInvCat, setNewInvCat] = useState("");
  const [newSvcCat, setNewSvcCat] = useState("");

  const [editingInvCat, setEditingInvCat] = useState(null);
  const [editInvValue, setEditInvValue] = useState("");
  const [editingSvcCat, setEditingSvcCat] = useState(null);
  const [editSvcValue, setEditSvcValue] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        try {
          setInventoryCategories(data.inventory_categories ? JSON.parse(data.inventory_categories) : []);
        } catch {
          setInventoryCategories([]);
        }
        try {
          setServiceCategories(data.service_categories ? JSON.parse(data.service_categories) : []);
        } catch {
          setServiceCategories([]);
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
            inventory_categories: JSON.stringify(inventoryCategories),
            service_categories: JSON.stringify(serviceCategories)
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

  const addInvCat = (e) => {
    e.preventDefault();
    const name = newInvCat.trim();
    if (name && !inventoryCategories.includes(name)) {
      setInventoryCategories([...inventoryCategories, name]);
      setNewInvCat("");
    }
  };

  const addSvcCat = (e) => {
    e.preventDefault();
    const name = newSvcCat.trim();
    if (name && !serviceCategories.includes(name)) {
      setServiceCategories([...serviceCategories, name]);
      setNewSvcCat("");
    }
  };

  const updateInvCat = (oldName) => {
    const newName = editInvValue.trim();
    if (newName && newName !== oldName && !inventoryCategories.includes(newName)) {
      setInventoryCategories(inventoryCategories.map(c => c === oldName ? newName : c));
    }
    setEditingInvCat(null);
  };

  const updateSvcCat = (oldName) => {
    const newName = editSvcValue.trim();
    if (newName && newName !== oldName && !serviceCategories.includes(newName)) {
      setServiceCategories(serviceCategories.map(c => c === oldName ? newName : c));
    }
    setEditingSvcCat(null);
  };

  if (loading) return <div className="p-6 text-slate-500">Loading data management...</div>;

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Data Lists Management</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage dynamic list values used across the clinic logic.</p>

      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Inventory Categories */}
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Inventory Categories</h4>
          <form onSubmit={addInvCat} className="flex gap-2">
            <input
              type="text"
              value={newInvCat}
              onChange={(e) => setNewInvCat(e.target.value)}
              placeholder="e.g. Preventatives"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" disabled={!newInvCat.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {inventoryCategories.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {editingInvCat === c ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={editInvValue}
                      onChange={(e) => setEditInvValue(e.target.value)}
                      onBlur={() => updateInvCat(c)}
                      onKeyDown={(e) => e.key === 'Enter' && updateInvCat(c)}
                      className="h-6 w-24 rounded border border-blue-400 px-1 text-xs focus:outline-none dark:bg-dark-surface dark:text-white"
                    />
                  </div>
                ) : (
                  <>
                    <span className="cursor-pointer" onClick={() => { setEditingInvCat(c); setEditInvValue(c); }}>{c}</span>
                    <button onClick={() => setInventoryCategories(inventoryCategories.filter(i => i !== c))} className="ml-1 text-red-500 hover:text-red-700">&times;</button>
                  </>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Service Categories */}
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Service Categories</h4>
          <form onSubmit={addSvcCat} className="flex gap-2">
            <input
              type="text"
              value={newSvcCat}
              onChange={(e) => setNewSvcCat(e.target.value)}
              placeholder="e.g. Diagnostics"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" disabled={!newSvcCat.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {serviceCategories.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {editingSvcCat === c ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={editSvcValue}
                      onChange={(e) => setEditSvcValue(e.target.value)}
                      onBlur={() => updateSvcCat(c)}
                      onKeyDown={(e) => e.key === 'Enter' && updateSvcCat(c)}
                      className="h-6 w-24 rounded border border-blue-400 px-1 text-xs focus:outline-none dark:bg-dark-surface dark:text-white"
                    />
                  </div>
                ) : (
                  <>
                    <span className="cursor-pointer" onClick={() => { setEditingSvcCat(c); setEditSvcValue(c); }}>{c}</span>
                    <button onClick={() => setServiceCategories(serviceCategories.filter(i => i !== c))} className="ml-1 text-red-500 hover:text-red-700">&times;</button>
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="mt-12 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <FiSave className="h-4 w-4" />
        {isSaving ? "Saving..." : "Save All Changes"}
      </button>
    </section>
  );
}
