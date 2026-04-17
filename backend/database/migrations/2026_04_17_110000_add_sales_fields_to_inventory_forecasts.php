<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_forecasts', function (Blueprint $table) {
            $table->decimal('predicted_daily_sales', 10, 2)->nullable()->after('notes');
            $table->decimal('predicted_weekly_sales', 10, 2)->nullable()->after('predicted_daily_sales');
            $table->decimal('predicted_monthly_sales', 10, 2)->nullable()->after('predicted_weekly_sales');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_forecasts', function (Blueprint $table) {
            $table->dropColumn(['predicted_daily_sales', 'predicted_weekly_sales', 'predicted_monthly_sales']);
        });
    }
};
