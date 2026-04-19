<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Inventory;
use App\Models\InventoryCategory;
use Illuminate\Support\Facades\File;

class InventoryListSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Truncate to avoid duplicate SKU/Code issues during re-seeding
        \Illuminate\Support\Facades\DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        Inventory::truncate();
        \Illuminate\Support\Facades\DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $jsonPath = base_path('inventory_list.json');
        if (!File::exists($jsonPath)) {
            return;
        }

        $json = File::get($jsonPath);
        $data = json_decode($json, true);

        // Get or create a default category for these items
        $medicationCategory = InventoryCategory::updateOrCreate(['name' => 'Medications'], ['status' => 'Active']);
        $consumableCategory = InventoryCategory::updateOrCreate(['name' => 'Consumables'], ['status' => 'Active']);

        // Explicit mapping to align with AI datasets (storage/datasets/inventory.csv)
        // Dataset INV-001 to INV-010 maps to specific historical items
        $aiMapping = [
            12 => 'INV-001', // Nobivac DHPPi
            13 => 'INV-002', // Nobivac Rabies
            14 => 'INV-003', // Nobivac L4
            15 => 'INV-004', // Nobivac KC
            16 => 'INV-005', // Nobivac Tricat Trio
            17 => 'INV-006', // Synulox
            18 => 'INV-007', // Cerenia
            19 => 'INV-008', // Metacam
            22 => 'INV-009', // Zoletil
            24 => 'INV-010', // Syringe 1 mL
        ];

        foreach ($data as $item) {
            $itemId = $item['id'];
            $isConsumable = stripos($item['item_name'] ?? '', 'syringe') !== false 
                || stripos($item['item_name'] ?? '', 'needle') !== false 
                || stripos($item['item_name'] ?? '', 'gloves') !== false 
                || stripos($item['item_name'] ?? '', 'gauze') !== false 
                || stripos($item['item_name'] ?? '', 'cotton') !== false 
                || stripos($item['item_name'] ?? '', 'alcohol') !== false;

            // Use AI mapping if available, else fallback to standard generation
            $finalCode = $aiMapping[$itemId] ?? ('INV-' . str_pad($itemId, 3, '0', STR_PAD_LEFT));

            Inventory::updateOrCreate(
                ['item_name' => $item['item_name']],
                [
                    'inventory_category_id' => $isConsumable ? $consumableCategory->id : $medicationCategory->id,
                    'code' => $finalCode,
                    'sku' => 'SKU-' . str_pad($itemId, 3, '0', STR_PAD_LEFT),
                    'stock_level' => rand(50, 200),
                    'min_stock_level' => 20,
                    'price' => rand(10, 500),
                    'selling_price' => rand(20, 1000),
                    'status' => 'Active',
                    'is_billable' => true,
                    'is_consumable' => $isConsumable,
                ]
            );
        }
    }
}
