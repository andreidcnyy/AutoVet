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
        /*
        Schema::table('inventory_usage_history', function (Blueprint $table) {
            // 1. Drop the foreign key first (required by MySQL before index swap)
            $table->dropForeign('inventory_usage_history_inventory_id_foreign');
            
            // 2. Add a standard (non-unique) index for the inventory ID
            $table->index('inventory_id');
            
            // 3. Drop the restrictive unique index
            $table->dropUnique('idx_usage_unique_date');
            
            // 4. Re-add the foreign key constraint
            $table->foreign('inventory_id')
                  ->references('id')
                  ->on('inventories')
                  ->onDelete('cascade');
        });
        */
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        /*
        Schema::table('inventory_usage_history', function (Blueprint $table) {
            $table->dropForeign(['inventory_id']);
            $table->dropIndex(['inventory_id']);
            $table->unique(['inventory_id', 'usage_date', 'source_type'], 'idx_usage_unique_date');
            $table->foreign('inventory_id')
                  ->references('id')
                  ->on('inventories')
                  ->onDelete('cascade');
        });
        */
    }
};
