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
        Schema::table('inventories', function (Blueprint $table) {
            $table->decimal('selling_price', 15, 2)->default(0)->after('price');
            $table->boolean('is_billable')->default(true)->after('selling_price');
            $table->boolean('is_consumable')->default(false)->after('is_billable');
            $table->boolean('deduct_on_finalize')->default(true)->after('is_consumable');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->string('item_type')->default('service')->after('invoice_id');
            $table->foreignId('service_id')->nullable()->after('item_type')->constrained('services')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            $table->dropColumn(['selling_price', 'is_billable', 'is_consumable', 'deduct_on_finalize']);
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropForeign(['service_id']);
            $table->dropColumn(['item_type', 'service_id']);
        });
    }
};
