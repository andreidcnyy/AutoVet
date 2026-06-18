import clsx from "clsx";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import {
  FiPhone,
  FiMail,
  FiMapPin,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUser,
  FiEdit2,
  FiChevronRight,
  FiPhoneCall,
  FiX,
  FiAlertTriangle,
  FiShield,
  FiUserCheck,
  FiUserX,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import WarnUserModal from "./WarnUserModal";

const PORTAL_STATUS_STYLE = {
  active:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  suspended:   "bg-amber-100 text-amber-700 border-amber-200",
  deactivated: "bg-rose-100 text-rose-700 border-rose-200",
};

function PatientRecordsView({ 
  owners, 
  pagination, 
  isLoading,
  selectedOwnerId, 
  onSelectOwner, 
  onSearch,
  onFilter,
  onPageChange,
  onOpenAddPatient, 
  onDeleteOwner, 
  onEditOwner, 
  onOwnerEdited,
  onRefresh,
  onAddPet
}) {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [warnOwner, setWarnOwner] = useState(null);
  const canManagePortal = [ROLES.CLINIC_ADMIN, ROLES.VETERINARIAN].includes(user?.role);
  const [portalModal, setPortalModal] = useState(null); // { owner, action }
  const [portalActionLoading, setPortalActionLoading] = useState(false);

  const handlePortalAction = async (portalUserId, action, ownerId) => {
    setPortalActionLoading(true);
    try {
      const res = await fetch(`/api/portal-users/${portalUserId}/${action}`, {
        method: "POST",
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action failed.");
      toast.success(data.message || "Done.");
      onOwnerEdited({ id: ownerId, user: { ...portalModal.owner.user, status: data.status } });
      if (onRefresh) onRefresh();
      setPortalModal(null);
    } catch (err) {
      toast.error(err.message || "Action failed.");
    } finally {
      setPortalActionLoading(false);
    }
  };

  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId) || owners[0] || null;

  useEffect(() => {
    const timer = setTimeout(() => onSearch(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleFilterClick = (f) => {
    setActiveFilter(f);
    onFilter(f);
  };

  return (
    <>
    <div className="flex flex-col h-full gap-5">
      {/* Header */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Patient Owners</h2>
          <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">
            Manage your clients and their pets efficiently.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAddPatient}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <FiPlus className="h-4 w-4" />
            Add New Owner
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="shrink-0 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email, address, city, pet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-10 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-dark-border dark:bg-dark-card shadow-sm">
          {["All", "With Pets"].map((f) => (
            <button
              key={f}
              onClick={() => handleFilterClick(f)}
              className={clsx(
                "rounded-lg px-4 py-1.5 text-sm font-semibold transition-all",
                activeFilter === f
                  ? "bg-zinc-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-950"
                  : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-dark-surface"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 flex-1 min-h-0">
        {/* Main List */}
        <div className="card-shell lg:col-span-8 overflow-hidden border border-zinc-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-xl flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
            <table className="w-full min-w-[600px]">
              <thead className="border-b border-zinc-100 bg-zinc-50/50 dark:border-dark-border dark:bg-dark-surface/50">
                <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  <th className="px-6 py-4">Owner Identity</th>
                  <th className="px-6 py-4">Contact Details</th>
                  <th className="px-6 py-4 text-center">Pets</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={clsx(
                "divide-y divide-zinc-50 dark:divide-dark-border transition-opacity duration-200",
                isLoading && owners.length > 0 && "opacity-50 pointer-events-none"
              )}>
                {isLoading && owners.length === 0 ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-5"><div className="h-12 rounded-xl bg-zinc-100 animate-pulse dark:bg-dark-surface" /></td>
                      <td className="px-6 py-5"><div className="h-8 rounded-xl bg-zinc-100 animate-pulse dark:bg-dark-surface" /></td>
                      <td className="px-6 py-5"><div className="h-7 w-7 mx-auto rounded-lg bg-zinc-100 animate-pulse dark:bg-dark-surface" /></td>
                      <td className="px-6 py-5"><div className="h-8 w-16 ml-auto rounded-lg bg-zinc-100 animate-pulse dark:bg-dark-surface" /></td>
                    </tr>
                  ))
                ) : owners.length > 0 ? owners.map((owner) => (
                  <tr
                    key={owner.id}
                    onClick={() => onSelectOwner(owner.id)}
                    className={clsx(
                      "group cursor-pointer transition-all duration-200 hover:bg-zinc-50/80 dark:hover:bg-dark-surface/40",
                      selectedOwnerId === owner.id ? "bg-emerald-50/60 dark:bg-emerald-900/10 ring-1 ring-inset ring-emerald-500/20" : ""
                    )}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 text-lg shadow-sm group-hover:scale-105 transition-transform dark:from-zinc-800 dark:to-zinc-900">
                          👤
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{owner.name}</p>
                          <p className="max-w-[200px] truncate text-xs text-zinc-500 dark:text-zinc-500">
                            <FiMapPin className="inline mr-1 h-3 w-3" />
                            {owner.address || "No address provided"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <div className="space-y-1">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            <FiPhoneCall className="h-3 w-3 text-emerald-500" />
                            {owner.phone || "—"}
                          </p>
                          <p className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                            <FiMail className="h-3 w-3" />
                            {owner.email || "—"}
                          </p>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-emerald-100 px-2 text-[11px] font-black text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-300">
                          {owner.pets?.length || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditOwner(owner); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white hover:text-emerald-600 hover:shadow-md dark:hover:bg-dark-surface"
                          title="Edit owner"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setWarnOwner(owner); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white hover:text-amber-500 hover:shadow-md dark:hover:bg-dark-surface"
                          title="Send warning"
                        >
                          <FiAlertTriangle className="h-4 w-4" />
                        </button>
                        {owner.user && (
                          <span className={clsx(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase border select-none",
                            owner.user.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700/30 dark:text-emerald-400" :
                            owner.user.status === "suspended" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/30 dark:text-amber-400" :
                            "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:border-rose-700/30 dark:text-rose-400"
                          )}>
                            <span className={clsx("h-1.5 w-1.5 rounded-full shrink-0",
                              owner.user.status === "active" ? "bg-emerald-500" :
                              owner.user.status === "suspended" ? "bg-amber-500" : "bg-rose-500"
                            )} />
                            {owner.user.status}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteOwner(owner.id); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white hover:text-rose-600 hover:shadow-md dark:hover:bg-dark-surface"
                          title="Delete owner"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="py-20 text-center">
                      <div className="flex flex-col items-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-50 dark:bg-dark-surface">
                          <FiUser className="h-8 w-8 text-zinc-200" />
                        </div>
                        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">No owners found</p>
                        <p className="text-sm text-zinc-500">Try adjusting your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {pagination.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/30">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Showing Page <span className="text-zinc-900 dark:text-zinc-50">{pagination.current_page}</span> of <span className="text-zinc-900 dark:text-zinc-50">{pagination.last_page}</span> ({pagination.total} total)
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(Math.max(pagination.current_page - 1, 1))}
                  disabled={pagination.current_page === 1}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <button
                  onClick={() => onPageChange(Math.min(pagination.current_page + 1, pagination.last_page))}
                  disabled={pagination.current_page === pagination.last_page}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Sidebar */}
        <div className="lg:col-span-4 overflow-y-auto">
          {selectedOwner ? (
            <div className="card-shell overflow-hidden border border-zinc-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-2xl">
               {/* Header Gradient */}
               <div className="h-32 bg-gradient-to-br from-emerald-600 to-indigo-700 p-6 relative">
                  <div className="absolute -bottom-6 left-6">
                     <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-4xl shadow-xl dark:bg-dark-surface border-4 border-white dark:border-dark-card">
                       👤
                     </div>
                  </div>
                  <div className="absolute top-6 right-6 flex gap-2">
                    <button 
                       onClick={() => onEditOwner(selectedOwner)}
                       className="rounded-lg bg-white/20 p-2 text-white backdrop-blur-md hover:bg-white/30 transition-colors"
                     >
                       <FiEdit2 className="h-4 w-4" />
                    </button>
                  </div>
               </div>

               {/* Owner Info */}
               <div className="p-6 pt-10">
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{selectedOwner.name}</h3>
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">Owner ID: #{selectedOwner.id}</p>
                  
                  <div className="mt-8 space-y-4">
                     <div className="flex items-center gap-4 group">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 group-hover:bg-emerald-50 transition-colors dark:bg-dark-surface">
                          <FiPhone className="h-4 w-4 text-zinc-400 group-hover:text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Phone Number</p>
                           <p className="font-bold text-zinc-700 dark:text-zinc-200">{selectedOwner.phone || "Not provided"}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4 group">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 group-hover:bg-emerald-50 transition-colors dark:bg-dark-surface">
                          <FiMail className="h-4 w-4 text-zinc-400 group-hover:text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Email Address</p>
                           <p className="font-bold text-zinc-700 truncate dark:text-zinc-200">{selectedOwner.email || "Not provided"}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-4 group">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 group-hover:bg-emerald-50 transition-colors dark:bg-dark-surface">
                          <FiMapPin className="h-4 w-4 text-zinc-400 group-hover:text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Permanent Address</p>
                           <p className="font-bold text-zinc-700 dark:text-zinc-200 leading-snug">
                            {selectedOwner.address ? `${selectedOwner.address}, ${selectedOwner.city} ${selectedOwner.zip || ''}` : "No address recorded"}
                           </p>
                        </div>
                     </div>
                  </div>

                  {/* Pets Section */}
                  <div className="mt-10 border-t border-zinc-100 pt-8 dark:border-dark-border">                     <div className="mb-6 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-400">
                          <LuPawPrint className="h-4 w-4" />
                          Pets ({selectedOwner.pets?.length || 0})
                        </h4>
                        <button 
                          onClick={() => onAddPet(selectedOwner.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-100 transition-colors dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                        >
                          <FiPlus className="h-3 w-3" /> Add Pet
                        </button>
                     </div>
                     
                     <div className="space-y-3">
                        {selectedOwner.pets?.length > 0 ? selectedOwner.pets.map(pet => (
                          <div 
                            key={pet.id} 
                            onClick={() => navigate(`/patients/${pet.id}`)}
                            className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/30 p-4 hover:border-emerald-500/30 hover:bg-white hover:shadow-xl hover:shadow-emerald-500/5 transition-all cursor-pointer dark:border-dark-border dark:bg-dark-surface/30 dark:hover:border-emerald-500/40"
                          >
                             <img 
                                src={pet.photo ? getActualPetImageUrl(pet.photo) : getPetImageUrl(pet.species?.name, pet.breed?.name)} 
                                alt={pet.name} 
                                className="h-14 w-14 rounded-xl object-cover shadow-sm bg-white dark:bg-dark-card" 
                             />
                             <div className="min-w-0 flex-1">
                                <p className="font-black text-zinc-900 dark:text-zinc-50">{pet.name}</p>
                                {pet.breed?.name && <p className="text-xs font-bold text-zinc-500 dark:text-zinc-500">{pet.breed.name}</p>}
                             </div>
                             <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-300 shadow-sm dark:bg-dark-card">
                                <FiChevronRight className="h-4 w-4" />
                             </div>
                          </div>
                        )) : (
                          <div className="rounded-2xl border-2 border-dashed border-zinc-100 p-8 text-center dark:border-zinc-800">
                             <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-200 dark:bg-dark-surface">
                               <LuPawPrint className="h-6 w-6" />
                             </div>
                             <p className="text-sm font-bold text-zinc-400">No pets recorded</p>
                          </div>
                        )}
                     </div>

                     <button
                        onClick={() => navigate(`/appointments`)}
                        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-sm font-black text-white shadow-xl shadow-zinc-900/20 hover:scale-[1.02] transition-transform active:scale-95 dark:bg-zinc-100 dark:text-zinc-950 dark:shadow-none"
                      >
                        Book Unified Appointment
                      </button>
                  </div>

                  {/* Portal Account — admin & vet only */}
                  {canManagePortal && <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-dark-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-400">
                        <FiShield className="h-4 w-4" /> Portal Account
                      </h4>
                      {selectedOwner.user && (
                        <span className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border", PORTAL_STATUS_STYLE[selectedOwner.user.status] || PORTAL_STATUS_STYLE.active)}>
                          {selectedOwner.user.status}
                        </span>
                      )}
                    </div>
                    {selectedOwner.user ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedOwner.user.status === "active" && (
                          <>
                            <button onClick={() => setPortalModal({ owner: selectedOwner, action: "suspend" })} className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase text-amber-700 hover:bg-amber-100 transition-colors dark:bg-amber-900/20 dark:border-amber-700/30 dark:text-amber-400">
                              <FiUserX className="h-3.5 w-3.5" /> Suspend
                            </button>
                            <button onClick={() => setPortalModal({ owner: selectedOwner, action: "deactivate" })} className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black uppercase text-rose-700 hover:bg-rose-100 transition-colors dark:bg-rose-900/20 dark:border-rose-700/30 dark:text-rose-400">
                              <FiUserX className="h-3.5 w-3.5" /> Deactivate
                            </button>
                          </>
                        )}
                        {selectedOwner.user.status === "suspended" && (
                          <>
                            <button onClick={() => setPortalModal({ owner: selectedOwner, action: "reactivate" })} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-900/20 dark:border-emerald-700/30 dark:text-emerald-400">
                              <FiUserCheck className="h-3.5 w-3.5" /> Reactivate
                            </button>
                            <button onClick={() => setPortalModal({ owner: selectedOwner, action: "deactivate" })} className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black uppercase text-rose-700 hover:bg-rose-100 transition-colors dark:bg-rose-900/20 dark:border-rose-700/30 dark:text-rose-400">
                              <FiUserX className="h-3.5 w-3.5" /> Deactivate
                            </button>
                          </>
                        )}
                        {selectedOwner.user.status === "deactivated" && (
                          <button onClick={() => setPortalModal({ owner: selectedOwner, action: "reactivate" })} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-900/20 dark:border-emerald-700/30 dark:text-emerald-400">
                            <FiUserCheck className="h-3.5 w-3.5" /> Reactivate
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 font-bold">No portal account linked.</p>
                    )}
                  </div>}
               </div>
            </div>
          ) : (
            <div className="flex h-[600px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-100 p-12 text-center dark:border-zinc-800 shadow-inner">
               <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-zinc-50 text-4xl dark:bg-dark-surface shadow-2xl">
                 🔍
               </div>
               <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Select an Owner</h3>
               <p className="mt-2 text-sm font-medium text-zinc-400 max-w-[200px]">Choose a client from the list to view their details and pets.</p>
            </div>
          )}
        </div>
      </div>
    </div>

    {warnOwner && (
      <WarnUserModal
        owner={warnOwner}
        onClose={() => setWarnOwner(null)}
        onSent={() => setWarnOwner(null)}
      />
    )}

    {/* Portal account action confirmation modal */}
    {portalModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-dark-card p-8 shadow-2xl">
          <div className={clsx("flex items-center gap-3 mb-4",
            portalModal.action === "reactivate" ? "text-emerald-600" :
            portalModal.action === "suspend" ? "text-amber-600" : "text-rose-600"
          )}>
            {portalModal.action === "reactivate" ? <FiUserCheck className="h-6 w-6" /> : <FiUserX className="h-6 w-6" />}
            <h3 className="text-lg font-black capitalize">{portalModal.action} Portal Account</h3>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 font-bold">{portalModal.owner.name}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
            {portalModal.action === "suspend" && "This will temporarily block this client from logging into the portal. You can reactivate at any time."}
            {portalModal.action === "deactivate" && "This will block this client from logging into the portal until reactivated by an admin."}
            {portalModal.action === "reactivate" && "This will restore portal login access for this client."}
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setPortalModal(null)} disabled={portalActionLoading} className="px-5 py-2.5 font-bold text-zinc-500 hover:text-zinc-700 disabled:opacity-50">Cancel</button>
            <button
              onClick={() => handlePortalAction(portalModal.owner.user.id, portalModal.action, portalModal.owner.id)}
              disabled={portalActionLoading}
              className={clsx("px-5 py-2.5 rounded-xl font-black text-white transition-all disabled:opacity-50 capitalize",
                portalModal.action === "reactivate" ? "bg-emerald-600 hover:bg-emerald-700" :
                portalModal.action === "suspend" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {portalActionLoading ? "Processing..." : `Confirm ${portalModal.action}`}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default PatientRecordsView;
