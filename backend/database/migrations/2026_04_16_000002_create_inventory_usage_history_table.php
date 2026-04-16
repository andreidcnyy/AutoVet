<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inventory_usage_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_id')->constrained('inventories')->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('invoice_item_id')->constrained('invoice_items')->cascadeOnDelete();
            $table->decimal('quantity_used', 10, 2);
            $table->date('usage_date');
            $table->string('source_type')->default('retail_sale'); // retail_sale, service_consumable
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->timestamps();

            // Prevent duplicate history per invoice line item
            $table->unique('invoice_item_id');
            $table->index('inventory_id');
            $table->index('usage_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_usage_history');
    }
};
