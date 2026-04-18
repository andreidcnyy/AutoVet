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
        $jsonPath = base_path('inventory_list.json');
        if (!File::exists($jsonPath)) {
            return;
        }

        $json = File::get($jsonPath);
        $data = json_decode($json, true);

        // Get or create a default category for these items
        $medicationCategory = InventoryCategory::updateOrCreate(['name' => 'Medications'], ['status' => 'Active']);
        $consumableCategory = InventoryCategory::updateOrCreate(['name' => 'Consumables'], ['status' => 'Active']);

        foreach ($data as $item) {
            $isConsumable = stripos($item['item_name'] ?? '', 'syringe') !== false 
                || stripos($item['item_name'] ?? '', 'needle') !== false 
                || stripos($item['item_name'] ?? '', 'gloves') !== false 
                || stripos($item['item_name'] ?? '', 'gauze') !== false 
                || stripos($item['item_name'] ?? '', 'cotton') !== false 
                || stripos($item['item_name'] ?? '', 'alcohol') !== false;

            Inventory::updateOrCreate(
                ['item_name' => $item['item_name']],
                [
                    'inventory_category_id' => $isConsumable ? $consumableCategory->id : $medicationCategory->id,
                    'code' => $item['code'] ?? 'INV-' . str_pad($item['id'], 3, '0', STR_PAD_LEFT),
                    'sku' => 'SKU-' . str_pad($item['id'], 3, '0', STR_PAD_LEFT),
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
