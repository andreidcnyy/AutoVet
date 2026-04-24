<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Inventory;
use App\Models\InventoryCategory;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\DB;

class InventoryListSeeder extends Seeder
{
    public function run(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        Inventory::truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $jsonPath = base_path('inventory_list.json');
        if (!File::exists($jsonPath)) return;

        $data = json_decode(File::get($jsonPath), true);
        $clinic = \App\Models\Clinic::first();
        
        $medCat = InventoryCategory::updateOrCreate(['name' => 'Medications'], ['status' => 'Active', 'clinic_id' => $clinic->id]);
        $conCat = InventoryCategory::updateOrCreate(['name' => 'Consumables'], ['status' => 'Active', 'clinic_id' => $clinic->id]);

        $aiMapping = [12=>'INV-001', 13=>'INV-002', 14=>'INV-003', 15=>'INV-004', 16=>'INV-005', 17=>'INV-006', 18=>'INV-007', 19=>'INV-008', 22=>'INV-009', 24=>'INV-010'];

        $inserts = [];
        foreach ($data as $item) {
            $itemId = $item['id'];
            $isConsumable = stripos($item['item_name'] ?? '', 'syringe') !== false || stripos($item['item_name'] ?? '', 'needle') !== false;
            
            $inserts[] = [
                'clinic_id' => $clinic->id,
                'inventory_category_id' => $isConsumable ? $conCat->id : $medCat->id,
                'item_name' => $item['item_name'],
                'code' => $aiMapping[$itemId] ?? ('INV-' . str_pad($itemId, 3, '0', STR_PAD_LEFT)),
                'sku' => 'SKU-' . str_pad($itemId, 3, '0', STR_PAD_LEFT),
                'stock_level' => rand(50, 200),
                'min_stock_level' => 20,
                'price' => rand(10, 500),
                'selling_price' => rand(20, 1000),
                'status' => 'Active',
                'is_billable' => true,
                'is_consumable' => $isConsumable,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (count($inserts) >= 50) {
                Inventory::insert($inserts);
                $inserts = [];
            }
        }
        if (!empty($inserts)) Inventory::insert($inserts);
    }
}
