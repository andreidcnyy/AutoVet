import clsx from "clsx";
import { useState, useEffect } from "react";
import { FiTrash2, FiPlus, FiEdit2, FiX, FiSave } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

export default function ServiceManagementTab() {
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [petSizes, setPetSizes] = useState([]);
  const [weightRanges, setWeightRanges] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const { user } = useAuth();

  const [formData, setFormData] = useState({ 
    name: "", 
    description: "", 
    price: 0, 
    category: "", 
    status: "Active",
    pricing_type: "fixed",
    measurement_basis: "none",
    base_price: 0,
    pricing_rules: []
  });

  const fetchServices = () => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/services", {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then(res => res.json())
      .then(result => { 
        const normalizedData = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setServices(normalizedData); 
        setLoading(false); 
      })
      .catch(err => { toast.error("Failed to load services"); setLoading(false); });
  };

  useEffect(() => {
    if (!user?.token) return;
    fetchServices();
    
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${user.token}`
    };

    // Fetch categories from MDM
    fetch("/api/service-categories", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setServiceCategories(normalized);
      }) 
      .catch(console.error);

    fetch("/api/pet-size-categories", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setPetSizes(normalized);
      })
      .catch(console.error);

    fetch("/api/weight-ranges", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setWeightRanges(normalized);
      })
      .catch(console.error);
  }, [user?.token]);

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData({ 
        name: service.name, 
        description: service.description || "", 
        price: service.price, 
        category: service.category || "", 
        status: service.status,
        pricing_type: service.pricing_type || "fixed",
        measurement_basis: service.measurement_basis || "none",
        base_price: service.base_price || service.price || 0,
        pricing_rules: service.pricing_rules || []
      });
    } else {
      setEditingService(null);
      setFormData({ 
        name: "", 
        description: "", 
        price: 0, 
        category: "", 
        status: "Active",
        pricing_type: "fixed",
        measurement_basis: "none",
        base_price: 0,
        pricing_rules: []
      });
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

    // Clean up pricing rules based on pricing_type
    let cleanedRules = [];
    if (formData.pricing_type === 'size_based') {
      cleanedRules = formData.pricing_rules.filter(r => r.basis_type === 'size');
    } else if (formData.pricing_type === 'weight_based') {
      cleanedRules = formData.pricing_rules.filter(r => r.basis_type === 'weight');
    }

    const payload = { 
      ...formData, 
      price: Number(formData.base_price || formData.price),
      base_price: Number(formData.base_price),
      pricing_rules: cleanedRules
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
      const res = await fetch(`/api/services/${id}`, { 
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
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
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage invoice services and fixed prices.</p>
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
              <th className="px-4 py-3">Pricing Mode</th>
              <th className="px-4 py-3">Base Price</th>
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
                <td className="px-4 py-4">
                  <span className="capitalize text-xs font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-dark-surface px-2 py-1 rounded">
                    {svc.pricing_type?.replace('_', ' ') || 'Fixed'}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">₱{Number(svc.base_price || svc.price).toFixed(2)}</td>
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
                <div className={formData.pricing_type === 'fixed' ? 'col-span-1' : 'col-span-2'}>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Pricing Type</label>
                  <select 
                    value={formData.pricing_type} 
                    onChange={e => {
                      const type = e.target.value;
                      let basis = 'none';
                      if (type === 'size_based') basis = 'size';
                      if (type === 'weight_based') basis = 'weight';
                      setFormData({...formData, pricing_type: type, measurement_basis: basis});
                    }}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="size_based">Size Based</option>
                    <option value="weight_based">Weight Based</option>
                  </select>
                </div>
                {formData.pricing_type === 'fixed' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Base Price (₱) *</label>
                    <input required min="0" step="0.01" type="number" value={formData.base_price || formData.price} onChange={e => setFormData({...formData, base_price: e.target.value, price: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                  </div>
                )}
              </div>

              {formData.pricing_type === 'size_based' && (
                <div className="mt-4 border-t pt-4 dark:border-dark-border bg-slate-50/50 dark:bg-dark-surface/50 p-3 rounded-xl">
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3">Size-based Pricing</p>
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                    {petSizes.map(size => {
                      const rule = formData.pricing_rules.find(r => r.basis_type === 'size' && r.reference_id === size.id);
                      return (
                        <div key={size.id} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-600 dark:text-zinc-400">{size.name}</span>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs text-sm">₱</span>
                            <input 
                              type="number" 
                              required 
                              placeholder="0.00"
                              value={rule?.price || ""} 
                              onChange={e => {
                                const newPrice = e.target.value;
                                const otherRules = formData.pricing_rules.filter(r => !(r.basis_type === 'size' && r.reference_id === size.id));
                                setFormData({
                                  ...formData, 
                                  pricing_rules: [...otherRules, { basis_type: 'size', reference_id: size.id, price: newPrice }]
                                });
                              }}
                              className="w-32 rounded-xl border border-slate-200 py-2 pl-7 pr-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" 
                            />
                          </div>
                        </div>
                      )
                    })}
                    {petSizes.length === 0 && <p className="text-xs text-rose-500">No size categories defined. Please add them in MDM first.</p>}
                  </div>
                </div>
              )}

              {formData.pricing_type === 'weight_based' && (
                <div className="mt-4 border-t pt-4 dark:border-dark-border bg-slate-50/50 dark:bg-dark-surface/50 p-3 rounded-xl">
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3">Weight-based Pricing</p>
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                    {weightRanges.map(range => {
                      const rule = formData.pricing_rules.find(r => r.basis_type === 'weight' && r.reference_id === range.id);
                      return (
                        <div key={range.id} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-600 dark:text-zinc-400">{range.label} ({range.min_weight}-{range.max_weight || '∞'} {range.unit})</span>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs text-sm">₱</span>
                            <input 
                              type="number" 
                              required 
                              placeholder="0.00"
                              value={rule?.price || ""} 
                              onChange={e => {
                                const newPrice = e.target.value;
                                const otherRules = formData.pricing_rules.filter(r => !(r.basis_type === 'weight' && r.reference_id === range.id));
                                setFormData({
                                  ...formData, 
                                  pricing_rules: [...otherRules, { basis_type: 'weight', reference_id: range.id, price: newPrice }]
                                });
                              }}
                              className="w-32 rounded-xl border border-slate-200 py-2 pl-7 pr-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" 
                            />
                          </div>
                        </div>
                      )
                    })}
                    {weightRanges.length === 0 && <p className="text-xs text-rose-500">No weight ranges defined. Please add them in MDM first.</p>}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                    <option value="">Select Category</option>
                    {serviceCategories.map(c => (
                      <option key={c.id || c} value={c.name || c}>{c.name || c}</option>
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
