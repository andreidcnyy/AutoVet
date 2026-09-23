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
            
            // Cost and selling price were rolled independently, so most items
            // sold below cost and every margin report came out negative. Derive
            // the selling price from the cost instead, and fill the fields the
            // stock screens read (unit, expiry, lot/batch) so they are not blank.
            $cost = rand(10, 500);
            $unit = $isConsumable ? 'pc' : (stripos($item['item_name'] ?? '', 'suspension') !== false ? 'mL' : 'vial');

            $inserts[] = [
                'clinic_id' => $clinic->id,
                'inventory_category_id' => $isConsumable ? $conCat->id : $medCat->id,
                'item_name' => $item['item_name'],
                'code' => $aiMapping[$itemId] ?? ('INV-' . str_pad($itemId, 3, '0', STR_PAD_LEFT)),
                'sku' => 'SKU-' . str_pad($itemId, 3, '0', STR_PAD_LEFT),
                'stock_level' => rand(50, 200),
                'min_stock_level' => 20,
                'unit' => $unit,
                'price' => $cost,
                'selling_price' => round($cost * (1 + rand(35, 90) / 100), 2),
                'expiration_date' => now()->addMonths(rand(3, 30))->toDateString(),
                'lot_number' => 'LOT-' . now()->format('Y') . '-' . str_pad($itemId, 4, '0', STR_PAD_LEFT),
                'batch_number' => 'B' . str_pad($itemId, 5, '0', STR_PAD_LEFT),
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
