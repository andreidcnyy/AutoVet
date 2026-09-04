import MasterDataTable from "./MasterDataTable";
import WeightRangesManager from "./WeightRangesManager";
import { FiCheckCircle } from "react-icons/fi";

export default function MasterDataManagementTab() {

  const categoryColumns = [
    { key: "name", label: "Category Name" },
    {
      key: "status",
      label: "Status",
      render: (val) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          val === 'Active'
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-zinc-100 text-zinc-600 dark:bg-dark-surface dark:text-zinc-400'
        }`}>
          {val}
        </span>
      )
    }
  ];

  const initialCategoryForm = { name: "", status: "Active" };

  const weightRangeColumns = [
    { key: "label", label: "Label" },
    { key: "min_weight", label: "Min (kg)" },
    { key: "max_weight", label: "Max (kg)" },
    { 
      key: "size_category_id", 
      label: "Size Category",
      render: (val, item) => (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
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
            : 'bg-zinc-100 text-zinc-600 dark:bg-dark-surface dark:text-zinc-400'
        }`}>
          {val}
        </span>
      )
    }
  ];

  const unitColumns = [
    { key: "name", label: "Unit Name" },
    { key: "abbreviation", label: "Abbr." },
    { 
      key: "status", 
      label: "Status",
      render: (val) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          val === 'Active' 
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
            : 'bg-zinc-100 text-zinc-600 dark:bg-dark-surface dark:text-zinc-400'
        }`}>
          {val}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="mb-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Master Data Management</h2>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Centrally manage categorization and measurement settings used across the clinic.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="card-shell p-6 transition-all hover:shadow-md">
          <MasterDataTable
            title="Inventory Categories"
            description="Categorize items in your stock (e.g., Medications, Consumables)."
            apiUrl="/api/inventory-categories"
            columns={categoryColumns}
            initialForm={initialCategoryForm}
          />
        </div>
        
        <div className="card-shell p-6 transition-all hover:shadow-md">
          <MasterDataTable 
            title="Service Categories"
            description="Categorize clinical services (e.g., Surgery, Consultations)."
            apiUrl="/api/service-categories"
            columns={categoryColumns}
            initialForm={initialCategoryForm}
          />
        </div>

        <div className="card-shell p-8 transition-all hover:shadow-lg border-2 border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/20">
          <div className="space-y-8">
            <div className="border-b border-zinc-100 dark:border-dark-border pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Weight-Based Classification</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Define species-specific weight tiers that map to standard size labels.</p>
                </div>
                <div className="bg-emerald-600 rounded-2xl p-3 text-white shadow-xl shadow-emerald-500/20">
                  <FiCheckCircle size={24} />
                </div>
              </div>
            </div>
            <WeightRangesManager />
          </div>
        </div>

        <div className="card-shell p-6 transition-all hover:shadow-md">
          <MasterDataTable 
            title="Units of Measure"
            description="Standard units for products and medications (e.g., ml, tablet)."
            apiUrl="/api/units-of-measure"
            columns={unitColumns}
            initialForm={{ name: "", abbreviation: "", status: "Active" }}
          />
        </div>
      </div>
    </div>
  );
}
