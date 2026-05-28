<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Maps inventory_category name → [batch_number, lot_number]
    private array $map = [
        'Vaccines'          => ['BATCH-VAC-2025',  'LOT-VAC-001'],
        'Medications'       => ['BATCH-MED-2025',  'LOT-MED-001'],
        'Consumables'       => ['BATCH-SUPP-2025', 'LOT-SUPP-001'],
        'Equipment'         => ['BATCH-SUPP-2025', 'LOT-SUPP-001'],
        'Lab Supplies'      => ['BATCH-SUPP-2025', 'LOT-SUPP-001'],
        'Grooming Supplies' => ['BATCH-GRM-2025',  'LOT-GRM-001'],
        'Food & Supplements'=> ['BATCH-FOOD-2025', 'LOT-FOOD-001'],
    ];

    public function up(): void
    {
        $categories = DB::table('mdm_inventory_categories')
            ->whereIn('name', array_keys($this->map))
            ->pluck('id', 'name');

        foreach ($this->map as $categoryName => [$batch, $lot]) {
            $categoryId = $categories[$categoryName] ?? null;
            if (!$categoryId) continue;

            DB::table('inventories')
                ->where('inventory_category_id', $categoryId)
                ->where(function ($q) {
                    $q->whereNull('batch_number')->orWhere('batch_number', '');
                })
                ->update(['batch_number' => $batch, 'lot_number' => $lot]);
        }
    }

    public function down(): void
    {
        DB::table('inventories')->update(['batch_number' => null, 'lot_number' => null]);
    }
};
