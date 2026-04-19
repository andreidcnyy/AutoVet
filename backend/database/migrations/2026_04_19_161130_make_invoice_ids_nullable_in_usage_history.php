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
            $table->unsignedBigInteger('invoice_id')->nullable()->change();
            $table->unsignedBigInteger('invoice_item_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_usage_history', function (Blueprint $table) {
            $table->unsignedBigInteger('invoice_id')->nullable(false)->change();
            $table->unsignedBigInteger('invoice_item_id')->nullable(false)->change();
        });
    }
};
