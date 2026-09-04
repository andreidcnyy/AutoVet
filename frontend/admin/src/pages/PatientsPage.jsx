import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AddPatientFormView from "../components/patients/AddPatientFormView";
import PatientRecordsView from "../components/patients/PatientRecordsView";
import PetsListView from "../components/patients/PetsListView";
import EditOwnerModal from "../components/patients/EditOwnerModal";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useNewItems } from "../context/NewItemsContext";
import { PH_LOCATION_DATA } from "../utils/phLocationData";
import { useApi, useQueryClient } from "../hooks/useApi";
import { FiChevronDown, FiUser, FiPhone, FiMail, FiMapPin, FiMap } from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import clsx from "clsx";

function PatientsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState("records");
  const [activeTab, setActiveTab] = useState("owners");
  const { user } = useAuth();
  const { refreshCounts } = useNewItems();
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [ownerToEdit, setOwnerToEdit] = useState(null);
  const [page, setPage] = useState(1);

  // Form States for New Owner Registration
  const [phoneValue, setPhoneValue] = useState("");
  const [province, setProvince] = useState(""); // Province state is correctly declared
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [availableCities, setAvailableCities] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState("All");

  const queryClient = useQueryClient();

  /**
   * Owners list, held in the shared query cache.
   *
   * This was a hand-rolled fetch plus four effects: one to load on mount and on
   * every search or filter change, one to reload when the tab regained focus,
   * one mirroring pagination into a ref so the other two could read it, and one
   * for the websocket. Because nothing cached the result, returning to this page
   * always re-fetched from scratch and rendered a spinner first.
   *
   * The search term, filter and page are part of the key, so changing any of
   * them is a cache lookup rather than a manual re-fetch, and a combination
   * already seen paints immediately while it revalidates behind.
   */
  const ownersQuery = useApi(
    ["owners", { page, search: searchQuery, filter: filterValue }],
    "/api/owners",
    {
      params: {
        page,
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(filterValue && filterValue !== "All" ? { filter: filterValue } : {}),
      },
      enabled: Boolean(user?.token) && activeTab === "owners",
      // Hold the current rows while the next page loads instead of blanking the
      // table, which is what made paging feel like a full reload.
      placeholderData: (previous) => previous,
      staleTime: 60 * 1000,
    }
  );

  const ownersData = ownersQuery.data;
  const owners = ownersData?.data ?? (Array.isArray(ownersData) ? ownersData : []);
  const pagination = ownersData?.data
    ? {
        current_page: ownersData.current_page,
        last_page: ownersData.last_page,
        total: ownersData.total,
      }
    : { current_page: 1, last_page: 1, total: owners.length };
  // Only the very first load blanks the page; a background refresh keeps the
  // existing rows on screen.
  const isLoading = ownersQuery.isLoading;

  useEffect(() => {
    if (ownersQuery.error) {
      console.error("Failed to load owner data:", ownersQuery.error);
      toast.error(ownersQuery.error.message || "Failed to load owner records.");
    }
  }, [ownersQuery.error, toast]);

  /**
   * Kept as a shim so the existing call sites read the same. Moving to a page
   * changes the key; staying put marks the current key stale.
   */
  const fetchOwners = useCallback(
    (nextPage) => {
      if (nextPage && nextPage !== page) setPage(nextPage);
      queryClient.invalidateQueries({ queryKey: ["owners"] });
    },
    [page, queryClient]
  );

  /**
   * Applies a list updater to every cached owners page. Stands in for the old
   * local setOwners so the optimistic updates below still work, but writes to
   * the shared cache so the change survives navigating away and back.
   */
  const patchOwners = useCallback(
    (updater) => {
      queryClient.setQueriesData({ queryKey: ["owners"] }, (current) => {
        if (!current) return current;
        if (Array.isArray(current)) return updater(current);
        if (Array.isArray(current.data)) return { ...current, data: updater(current.data) };
        return current;
      });
    },
    [queryClient]
  );

  // Re-check when the tab regains focus (fallback when WebSocket is unavailable).
  // refetchOnWindowFocus is off globally, so this stays explicit.
  useEffect(() => {
    if (!user?.token) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && activeTab === "owners") {
        queryClient.invalidateQueries({ queryKey: ["owners"] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.token, activeTab, queryClient]);

  // Auto-refresh when portal users create pets or owners
  useEffect(() => {
    if (!user?.token) return;
    let channel;
    import("../utils/echo").then(({ default: echo }) => {
      channel = echo.private("admin.notifications");
      channel.listen(".entity.created", (e) => {
        if (["pet", "owner"].includes(e.entityType)) {
          queryClient.invalidateQueries({ queryKey: ["owners"] });
        }
      });
      channel.listen(".portal.status.changed", (e) => {
        // Patch the cached page in place rather than re-fetching for a single
        // status flag.
        patchOwners((list) =>
          list.map((o) =>
            o.user?.id === e.portalUserId ? { ...o, user: { ...o.user, status: e.status } } : o
          )
        );
      });
    });
    return () => {
      if (channel) {
        channel.stopListening(".entity.created");
        channel.stopListening(".portal.status.changed");
      }
    };
  }, [user?.token, queryClient, patchOwners]);

  useEffect(() => {
    const provinceData = PH_LOCATION_DATA.find(p => p.name === province);
    setAvailableCities(provinceData ? provinceData.cities : []);
    setCity("");
    setZip("");
  }, [province]);

  useEffect(() => {
    const cityData = availableCities.find(c => c.name === city);
    if (cityData) setZip(cityData.zip);
  }, [city, availableCities]);

  const handleSaveNewOwner = (newOwner) => {
    fetchOwners(pagination?.current_page || 1);
    setView("records");
  };

  const handleDeleteOwner = async (ownerId) => {
    // Using a single-line confirm with escaped newline for simplicity and correctness
    if (!window.confirm("Archive: recoverable within 30 days.\nAre you sure you want to archive this owner?")) return;
    try {
      const res = await fetch(`/api/owners/${ownerId}`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP error! status: ${res.status}`);
      }
      patchOwners((prev) => prev.filter((o) => o.id !== ownerId));
      if (selectedOwnerId === ownerId) setSelectedOwnerId(null);
      toast.success("Owner archived successfully.");
    } catch (err) {
      console.error("Failed to delete owner:", err);
      toast.error(err.message || "Could not delete the owner.");
    }
  };

  const handleEditOwner = (owner) => {
    setOwnerToEdit(owner);
    setIsEditModalOpen(true);
  };

  const handleUpdateOwnerSuccess = (updatedOwner) => {
    patchOwners((prev) =>
      prev.map((o) => (o.id === updatedOwner.id ? updatedOwner : o))
    );
    if (selectedOwnerId === updatedOwner.id) {
       setOwnerToEdit(updatedOwner);
    }
  };
  
  const handleAddPetToOwner = (ownerId) => {
    setSelectedOwnerId(ownerId);
    setView("add-pet");
  };

  if (view === "add") {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">Register New Owner</h2>
            <button 
              onClick={() => setView("records")}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300 transition-all"
            >
              Back to List
            </button>
        </div>
        
        <div className="card-shell p-8 max-w-3xl mx-auto border border-zinc-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
           <form onSubmit={async (e) => {
              e.preventDefault();
              if (phoneValue.length !== 11) {
                toast.error("Contact number must be exactly 11 digits.");
                return;
              }
              const formData = new FormData(e.target);
              const data = Object.fromEntries(formData);
              try {
                const res = await fetch("/api/owners", {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": `Bearer ${user?.token}`
                  },
                  body: JSON.stringify({ 
                    ...data, 
                    phone: phoneValue,
                    province,
                    city,
                    zip
                  }),
                });
                if (!res.ok) {
                  const errData = await res.json().catch(() => ({}));
                  throw new Error(errData.message || `HTTP error! status: ${res.status}`);
                }
                const newOwner = await res.json();
                handleSaveNewOwner(newOwner);
                refreshCounts();
                toast.success("Owner registered successfully!");
              } catch (err) {
                toast.error(err.message);
              }
           }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-all-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Full Name *</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input name="name" required className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all" placeholder="e.g. Maria Clara" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input name="email" type="email" className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all" placeholder="email@example.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Contact Number *</label>
                  <div className="flex gap-2">
                    <div className="flex h-12 items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:border-dark-border">
                      🇵🇭 +63
                    </div>
                    <div className="relative flex-1">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input 
                        required 
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value.replace(/\D/g, "").slice(0, 11))}
                        maxLength={11}
                        className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all" 
                        placeholder="09123456789" 
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Street Address *</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input name="address" required className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all" placeholder="123 Street, Brgy..." />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Province *</label>
                  <div className="relative">
                    <select 
                      required 
                      value={province} 
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm focus:bg-white focus:outline-none appearance-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all"
                    >
                      <option value="">Select Province...</option>
                      {PH_LOCATION_DATA.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                  </div>

                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">City / Municipality *</label>
                  <div className="relative">
                    <select 
                      required 
                      disabled={!province}
                      value={city} 
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm focus:bg-white focus:outline-none appearance-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 disabled:opacity-50 transition-all"
                    >
                      <option value="">Select City...</option>
                      {availableCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                  </div>
                </div>

                <div className="w-1/2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">Zip Code (Auto)</label>
                  <div className="relative">
                    <FiMap className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                    <input 
                      readOnly 
                      value={zip}
                      className="w-full h-12 rounded-xl border border-emerald-100 bg-emerald-50/50 pl-10 pr-4 text-sm font-bold text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400 cursor-not-allowed transition-all" 
                      placeholder="Select city..." 
                    />
                  </div>
                </div>

                <div className="md:col-span-2 pt-4">
                  <button type="submit" className="w-full h-14 rounded-2xl bg-emerald-600 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 hover:scale-[1.01] active:scale-[0.98] transition-all">
                    Register New Client
                  </button>
                </div>
              </div>
           </form>
        </div>
      </div>
    );
  }

  if (view === "add-pet") {
    return (
      <div className="p-6">
        <AddPatientFormView
          ownerId={selectedOwnerId}
          onCancel={() => setView("records")}
          onSave={(newPet) => {
            fetchOwners(pagination?.current_page || 1);
            toast.success(`${newPet.name} has been registered!`);
            setView("records");
          }} 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] bg-zinc-50/50 p-6 dark:bg-dark-surface/30 gap-4 overflow-hidden">
      <div className="shrink-0 flex items-center gap-1 w-fit rounded-2xl bg-zinc-100 p-1.5 dark:bg-zinc-800/50 shadow-inner">
        <button
          onClick={() => setActiveTab("owners")}
          className={clsx(
            "flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all",
            activeTab === "owners" 
              ? "bg-white text-emerald-600 shadow-md dark:bg-dark-card dark:text-emerald-400" 
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          <FiUser className="h-4 w-4" />
          Owner Records
        </button>
        <button
          onClick={() => setActiveTab("patients")}
          className={clsx(
            "flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all",
            activeTab === "patients" 
              ? "bg-white text-emerald-600 shadow-md dark:bg-dark-card dark:text-emerald-400" 
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          <LuPawPrint className="h-4 w-4" />
          Pet Directory
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
      {activeTab === "owners" ? (
        <PatientRecordsView
          owners={owners}
          pagination={pagination}
          isLoading={isLoading}
          onPageChange={(page) => fetchOwners(page, searchQuery)}
          onSearch={(q) => { setSearchQuery(q); fetchOwners(1, q, filterValue); }}
          onFilter={(f) => { setFilterValue(f); fetchOwners(1, searchQuery, f); }}
          selectedOwnerId={selectedOwnerId}
          onSelectOwner={setSelectedOwnerId}
          onOpenAddPatient={() => {
            setPhoneValue("");
            setProvince("");
            setCity("");
            setZip("");
            setView("add");
          }}
          onDeleteOwner={handleDeleteOwner}
          onEditOwner={handleEditOwner}
          onOwnerEdited={(updatedOwner) => {
            patchOwners((prev) =>
              prev.map((o) => (o.id === updatedOwner.id ? { ...o, ...updatedOwner } : o))
            );
            if (selectedOwnerId === updatedOwner.id) {
               setOwnerToEdit(updatedOwner);
            }
          }}
          onAddPet={handleAddPetToOwner}
          onRefresh={() => fetchOwners(pagination?.current_page || 1)}
        />
      ) : (
        <PetsListView />
      )}
      </div>

      <EditOwnerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        owner={ownerToEdit}
        onSaveSuccess={handleUpdateOwnerSuccess}
      />
    </div>
  );
}

export default PatientsPage;
