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
        Schema::table('inventory_forecasts', function (Blueprint $table) {
            $table->string('prediction_source')->nullable()->after('model_used')->comment('live, dataset');
            $table->string('trigger_source')->nullable()->after('prediction_source')->comment('manual, invoice_finalization, stock_update, scheduled');
            $table->decimal('estimated_monthly_revenue', 15, 2)->nullable()->after('predicted_monthly_sales');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_forecasts', function (Blueprint $table) {
            $table->dropColumn(['prediction_source', 'trigger_source', 'estimated_monthly_revenue']);
        });
    }
};
