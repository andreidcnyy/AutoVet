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
        // Redundant - columns already created in 2026_04_16_000002_create_inventory_usage_history_table
        /*
        Schema::table('inventory_usage_history', function (Blueprint $table) {
            $table->foreignId('invoice_id')->after('inventory_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->foreignId('invoice_item_id')->after('invoice_id')->nullable()->unique()->constrained('invoice_items')->nullOnDelete();
            $table->decimal('unit_price', 10, 2)->after('source_type')->nullable();
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
            $table->dropForeign(['invoice_item_id']);
            $table->dropForeign(['invoice_id']);
            $table->dropColumn(['invoice_item_id', 'invoice_id', 'unit_price']);
        });
        */
    }
};
