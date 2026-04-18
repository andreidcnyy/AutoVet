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
            if (!Schema::hasColumn('inventory_forecasts', 'average_daily_consumption')) {
                $table->decimal('average_daily_consumption', 10, 2)->nullable()->after('predicted_demand');
            }
            if (!Schema::hasColumn('inventory_forecasts', 'forecast_status')) {
                $table->string('forecast_status')->nullable()->after('suggested_reorder_quantity');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_forecasts', function (Blueprint $table) {
            $table->dropColumn(['average_daily_consumption', 'forecast_status']);
        });
    }
};
