<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Setting;
use App\Models\InventoryCategory;
use App\Models\ServiceCategory;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Move Inventory Categories
        $invSetting = Setting::where('key', 'inventory_categories')->first();
        if ($invSetting && $invSetting->value) {
            $categories = json_decode($invSetting->value, true);
            if (is_array($categories)) {
                foreach ($categories as $catName) {
                    InventoryCategory::firstOrCreate(['name' => $catName]);
                }
            }
        }

        // Move Service Categories
        $svcSetting = Setting::where('key', 'service_categories')->first();
        if ($svcSetting && $svcSetting->value) {
            $categories = json_decode($svcSetting->value, true);
            if (is_array($categories)) {
                foreach ($categories as $catName) {
                    ServiceCategory::firstOrCreate(['name' => $catName]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
