import clsx from "clsx";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
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
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";

function PatientRecordsView({ owners, selectedOwnerId, onSelectOwner, onOpenAddPatient, onDeleteOwner, onEditOwner, onOwnerEdited, onAddPet }) {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchValue, setSearchValue] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const ownersPerPage = 10;

  const filteredOwners = useMemo(() => {
    const search = searchValue.trim().toLowerCase();

    return owners.filter((owner) => {
      const matchesSearch =
        !search ||
        owner.name.toLowerCase().includes(search) ||
        owner.phone?.toLowerCase().includes(search) ||
        owner.email?.toLowerCase().includes(search);

      const hasPets = (owner.pets?.length || 0) > 0;
      const matchesFilter = 
        activeFilter === "All" ? true :
        activeFilter === "With Pets" ? hasPets :
        !hasPets;

      return matchesSearch && matchesFilter;
    });
  }, [owners, searchValue, activeFilter]);

  // Pagination Logic
  const indexOfLastOwner = currentPage * ownersPerPage;
  const indexOfFirstOwner = indexOfLastOwner - ownersPerPage;
  const currentOwners = filteredOwners.slice(indexOfFirstOwner, indexOfLastOwner);
  const totalPages = Math.ceil(filteredOwners.length / ownersPerPage);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, activeFilter]);

  const selectedOwner = filteredOwners.find((owner) => owner.id === selectedOwnerId) || currentOwners[0] || null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Pet Owners</h2>
          <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">
            Manage {owners.length} clients and {owners.reduce((sum, owner) => sum + (owner.pets?.length || 0), 0)} pets.
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
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search owners by name, phone, or email..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
        <div className="flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-dark-border dark:bg-dark-card shadow-sm">
          {["All", "With Pets"].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main List */}
        <div className="card-shell lg:col-span-8 overflow-hidden border border-zinc-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="border-b border-zinc-100 bg-zinc-50/50 dark:border-dark-border dark:bg-dark-surface/50">
                <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  <th className="px-6 py-4">Owner Identity</th>
                  <th className="px-6 py-4">Contact Details</th>
                  <th className="px-6 py-4 text-center">Pets</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-dark-border">
                {currentOwners.length > 0 ? currentOwners.map((owner) => (
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
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteOwner(owner.id); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white hover:text-rose-600 hover:shadow-md dark:hover:bg-dark-surface"
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-dark-border dark:bg-dark-surface/30">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Showing <span className="text-zinc-900 dark:text-zinc-50">{indexOfFirstOwner + 1}-{Math.min(indexOfLastOwner, filteredOwners.length)}</span> of <span className="text-zinc-900 dark:text-zinc-50">{filteredOwners.length}</span> clients
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface shadow-sm"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="flex items-center gap-1.5">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={clsx(
                        "flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black transition-all",
                        currentPage === i + 1
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-110"
                          : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
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
        <div className="lg:col-span-4 space-y-6">
          {selectedOwner ? (
            <div className="card-shell sticky top-24 overflow-hidden border border-zinc-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-2xl">
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
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">Client ID: #{selectedOwner.id}</p>
                  
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

                  {/* Web Portal Section */}
                  <div className="mt-8 border-t border-zinc-100 pt-8 dark:border-dark-border">
                    <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">
                      🌐 Web Portal Account
                    </h4>
                    {selectedOwner.user ? (
                      <div className="rounded-2xl bg-emerald-50/50 p-4 border border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tighter">Status: {selectedOwner.user.status || 'Active'}</p>
                            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mt-0.5">{selectedOwner.user.email}</p>
                          </div>
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-zinc-50/50 p-4 border border-zinc-100 dark:bg-dark-surface dark:border-dark-border">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">No portal account linked</p>
                        <p className="text-[10px] text-zinc-400 mt-1 italic">Client cannot login to web portal.</p>
                      </div>
                    )}
                  </div>

                  {/* Pets Section */}
                  <div className="mt-10 border-t border-zinc-100 pt-8 dark:border-dark-border">
                     <div className="mb-6 flex items-center justify-between">
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
                                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-500">{pet.species?.name} • {pet.breed?.name}</p>
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
                        onClick={() => navigate(`/appointments`)} // Contextual booking could go here
                        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-sm font-black text-white shadow-xl shadow-zinc-900/20 hover:scale-[1.02] transition-transform active:scale-95 dark:bg-zinc-100 dark:text-zinc-950 dark:shadow-none"
                      >
                        Book Unified Appointment
                      </button>
                  </div>
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
  );
}

export default PatientRecordsView;
