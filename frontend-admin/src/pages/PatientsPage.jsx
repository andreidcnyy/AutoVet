import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AddPatientFormView from "../components/patients/AddPatientFormView";
import PatientRecordsView from "../components/patients/PatientRecordsView";
import PetsListView from "../components/patients/PetsListView";
import EditOwnerModal from "../components/patients/EditOwnerModal";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { PH_LOCATION_DATA } from "../utils/phLocationData";
import { FiChevronDown, FiUser, FiPhone, FiMail, FiMapPin, FiMap } from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import clsx from "clsx";

function PatientsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState("records"); // "records", "add", "add-pet"
  const [activeTab, setActiveTab] = useState("owners"); // "owners", "patients"
  const { user } = useAuth();
  const [owners, setOwners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [ownerToEdit, setOwnerToEdit] = useState(null);
  
  // Form States for "Register New Owner" view
  const [phoneValue, setPhoneValue] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [availableCities, setAvailableCities] = useState([]);

  const fetchOwners = () => {
    setIsLoading(true);
    fetch("/api/owners", {
      headers: { 
        "Accept": "application/json",
        "Authorization": `Bearer ${user?.token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        setOwners(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load owner data:", err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (user?.token) {
      fetchOwners();
    }
  }, [user?.token]);

  // Sync cities when province changes
  useEffect(() => {
    const provinceData = PH_LOCATION_DATA.find(p => p.name === province);
    setAvailableCities(provinceData ? provinceData.cities : []);
    setCity("");
    setZip("");
  }, [province]);

  // Sync zip when city changes
  useEffect(() => {
    const cityData = availableCities.find(c => c.name === city);
    if (cityData) {
      setZip(cityData.zip);
    }
  }, [city, availableCities]);

  const handleSaveNewOwner = (newOwner) => {
    setOwners((prev) => [newOwner, ...prev]);
    setSelectedOwnerId(newOwner.id);
    setView("records");
  };

  const handleDeleteOwner = async (ownerId) => {
    if (!window.confirm("Archive: recoverable within 30 days.\nAre you sure you want to archive this owner?")) return;
    try {
      await fetch(`/api/owners/${ownerId}`, { 
        method: "DELETE",
        headers: { 
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      setOwners((prev) => prev.filter((o) => o.id !== ownerId));
      setSelectedOwnerId(null);
      toast.success("Owner archived successfully.");
    } catch (err) {
      console.error("Failed to delete owner:", err);
      toast.error("Could not delete the owner.");
    }
  };

  const handleEditOwner = (owner) => {
    setOwnerToEdit(owner);
    setIsEditModalOpen(true);
  };

  const handleUpdateOwnerSuccess = (updatedOwner) => {
    setOwners((prev) =>
      prev.map((o) => (o.id === updatedOwner.id ? updatedOwner : o))
    );
    setSelectedOwnerId(updatedOwner.id);
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
                  throw new Error(errData.message || "Failed to create owner");
                }
                const newOwner = await res.json();
                setOwners((prev) => [newOwner, ...prev]);
                setView("records");
                setSelectedOwnerId(newOwner.id);
                toast.success("Owner registered successfully!");
              } catch (err) {
                toast.error(err.message);
              }
           }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Full Name *</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input name="name" required className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all" placeholder="e.g. Maria Clara" />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input name="email" type="email" className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all" placeholder="email@example.com" />
                  </div>
                </div>

                {/* Contact Number */}
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

                {/* Street Address */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Street Address *</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input name="address" required className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:border-emerald-400 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all" placeholder="123 Street, Brgy..." />
                  </div>
                </div>

                {/* Province Dropdown */}
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

                {/* City Dropdown */}
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

                {/* Zip Code (Auto) */}
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
            setOwners(owners.map(o => o.id === selectedOwnerId ? { ...o, pets: [...(o.pets || []), newPet] } : o));
            toast.success(`${newPet.name} has been registered!`);
            if (newPet?.id) {
              navigate(`/patients/${newPet.id}`);
            } else {
              setView("records");
            }
          }} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 p-6 dark:bg-dark-surface/30 space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 w-fit rounded-2xl bg-zinc-100 p-1.5 dark:bg-zinc-800/50 shadow-inner">
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
          Patient Directory
        </button>
      </div>

      {activeTab === "owners" ? (
        <>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-zinc-500">
                Loading owner records...
            </div>
          ) : (
            <PatientRecordsView
                owners={owners}
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
                onOwnerEdited={fetchOwners}
                onAddPet={handleAddPetToOwner}
            />
          )}
        </>
      ) : (
        <PetsListView />
      )}

      <EditOwnerModal 
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setOwnerToEdit(null);
        }}
        owner={ownerToEdit}
        onSaveSuccess={handleUpdateOwnerSuccess}
      />
    </div>
  );
}

export default PatientsPage;
