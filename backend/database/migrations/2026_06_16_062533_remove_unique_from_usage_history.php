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
                $table->dropUnique(['invoice_item_id']);
            }
            
            $table->index('invoice_item_id');
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
