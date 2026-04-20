import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import ViewPatientModal from "./ViewPatientModal";
import clsx from "clsx";
import {
  FiSearch,
  FiFilter,
  FiPlus,
  FiChevronRight,
  FiUser,
  FiActivity,
  FiX,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";

function PetsListView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPets = async () => {
    if (!user?.token) return;
    try {
      const response = await fetch("/api/pets?per_page=100", {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Laravel paginate() returns { data: [...] }
        setPets(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch pets:", error);
      toast.error("Failed to load patient records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPets();
  }, [user?.token]);

  const filteredPets = useMemo(() => {
    return pets.filter(pet => {
      const matchesSearch = 
        pet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pet.owner?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pet.breed?.name && pet.breed.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesSearch;
    });
  }, [pets, searchQuery]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredPets.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPets.slice(indexOfFirstItem, indexOfLastItem);

  const getAge = (dob) => {
    if (!dob) return "N/A";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age + " yrs";
  };

  const handlePetClick = (petId) => {
    setSelectedPetId(petId);
    setIsModalOpen(true);
  };

  const Pagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-6 py-4 dark:border-dark-border dark:bg-dark-card shadow-sm">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Showing <span className="text-zinc-900 dark:text-zinc-50">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredPets.length)}</span> of <span className="text-zinc-900 dark:text-zinc-50">{filteredPets.length}</span> patients
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Patient Directory</h2>
          <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">
            Total of {pets.length} patient records across all clients.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by pet name, breed, or owner..."
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
      </div>

      <Pagination />

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {isLoading ? (
            Array(8).fill(0).map((_, i) => (
                <div key={i} className="card-shell h-64 animate-pulse bg-zinc-100 dark:bg-dark-card/50" />
            ))
        ) : currentItems.length > 0 ? (
            currentItems.map((pet) => (
                <article 
                    key={pet.id} 
                    onClick={() => handlePetClick(pet.id)}
                    className="group relative card-shell overflow-hidden border border-zinc-200 bg-white hover:border-emerald-500/50 hover:shadow-2xl transition-all duration-300 cursor-pointer dark:border-dark-border dark:bg-dark-card"
                >
                    {/* Background Accent */}
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-emerald-50/50 group-hover:scale-150 transition-transform duration-500 dark:bg-emerald-900/10" />
                    
                    <div className="relative p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="relative">
                                <img 
                                    src={pet.photo ? getActualPetImageUrl(pet.photo) : getPetImageUrl(pet.species?.name, pet.breed?.name)} 
                                    alt={pet.name} 
                                    className="h-20 w-20 rounded-2xl object-cover shadow-lg border-2 border-white dark:border-dark-surface" 
                                />
                                <span className={clsx(
                                    "absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-lg text-[10px] shadow-sm",
                                    pet.sex === "Male" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                                )}>
                                    {pet.sex === "Male" ? "♂" : "♀"}
                                </span>
                            </div>
                            <div className="text-right">
                                {/* Status badge removed */}
                            </div>
                        </div>

                        <div className="mt-5 space-y-1">
                            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 group-hover:text-emerald-600 transition-colors truncate" title={pet.name}>
                                {pet.name}
                            </h3>
                            <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 truncate" title={pet.breed?.name || pet.species?.name || "Unknown Breed"}>
                                {pet.breed?.name || pet.species?.name || "Unknown Breed"}
                            </p>
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-zinc-50 pt-4 dark:border-dark-border gap-4">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-50 dark:bg-dark-surface">
                                    <FiUser className="h-4 w-4 text-zinc-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-tighter text-zinc-400 leading-none mb-1">Owner</p>
                                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate" title={pet.owner?.name}>
                                        {pet.owner?.name}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] font-black uppercase tracking-tighter text-zinc-400 leading-none mb-1">Age</p>
                                <p className="text-xs font-black text-emerald-600 whitespace-nowrap">
                                    {getAge(pet.date_of_birth)}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="absolute bottom-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
                            <FiChevronRight className="h-4 w-4" />
                        </div>
                    </div>
                </article>
            ))
        ) : (
            <div className="col-span-full py-20 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-50 dark:bg-dark-surface">
                    <LuPawPrint className="h-10 w-10 text-zinc-200" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">No patients found</h3>
                <p className="text-zinc-500">Try adjusting your filters or search terms.</p>
            </div>
        )}
      </div>

      <Pagination />

      {/* Detail Modal */}
      <ViewPatientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientId={selectedPetId}
        onRefresh={fetchPets}
      />
    </div>
  );
}

export default PetsListView;
