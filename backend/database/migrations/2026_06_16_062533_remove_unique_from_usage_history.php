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
            $table->dropUnique(['invoice_item_id']);
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
