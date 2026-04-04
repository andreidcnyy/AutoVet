<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            $table->unsignedBigInteger('inventory_category_id')->nullable()->after('id');
        });

        $inventories = DB::table('inventories')->get();
        
        $categoryMap = [
            'Medicines' => 'Medications',
        ];

        foreach ($inventories as $item) {
            $catName = $item->category;
            if (!$catName) {
                $catName = 'Uncategorized';
            }

            if (isset($categoryMap[$catName])) {
                $catName = $categoryMap[$catName];
            }

            $category = DB::table('mdm_inventory_categories')->where('name', $catName)->first();
            
            if (!$category) {
                $catId = DB::table('mdm_inventory_categories')->insertGetId([
                    'name' => $catName,
                    'status' => 'Active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $catId = $category->id;
            }

            DB::table('inventories')
                ->where('id', $item->id)
                ->update(['inventory_category_id' => $catId]);
        }

        Schema::table('inventories', function (Blueprint $table) {
            $table->dropColumn('category');
            $table->foreign('inventory_category_id')->references('id')->on('mdm_inventory_categories')->onDelete('restrict');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            $table->string('category')->nullable();
        });

        $inventories = DB::table('inventories')->get();
        foreach ($inventories as $item) {
            if ($item->inventory_category_id) {
                $cat = DB::table('mdm_inventory_categories')->where('id', $item->inventory_category_id)->first();
                if ($cat) {
                    DB::table('inventories')->where('id', $item->id)->update(['category' => $cat->name]);
                }
            }
        }

        Schema::table('inventories', function (Blueprint $table) {
            $table->dropForeign(['inventory_category_id']);
            $table->dropColumn('inventory_category_id');
        });
    }
};
