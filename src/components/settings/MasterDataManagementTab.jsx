import MasterDataTable from "./MasterDataTable";

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

  return (
    <div className="space-y-12 pb-10">
      <section className="card-shell p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Master Data Management</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Centrally manage categorization and master lists used across the clinic.
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
        </div>
      </section>

      <section className="card-shell p-6 bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
        <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50 mb-2">MDM Roadmap</h3>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Future modules to be migrated: Species, Breeds, Measurements, and Units of Measure.
        </p>
      </section>
    </div>
  );
}
