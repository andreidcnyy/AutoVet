<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_forecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_id')->constrained('inventories')->cascadeOnDelete();
            $table->decimal('predicted_demand', 10, 2)->nullable();
            $table->integer('days_until_stockout')->nullable();
            $table->date('predicted_stockout_date')->nullable();
            $table->integer('suggested_reorder_quantity')->nullable();
            $table->timestamp('generated_at');
            $table->string('model_used')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['inventory_id', 'generated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_forecasts');
    }
};
