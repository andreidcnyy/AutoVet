<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add sort_order column
        if (!Schema::hasColumn('pet_size_categories', 'sort_order')) {
            Schema::table('pet_size_categories', function (Blueprint $table) {
                $table->integer('sort_order')->default(0)->after('name');
            });
        }

        // 2. Define standard sizes and their order
        $standardSizes = [
            'Extra Small' => 1,
            'Small' => 2,
            'Medium' => 3,
            'Large' => 4,
            'Giant' => 5,
        ];

        // 3. Normalize existing data and ensure canonical entries
        foreach ($standardSizes as $name => $order) {
            // Find or create the canonical record
            $canonical = DB::table('pet_size_categories')->where('name', $name)->first();
            
            if (!$canonical) {
                $id = DB::table('pet_size_categories')->insertGetId([
                    'name' => $name,
                    'sort_order' => $order,
                    'status' => 'Active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('pet_size_categories')->where('id', $canonical->id)->update([
                    'sort_order' => $order,
                    'updated_at' => now(),
                ]);
                $id = $canonical->id;
            }

            // Remap any duplicates to the canonical ID
            $duplicates = DB::table('pet_size_categories')
                ->where('name', $name)
                ->where('id', '!=', $id)
                ->get();

            foreach ($duplicates as $dup) {
                // Update references in related tables
                DB::table('pets')->where('size_category_id', $dup->id)->update(['size_category_id' => $id]);
                DB::table('weight_ranges')->where('size_category_id', $dup->id)->update(['size_category_id' => $id]);
                
                // Delete the duplicate
                DB::table('pet_size_categories')->where('id', $dup->id)->delete();
            }
        }
        
        // 4. Remove any other sizes
        DB::table('pet_size_categories')->whereNotIn('name', array_keys($standardSizes))->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pet_size_categories', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
