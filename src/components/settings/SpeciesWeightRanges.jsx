import { useState, useEffect } from "react";
import MasterDataTable from "./MasterDataTable";
import { FiChevronRight } from "react-icons/fi";

export default function SpeciesWeightRanges() {
  const [species, setSpecies] = useState([]);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecies();
  }, []);

  const fetchSpecies = async () => {
    try {
      const res = await fetch("/api/species");
      if (res.ok) {
        const data = await res.json();
        setSpecies(data);
        if (data.length > 0 && !selectedSpecies) {
          setSelectedSpecies(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const weightRangeColumns = [
    { key: "label", label: "Label" },
    { key: "min_weight", label: "Min (kg)" },
    { key: "max_weight", label: "Max (kg)", render: (val) => val === null || val === "" ? "∞" : val },
    { 
      key: "size_category_id", 
      label: "Size Category",
      render: (val, item) => (
        <span className="font-medium text-blue-600 dark:text-blue-400">
          {item.size_category?.name || "Unlinked"}
        </span>
      )
    },
    { 
      key: "status", 
      label: "Status",
      render: (val) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          val === 'Active' 
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
            : 'bg-slate-100 text-slate-600 dark:bg-dark-surface dark:text-zinc-400'
        }`}>
          {val}
        </span>
      )
    }
  ];

  if (loading) return <div className="p-6 text-slate-500">Loading species...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Species List */}
      <div className="w-full lg:w-72 flex-shrink-0">
        <div className="sticky top-6 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Supported Species</h4>
            <div className="space-y-2">
              {species.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSpecies(s)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left ${
                    selectedSpecies?.id === s.id 
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none translate-x-1' 
                      : 'bg-white dark:bg-dark-card text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-dark-surface border border-slate-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-base">{s.name}</span>
                    <span className={`text-[10px] uppercase tracking-tighter ${selectedSpecies?.id === s.id ? 'text-blue-100' : 'text-slate-400'}`}>
                      Select to manage ranges
                    </span>
                  </div>
                  <FiChevronRight className={`transition-transform duration-300 ${selectedSpecies?.id === s.id ? 'translate-x-1' : 'opacity-30'}`} size={20} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ranges Table */}
      <div className="flex-1 min-w-0">
        {selectedSpecies ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <MasterDataTable 
              title={`${selectedSpecies.name} Weight Ranges`}
              description={`Define precise weight thresholds for ${selectedSpecies.name.toLowerCase()}s to automate size categorization.`}
              apiUrl="/api/weight-ranges"
              extraParams={{ species_id: selectedSpecies.id }}
              columns={weightRangeColumns}
              initialForm={{ 
                label: "", 
                species_id: selectedSpecies.id,
                min_weight: 0, 
                max_weight: "", 
                unit: "kg", 
                size_category_id: "", 
                status: "Active" 
              }}
              defaultSortBy="min_weight"
            />
          </div>
        ) : (
          <div className="card-shell p-12 text-center text-slate-400 border-dashed">
            <p className="text-lg">Select a species to view and manage its weight ranges.</p>
          </div>
        )}
      </div>
    </div>
  );
}
