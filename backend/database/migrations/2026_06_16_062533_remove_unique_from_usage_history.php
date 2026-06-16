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
        Schema::table('inventory_usage_history', function (Blueprint $table) {
            $indexes = Schema::getIndexes('inventory_usage_history');
            $hasUnique = collect($indexes)->contains(function ($index) {
                return $index['name'] === 'inventory_usage_history_invoice_item_id_unique';
            });

            if ($hasUnique) {
                // 1. Drop the foreign key first (required by MySQL before index swap)
                $table->dropForeign(['invoice_item_id']);
                
                // 2. Drop the restrictive unique index
                $table->dropUnique(['invoice_item_id']);
                
                // 3. Re-add the foreign key constraint (creates a non-unique index)
                $table->foreign('invoice_item_id')
                      ->references('id')
                      ->on('invoice_items')
                      ->cascadeOnDelete();
            } else {
                // Ensure there's a non-unique index if unique is gone but FK is missing or manually changed
                $table->index('invoice_item_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_usage_history', function (Blueprint $table) {
            $table->dropIndex(['invoice_item_id']);
            $table->unique('invoice_item_id');
        });
    }
};
