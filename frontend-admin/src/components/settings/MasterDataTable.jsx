import { useState, useEffect, useCallback } from "react";
import { FiEdit2, FiTrash2, FiPlus, FiSearch, FiX, FiSave, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

export default function MasterDataTable({ title, description, apiUrl, columns, initialForm, defaultSortBy = "name" }) {
  const { success, error } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.token) {
      setLoading(false); 
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        sort_by: sortBy,
        sort_direction: sortDir,
        page: page.toString(),
        per_page: "10"
      });
      const res = await fetch(`${apiUrl}?${query.toString()}`, {
        headers: {
          "Authorization": `Bearer ${user.token}`,
          "Accept": "application/json"
        }
      });
      if (!res.ok) {
        console.error(`[MasterDataTable fetch] Failed URL: ${apiUrl}, Status: ${res.status}`);
        throw new Error(`Failed to load ${title.toLowerCase()}: ${res.status}`);
      }
      const result = await res.json();
      
      // Normalize data: handling both { data: [...] } and direct array [...]
      const normalizedData = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
      setData(normalizedData);
      
      setMeta({
        current_page: result.current_page || 1,
        last_page: result.last_page || 1,
        total: result.total || normalizedData.length
      });
    } catch (err) {
      console.error(`[MasterDataTable fetch catch] URL: ${apiUrl}, Error:`, err);
      error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, search, sortBy, sortDir, page, error, title, user?.token]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const isEditing = !!editingItem;
    const url = isEditing ? `${apiUrl}/${editingItem.id}` : apiUrl;
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
          const errData = await res.json();
          console.error(`[MasterDataTable save] Failed URL: ${url}, Response:`, errData);
          throw new Error(errData.message || "Failed to save item");
      }
      success(`${title.slice(0, -1)} ${isEditing ? "updated" : "added"} successfully`);
      fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(`[MasterDataTable save catch] URL: ${url}, Error:`, err);
      error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(`Are you sure you want to delete this ${title.toLowerCase().slice(0, -1)}?`)) return;
    try {
      const res = await fetch(`${apiUrl}/${id}`, { 
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${user?.token}`,
          "Accept": "application/json"
        }
      });
      if (!res.ok) {
        console.error(`[MasterDataTable delete] Failed URL: ${apiUrl}/${id}, Status: ${res.status}`);
        throw new Error("Failed to delete item");
      }
      success(`${title.slice(0, -1)} deleted`);
      fetchData();
    } catch (err) {
      console.error(`[MasterDataTable delete catch] Error:`, err);
      error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
          {description && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all hover:-translate-y-0.5"
          >
            <FiPlus className="h-4 w-4" />
            <span>Add New</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50/50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:bg-dark-surface/50 dark:text-zinc-400">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="px-5 py-4 cursor-pointer hover:text-emerald-600 transition" onClick={() => {
                  if (sortBy === col.key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                  else { setSortBy(col.key); setSortDir("asc"); }
                }}>
                  <div className="flex items-center gap-2">
                    {col.label}
                    {sortBy === col.key && (
                      <span className="text-emerald-600">{sortDir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-5 py-4 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-zinc-700 dark:text-zinc-300">
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-zinc-400">Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-zinc-400">No data found</td></tr>
            ) : data.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-dark-surface/50 transition">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render ? col.render(item[col.key], item) : item[col.key]}
                  </td>
                ))}
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleOpenModal(item)} 
                      title="Edit"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 dark:border-zinc-800 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                    >
                      <FiEdit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      title="Delete"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 transition-all hover:bg-red-50 hover:text-red-500 dark:border-zinc-800 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {meta.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface/30">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Page {meta.current_page} of {meta.last_page} ({meta.total} total)
            </span>
            <div className="flex gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="rounded border border-zinc-200 p-1 hover:bg-white disabled:opacity-30 dark:border-dark-border dark:hover:bg-dark-surface"
              >
                <FiChevronLeft size={16} />
              </button>
              <button 
                disabled={page === meta.last_page}
                onClick={() => setPage(page + 1)}
                className="rounded border border-zinc-200 p-1 hover:bg-white disabled:opacity-30 dark:border-dark-border dark:hover:bg-dark-surface"
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-dark-card border dark:border-dark-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{editingItem ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {Object.keys(initialForm).map(key => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1 capitalize">{key.replace('_', ' ')}</label>
                  {key === 'status' ? (
                    <select 
                      value={formData[key]} 
                      onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 p-2 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  ) : (
                    <input 
                      required
                      type="text" 
                      value={formData[key]} 
                      onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 p-2 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-sm font-medium text-zinc-500">Cancel</button>
                <button disabled={isSaving} type="submit" className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <FiSave size={16} /> {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
