import clsx from "clsx";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiTrash2, FiPlus, FiEdit2, FiX, FiSave } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import echo from "../../utils/echo";

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
    requires_doctor: false,
    status: "Active",
    pricing_type: "fixed",
    measurement_basis: "none",
    base_price: 0,
    pricing_rules: []
  });

  const SERVICES_CACHE_KEY = 'settings_services_cache';
  const SVC_FORM_CACHE_KEY = 'settings_svc_form_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  const fetchServices = (signal) => {
    if (!user?.token) { setLoading(false); return; }

    let hasCache = false;
    try {
      const cached = JSON.parse(localStorage.getItem(SERVICES_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.data)) {
        setServices(cached.data);
        setLoading(false);
        hasCache = true;
      }
    } catch (_) {}
    if (!hasCache) setLoading(true);

    fetch("/api/services", {
      signal,
      headers: { "Accept": "application/json", "Authorization": `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setServices(normalized);
        try { localStorage.setItem(SERVICES_CACHE_KEY, JSON.stringify({ data: normalized, ts: Date.now() })); } catch (_) {}
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        toast.error("Failed to load services");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user?.token) return;

    // Show cached form dropdowns instantly
    try {
      const cached = JSON.parse(localStorage.getItem(SVC_FORM_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        if (Array.isArray(cached.categories)) setServiceCategories(cached.categories);
        if (Array.isArray(cached.sizes)) setPetSizes(cached.sizes);
        if (Array.isArray(cached.ranges)) setWeightRanges(cached.ranges);
      }
    } catch (_) {}

    const controller = new AbortController();
    fetchServices(controller.signal);

    const headers = { "Accept": "application/json", "Authorization": `Bearer ${user.token}` };

    Promise.all([
      fetch("/api/service-categories", { signal: controller.signal, headers }).then(r => r.json()).catch(() => []),
      fetch("/api/pet-size-categories?per_page=100", { signal: controller.signal, headers }).then(r => r.json()).catch(() => []),
      fetch("/api/weight-ranges?per_page=200", { signal: controller.signal, headers }).then(r => r.json()).catch(() => []),
    ]).then(([catsRaw, sizesRaw, rangesRaw]) => {
      const categories = Array.isArray(catsRaw?.data) ? catsRaw.data : (Array.isArray(catsRaw) ? catsRaw : []);
      const sizesList = Array.isArray(sizesRaw?.data) ? sizesRaw.data : (Array.isArray(sizesRaw) ? sizesRaw : []);
      const sizes = [...sizesList].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const ranges = Array.isArray(rangesRaw?.data) ? rangesRaw.data : (Array.isArray(rangesRaw) ? rangesRaw : []);

      setServiceCategories(categories);
      setPetSizes(sizes);
      setWeightRanges(ranges);

      try { localStorage.setItem(SVC_FORM_CACHE_KEY, JSON.stringify({ categories, sizes, ranges, ts: Date.now() })); } catch (_) {}
    }).catch(err => {
      if (err.name === 'AbortError') return;
      console.error(err);
    });

    const onVisible = () => { if (document.visibilityState === 'visible') fetchServices(); };
    document.addEventListener('visibilitychange', onVisible);

    // Real-time: refresh when any service/category changes elsewhere.
    const rtChannel = echo.private('admin.notifications');
    rtChannel.listen('.entity.created', () => fetchServices());

    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', onVisible);
      try { rtChannel.stopListening('.entity.created'); } catch (_) {}
    };
  }, [user?.token]);

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || "",
        price: service.price,
        category: service.category || "",
        requires_doctor: service.requires_doctor || false,
        status: service.status,
        pricing_type: service.pricing_type || "fixed",
        measurement_basis: service.measurement_basis || "none",
        base_price: service.base_price || service.price || 0,
        // The API serialises the relation under its camelCase method name, so
        // reading pricing_rules always found undefined and every size price
        // opened blank — and, being required inputs, had to be retyped before
        // the service could be saved at all. reference_id is normalised to a
        // number so it matches the size ids these rows are looked up by.
        pricing_rules: (service.pricingRules || service.pricing_rules || []).map(r => ({
          basis_type: r.basis_type,
          reference_id: Number(r.reference_id),
          price: r.price,
        })),
      });
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        description: "",
        price: 0,
        category: "",
        requires_doctor: false,
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
    // NEW: Both size_based and weight_based now use 'size' basis categories
    let cleanedRules = [];
    if (formData.pricing_type === 'size_based' || formData.pricing_type === 'weight_based') {
      cleanedRules = formData.pricing_rules.filter(r => r.basis_type === 'size');
    }

    const payload = { 
      ...formData, 
      // Ensure we send numbers, and fallback to 0 if empty
      price: Number(formData.base_price ?? formData.price ?? 0),
      base_price: Number(formData.base_price ?? 0),
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
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Failed to save service");
      }
      
      toast.success(isEditing ? "Service updated" : "Service created");
      fetchServices();
      handleCloseModal();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Archive: recoverable within 30 days.\nAre you sure you want to archive this service?")) return;
    try {
      const res = await fetch(`/api/services/${id}`, { 
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      if (!res.ok) throw new Error("Failed to archive");
      toast.success("Service archived");
      fetchServices();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="p-6 text-zinc-500">Loading services...</div>;

  return (
    <section className="card-shell p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Service Management</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage invoice services and fixed prices.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
          <FiPlus className="h-4 w-4" />
          Add New Service
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Service Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Pricing Mode</th>
              <th className="px-4 py-3">Base Price</th>
              <th className="px-4 py-3">Requires Doctor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.id} className="border-b border-zinc-200/80 dark:border-dark-border">
                <td className="px-4 py-4">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{svc.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">{svc.description}</p>
                </td>
                <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">{svc.category || "-"}</td>
                <td className="px-4 py-4">
                  <span className="capitalize text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-dark-surface px-2 py-1 rounded">
                    {svc.pricing_type?.replace('_', ' ') || 'Fixed'}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">₱{Number(svc.base_price || svc.price).toFixed(2)}</td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                      svc.requires_doctor
                        ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:text-sky-400"
                        : "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-dark-border dark:text-zinc-400"
                    )}
                  >
                    {svc.requires_doctor ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                      svc.status === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400"
                    )}
                  >
                    {svc.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenModal(svc)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface hover:bg-zinc-100">
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
                <td colSpan="5" className="px-4 py-8 text-center text-sm text-zinc-500">No services found. Add one to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && createPortal(
        /* Rendered straight into the body, on the same overlay the inventory
           modals use. Left in the settings tree it sat under whatever the page
           layout did around it, and a "fixed" overlay is only the viewport
           while no ancestor has a transform, filter or containment of its own.
           my-auto inside a scrollable overlay keeps it centred when it fits and
           lets it scroll when it does not. */
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-zinc-950/50 p-4 backdrop-blur-sm">
          <div className="my-auto flex w-full max-w-md flex-col max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-dark-card border dark:border-dark-border">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-dark-border">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{editingService ? "Edit Service" : "Add Service"}</h3>
              <button onClick={handleCloseModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><FiX size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Service Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Pricing Type</label>
                  <select 
                    value={formData.pricing_type} 
                    onChange={e => {
                      const type = e.target.value;
                      let basis = 'none';
                      if (type === 'size_based') basis = 'size';
                      if (type === 'weight_based') basis = 'weight';
                      setFormData({...formData, pricing_type: type, measurement_basis: basis});
                    }}
                    className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="size_based">Size Based</option>
                    <option value="weight_based">Weight Based</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Base Price (₱) *</label>
                  <input required min="0" step="0.01" type="number" value={formData.base_price || formData.price} onChange={e => setFormData({...formData, base_price: e.target.value, price: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                </div>
              </div>

              {formData.pricing_type === 'size_based' && (
                <div className="mt-4 border-t pt-4 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/50 p-3 rounded-xl">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Size-based Pricing</p>
                  <div className="space-y-3">
                    {petSizes.map(size => {
                      const rule = formData.pricing_rules.find(r => r.basis_type === 'size' && r.reference_id === size.id);
                      return (
                        <div key={size.id} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{size.name}</span>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 text-xs text-sm">₱</span>
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
                              className="w-32 rounded-xl border border-zinc-200 py-2 pl-7 pr-3 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" 
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
                <div className="mt-4 border-t pt-4 dark:border-dark-border bg-zinc-50/50 dark:bg-dark-surface/50 p-3 rounded-xl">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Weight-based Pricing</p>
                  <p className="text-[10px] text-zinc-500 mb-3 italic">Prices are set per size category. Weights are auto-mapped based on species.</p>
                  <div className="space-y-3">
                    {petSizes.map(size => {
                      const rule = formData.pricing_rules.find(r => r.basis_type === 'size' && r.reference_id === size.id);
                      return (
                        <div key={size.id} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{size.name}</span>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 text-xs">₱</span>
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
                              className="w-32 rounded-xl border border-zinc-200 py-2 pl-7 pr-3 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" 
                            />
                          </div>
                        </div>
                      )
                    })}
                    {petSizes.length === 0 && <p className="text-xs text-rose-500 text-center py-2">No size categories defined.</p>}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                    <option value="">Select Category</option>
                    {serviceCategories.map(c => (
                      <option key={c.id || c} value={c.name || c}>{c.name || c}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Requires Doctor toggle */}
              <label className="flex items-center justify-between gap-3 cursor-pointer rounded-xl border border-zinc-200 dark:border-dark-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Requires a Doctor</p>
                  <p className="text-xs text-zinc-400 mt-0.5">When enabled, clients must choose a preferred doctor when booking this service.</p>
                </div>
                <div className="relative shrink-0">
                  <input type="checkbox" className="sr-only" checked={formData.requires_doctor} onChange={e => setFormData({...formData, requires_doctor: e.target.checked})} />
                  <div className={clsx("w-10 h-6 rounded-full transition-colors", formData.requires_doctor ? "bg-sky-500" : "bg-zinc-300 dark:bg-zinc-600")} />
                  <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", formData.requires_doctor ? "left-5" : "left-1")} />
                </div>
              </label>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-zinc-200 px-6 py-4 dark:border-dark-border">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 font-semibold text-zinc-600 hover:text-zinc-800 dark:text-zinc-300">Cancel</button>
                <button type="submit" className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"><FiSave/> Save</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
