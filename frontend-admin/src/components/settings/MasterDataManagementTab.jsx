import MasterDataTable from "./MasterDataTable";
import WeightRangesManager from "./WeightRangesManager";
import { FiCheckCircle } from "react-icons/fi";
import clsx from "clsx";

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

        {/* Standard Size Labels Placeholder/Helper */}
        <div className="card-shell p-8 border-2 border-emerald-50/50 bg-gradient-to-br from-white to-emerald-50/30 dark:from-dark-card dark:to-emerald-900/5 transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Standard Size Labels</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Standardized system-wide classification categories used for pricing and reporting.</p>
            </div>
            <div className="hidden md:block">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                System Master Data
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
             {['Extra Small', 'Small', 'Medium', 'Large', 'Giant'].map((size, idx) => (
               <div key={size} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-zinc-100 dark:bg-dark-surface dark:border-dark-border shadow-sm group hover:border-emerald-400 hover:shadow-md transition-all duration-300">
                  <div className={clsx(
                    "h-2 w-12 rounded-full mb-4 group-hover:scale-x-125 transition-all duration-300",
                    idx === 0 ? "bg-zinc-200" : idx === 1 ? "bg-zinc-300" : idx === 2 ? "bg-zinc-400" : idx === 3 ? "bg-zinc-500" : "bg-zinc-600"
                  )} />
                  <span className="text-sm font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-tight">{size}</span>
               </div>
             ))}
          </div>
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
