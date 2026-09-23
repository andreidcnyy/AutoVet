<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Clinic;
use App\Models\Inventory;
use App\Models\InventoryCategory;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsMockSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();
        if (!$clinic) return;

        // ── 1. OWNERS: realistic gradual-growth distribution ─────────────────────

        // Remove stale analytics demo owners so re-runs are idempotent
        DB::table('owners')->where('email', 'like', 'analytics.client.%@autovet.demo')->delete();

        // Redistribute BulkProductionMockSeeder owners (all have current timestamp)
        // across history so they don't spike the current month
        $bulkOwners = DB::table('owners')
            ->where('email', 'like', 'client.prod.%@autovet.ph')
            ->orderBy('id')
            ->pluck('id')
            ->toArray();

        $bulkSpread = [
            -11 => 2, -10 => 3, -9 => 3, -8 => 4,
            -7  => 4, -6  => 5, -5 => 5, -4 => 5,
            -3  => 6, -2  => 6, -1 => 5, 0  => 2,
        ];

        $bulkIdx = 0;
        foreach ($bulkSpread as $monthOffset => $count) {
            $monthBase = Carbon::now()->startOfMonth()->addMonths($monthOffset);
            for ($i = 0; $i < $count && $bulkIdx < count($bulkOwners); $i++, $bulkIdx++) {
                $ts = $monthBase->copy()->addDays(rand(0, 27))->setHour(rand(8, 18));
                DB::table('owners')->where('id', $bulkOwners[$bulkIdx])->update([
                    'created_at' => $ts,
                    'updated_at' => $ts,
                ]);
            }
        }

        // Analytics demo owners: gradual growth from ~8/month to ~18/month
        $distribution = [
            -11 => 8,  -10 => 9,  -9 => 10, -8 => 11,
            -7  => 12, -6  => 13, -5 => 13, -4 => 14,
            -3  => 15, -2  => 16, -1 => 17, 0  => 12,
        ];

        $index = (DB::table('owners')->max('id') ?? 0) + 1;

        foreach ($distribution as $monthOffset => $count) {
            $monthBase = Carbon::now()->startOfMonth()->addMonths($monthOffset);
            for ($i = 0; $i < $count; $i++, $index++) {
                $createdAt = $monthBase->copy()->addDays(rand(0, 27))->setHour(rand(8, 18));
                DB::table('owners')->insert([
                    'name'       => "Analytics Client {$index}",
                    'email'      => "analytics.client.{$index}@autovet.demo",
                    'phone'      => '09' . rand(100000000, 999999999),
                    'address'    => 'Metro Manila',
                    'clinic_id'  => $clinic->id,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);
            }
        }

        $this->command->info('AnalyticsMockSeeder: ' . array_sum($distribution) . ' demo clients seeded; bulk owners redistributed.');

        // ── 2. INVENTORY CATEGORIES & ITEMS ──────────────────────────────────────

        $extraCategories = [
            'Vaccines'           => ['Rabies Vaccine', 'Distemper Combo Vaccine', 'Parvo Vaccine', 'Bordetella Vaccine'],
            'Grooming Supplies'  => ['Pet Shampoo', 'Conditioning Spray', 'Ear Cleaner Solution', 'Nail Clippers Set'],
            'Food & Supplements' => ['Premium Dog Food 3kg', 'Cat Food Sachets', 'Vitamin E Drops', 'Probiotic Supplement'],
        ];

        // category name => [inventory_id, ...]
        $categoryItems = [];

        // Collect existing Medications and Consumables item IDs
        $existingCats = DB::table('mdm_inventory_categories')
            ->whereIn('name', ['Medications', 'Consumables'])
            ->pluck('id', 'name');

        foreach (['Medications', 'Consumables'] as $catName) {
            if (isset($existingCats[$catName])) {
                $ids = DB::table('inventories')
                    ->where('inventory_category_id', $existingCats[$catName])
                    ->where('clinic_id', $clinic->id)
                    ->limit(4)
                    ->pluck('id')
                    ->toArray();
                if (!empty($ids)) {
                    $categoryItems[$catName] = $ids;
                }
            }
        }

        // Create extra categories and their placeholder inventory items
        foreach ($extraCategories as $catName => $itemNames) {
            $catId = DB::table('mdm_inventory_categories')
                ->where('name', $catName)
                ->where('clinic_id', $clinic->id)
                ->value('id');

            if (!$catId) {
                $catId = DB::table('mdm_inventory_categories')->insertGetId([
                    'name'       => $catName,
                    'status'     => 'Active',
                    'clinic_id'  => $clinic->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $ids = [];
            foreach ($itemNames as $itemName) {
                $invId = DB::table('inventories')
                    ->where('item_name', $itemName)
                    ->where('clinic_id', $clinic->id)
                    ->value('id');

                if (!$invId) {
                    // Cost and selling price used to be rolled independently, which
                    // left some items priced below cost. Mark the price up from
                    // the cost instead, and fill the stock fields the inventory
                    // screens read so they are not blank.
                    $cost = rand(50, 300);

                    $invId = DB::table('inventories')->insertGetId([
                        'inventory_category_id' => $catId,
                        'clinic_id'             => $clinic->id,
                        'item_name'             => $itemName,
                        'code'                  => 'ANA-' . strtoupper(substr(md5($itemName), 0, 6)),
                        'sku'                   => 'SKU-' . strtoupper(substr(md5($itemName), 0, 4)),
                        'stock_level'           => rand(30, 150),
                        'min_stock_level'       => 10,
                        'unit'                  => 'pc',
                        'price'                 => $cost,
                        'selling_price'         => round($cost * (1 + rand(35, 90) / 100), 2),
                        'expiration_date'       => now()->addMonths(rand(6, 30))->toDateString(),
                        'lot_number'            => 'LOT-' . now()->format('Y') . '-' . strtoupper(substr(md5($itemName), 0, 4)),
                        'batch_number'          => 'B' . strtoupper(substr(md5($itemName), 0, 5)),
                        'status'                => 'Active',
                        'is_billable'           => true,
                        'is_consumable'         => false,
                        'created_at'            => now(),
                        'updated_at'            => now(),
                    ]);
                }
                $ids[] = $invId;
            }
            $categoryItems[$catName] = $ids;
        }

        // ── 3. INVENTORY USAGE HISTORY: realistic multi-category sales data ──────

        // Wipe previous analytics-only usage rows (no invoice reference = our demo data)
        DB::table('inventory_usage_history')
            ->whereNull('invoice_id')
            ->whereNull('invoice_item_id')
            ->where('source_type', 'retail_sale')
            ->delete();

        // Monthly base qty ranges per category (min, max) — grows slightly over time
        $baseQtyRanges = [
            'Medications'        => [20, 35],
            'Consumables'        => [35, 55],
            'Vaccines'           => [25, 40],
            'Grooming Supplies'  => [12, 22],
            'Food & Supplements' => [28, 48],
        ];

        $rows = [];
        foreach ($categoryItems as $catName => $inventoryIds) {
            [$min, $max] = $baseQtyRanges[$catName] ?? [15, 30];
            $itemCount = count($inventoryIds);
            if ($itemCount === 0) continue;

            for ($m = -11; $m <= 0; $m++) {
                $monthBase = Carbon::now()->startOfMonth()->addMonths($m);
                // 4% growth per month trend
                $factor = 1 + (($m + 11) * 0.04);
                $monthlyQty = (int) round(rand($min, $max) * $factor);

                // Distribute across items in this category
                $remaining = $monthlyQty;
                foreach ($inventoryIds as $k => $invId) {
                    $isLast = ($k === $itemCount - 1);
                    $qty = $isLast ? $remaining : (int) round($remaining * (rand(25, 45) / 100));
                    $remaining -= $qty;
                    if ($qty <= 0) continue;

                    $rows[] = [
                        'clinic_id'       => $clinic->id,
                        'inventory_id'    => $invId,
                        'invoice_id'      => null,
                        'invoice_item_id' => null,
                        'quantity_used'   => $qty,
                        'usage_date'      => $monthBase->copy()->addDays(rand(1, 27))->toDateString(),
                        'source_type'     => 'retail_sale',
                        'unit_price'      => rand(50, 500),
                        'created_at'      => now(),
                        'updated_at'      => now(),
                    ];
                }
            }
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('inventory_usage_history')->insert($chunk);
        }

        $this->command->info('AnalyticsMockSeeder: ' . count($rows) . ' usage history rows seeded for ' . count($categoryItems) . ' categories.');
    }
}
