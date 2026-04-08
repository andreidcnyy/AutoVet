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
        // 1. Identify and fix UNLINKED weight ranges
        // Find a fallback size (e.g. Medium) if unlinked and active
        $mediumSize = DB::table('pet_size_categories')->where('name', 'Medium')->first();
        
        if ($mediumSize) {
            DB::table('weight_ranges')
                ->where('status', 'Active')
                ->whereNull('size_category_id')
                ->update(['size_category_id' => $mediumSize->id]);
        }

        // 2. Normalize all pets based on current weight ranges
        // We do this via raw SQL or chunks to be safe with large datasets
        $pets = DB::table('pets')
            ->whereNotNull('weight')
            ->whereNotNull('species_id')
            ->get();
        
        foreach ($pets as $pet) {
            $range = DB::table('weight_ranges')
                ->where('status', 'Active')
                ->where('species_id', $pet->species_id)
                ->where('min_weight', '<=', $pet->weight)
                ->where(function ($query) use ($pet) {
                    $query->where('max_weight', '>=', $pet->weight)
                          ->orWhereNull('max_weight');
                })
                ->first();

            if ($range && $range->size_category_id) {
                if ($pet->size_category_id != $range->size_category_id) {
                    DB::table('pets')->where('id', $pet->id)->update([
                        'size_category_id' => $range->size_category_id,
                        'updated_at' => now()
                    ]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data normalization is generally not reversible in a standard way
    }
};
