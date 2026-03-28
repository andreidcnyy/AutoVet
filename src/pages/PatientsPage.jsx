import { useState, useEffect } from "react";
import AddPatientFormView from "../components/patients/AddPatientFormView";
import PatientRecordsView from "../components/patients/PatientRecordsView";
import EditOwnerModal from "../components/patients/EditOwnerModal";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

function PatientsPage() {
  const toast = useToast();
  const [view, setView] = useState("records");
  const { user } = useAuth();
  const [owners, setOwners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [ownerToEdit, setOwnerToEdit] = useState(null);

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

  const handleSaveNewOwner = (newOwner) => {
    setOwners((prev) => [newOwner, ...prev]);
    setSelectedOwnerId(newOwner.id);
    setView("records");
  };

  const handleDeleteOwner = async (ownerId) => {
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
      toast.success("Owner deleted successfully.");
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
            <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-50">Register New Owner</h2>
            <button 
              onClick={() => setView("records")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-card dark:text-zinc-300"
            >
              Back to List
            </button>
        </div>
        
        <div className="card-shell p-8 max-w-2xl mx-auto border border-slate-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-2xl">
           <form onSubmit={async (e) => {
              e.preventDefault();
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
                  body: JSON.stringify(data),
                });
                if (!res.ok) throw new Error("Failed to create owner");
                const newOwner = await res.json();
                setOwners((prev) => [...prev, { ...newOwner, pets: [] }]);
                setView("records");
                setSelectedOwnerId(newOwner.id);
                toast.success("Owner registered successfully!");
              } catch (err) {
                toast.error(err.message);
              }
           }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Full Name</label>
                  <input name="name" required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200" placeholder="e.g. Maria Clara" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Phone *</label>
                  <input 
                    name="phone" 
                    required 
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200" 
                    placeholder="09XXXXXXXXX or +639XXXXXXXXX" 
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/[^0-9+]/g, '');
                      if (e.target.value.includes('+') && e.target.value.indexOf('+') !== 0) {
                        e.target.value = e.target.value.replace(/\+/g, '');
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Email</label>
                  <input name="email" type="email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200" placeholder="email@example.com" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Address</label>
                  <input name="address" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200" placeholder="123 Street..." />
                </div>
                <div className="col-span-2">
                  <button type="submit" className="w-full rounded-xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-colors">
                    Register Client
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
            setView("records");
            toast.success(`${newPet.name} has been registered!`);
          }} 
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        Loading owner records...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 dark:bg-dark-surface/30">
      <PatientRecordsView
        owners={owners}
        selectedOwnerId={selectedOwnerId}
        onSelectOwner={setSelectedOwnerId}
        onOpenAddPatient={() => setView("add")}
        onDeleteOwner={handleDeleteOwner}
        onEditOwner={handleEditOwner}
        onOwnerEdited={fetchOwners}
        onAddPet={handleAddPetToOwner}
      />

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
