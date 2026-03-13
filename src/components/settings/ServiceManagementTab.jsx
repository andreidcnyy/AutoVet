import clsx from "clsx";
import { useState, useEffect } from "react";
import { FiTrash2, FiPlus, FiEdit2, FiX, FiSave } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";

export default function ServiceManagementTab() {
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [formData, setFormData] = useState({ name: "", description: "", price: 0, category: "", status: "Active" });

  const fetchServices = () => {
    setLoading(true);
    fetch("/api/services")
      .then(res => res.json())
      .then(data => { setServices(data); setLoading(false); })
      .catch(err => { toast.error("Failed to load services"); setLoading(false); });
  };

  useEffect(() => {
    fetchServices();
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        try {
          setServiceCategories(data.service_categories ? JSON.parse(data.service_categories) : []);
        } catch {
          setServiceCategories([]);
        }
      })
      .catch(console.error);
  }, []);

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData({ name: service.name, description: service.description || "", price: service.price, category: service.category || "", status: service.status });
    } else {
      setEditingService(null);
      setFormData({ name: "", description: "", price: 0, category: "", status: "Active" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isEditing = !!editingService;
    const url = isEditing ? `/api/services/${editingService.id}` : "/api/services";
    const method = isEditing ? "PUT" : "POST";

    const payload = { ...formData, price: Number(formData.price) };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save service");
      toast.success(isEditing ? "Service updated" : "Service created");
      fetchServices();
      handleCloseModal();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Service deleted");
      fetchServices();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading services...</div>;

  return (
    <section className="card-shell p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Service Management</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage billing services and fixed prices.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          <FiPlus className="h-4 w-4" />
          Add New Service
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Service Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.id} className="border-b border-slate-200/80 dark:border-dark-border">
                <td className="px-4 py-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{svc.name}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[200px]">{svc.description}</p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700 dark:text-zinc-300">{svc.category || "-"}</td>
                <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">₱{Number(svc.price).toFixed(2)}</td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                      svc.status === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-100 text-slate-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400"
                    )}
                  >
                    {svc.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenModal(svc)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface hover:bg-slate-100">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(svc.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30 hover:bg-rose-50">
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-sm text-slate-500">No services found. Add one to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-card border dark:border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">{editingService ? "Edit Service" : "Add Service"}</h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"><FiX size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Service Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Description</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Price (₱) *</label>
                  <input required min="0" step="0.01" type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                    <option value="">Select Category</option>
                    {serviceCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-dark-border">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-zinc-300">Cancel</button>
                <button type="submit" className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700"><FiSave/> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
