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
            $table->decimal('trend_fit_score', 5, 4)->nullable()->after('forecast_status');
            $table->decimal('confidence_score', 5, 4)->nullable()->after('trend_fit_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_forecasts', function (Blueprint $table) {
            $table->dropColumn(['trend_fit_score', 'confidence_score']);
        });
    }
};
