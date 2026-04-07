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
        // 1. Get all pricing rules that are weight-based
        $rules = DB::table('service_pricing_rules')->where('basis_type', 'weight')->get();

        foreach ($rules as $rule) {
            // Find the weight range
            $range = DB::table('weight_ranges')->where('id', $rule->reference_id)->first();
            
            if ($range && $range->size_category_id) {
                // Update this rule to be size-based using the size_category_id from the range
                DB::table('service_pricing_rules')
                    ->where('id', $rule->id)
                    ->update([
                        'basis_type' => 'size',
                        'reference_id' => $range->size_category_id,
                        'updated_at' => now(),
                    ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverting this is complex because we don't know which weight_range it originally belonged to 
        // if multiple ranges share the same size category. For simplicity, we'll leave it as is 
        // or just log that it's a one-way migration for standardization.
    }
};
