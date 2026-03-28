import MasterDataTable from "./MasterDataTable";
import SpeciesWeightRanges from "./SpeciesWeightRanges";

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
            : 'bg-slate-100 text-slate-600 dark:bg-dark-surface dark:text-zinc-400'
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
            : 'bg-slate-100 text-slate-600 dark:bg-dark-surface dark:text-zinc-400'
        }`}>
          {val}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-12 pb-10">
      <section className="card-shell p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Master Data Management</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Centrally manage categorization and measurement settings used across the clinic.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12">
          <MasterDataTable 
            title="Inventory Categories"
            description="Categorize items in your stock (e.g., Medications, Consumables)."
            apiUrl="/api/inventory-categories"
            columns={categoryColumns}
            initialForm={initialCategoryForm}
          />
          
          <div className="h-px bg-slate-200 dark:bg-dark-border" />

          <MasterDataTable 
            title="Service Categories"
            description="Categorize clinical services (e.g., Surgery, Consultations)."
            apiUrl="/api/service-categories"
            columns={categoryColumns}
            initialForm={initialCategoryForm}
          />

          <div className="h-px bg-slate-200 dark:bg-dark-border" />

          <MasterDataTable 
            title="Pet Size Categories"
            description="Define standard size groups for pet service pricing."
            apiUrl="/api/pet-size-categories"
            columns={categoryColumns}
            initialForm={{ name: "", description: "", status: "Active" }}
          />

          <div className="h-px bg-slate-200 dark:bg-dark-border" />

          <section id="weight-ranges-manager">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Weight-Based Classification</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Configure species-specific weight tiers to automate size categorization for pricing.</p>
            </div>
            <SpeciesWeightRanges />
          </section>

          <div className="h-px bg-slate-200 dark:bg-dark-border" />

          <MasterDataTable 
            title="Units of Measure"
            description="Standard units for products and medications (e.g., ml, tablet)."
            apiUrl="/api/units-of-measure"
            columns={unitColumns}
            initialForm={{ name: "", abbreviation: "", status: "Active" }}
          />
        </div>
      </section>
    </div>
  );
}
