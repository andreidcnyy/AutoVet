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
        Schema::create('weight_ranges', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->decimal('min_weight', 8, 2);
            $table->decimal('max_weight', 8, 2)->nullable();
            $table->string('unit')->default('kg');
            $table->string('status')->default('Active');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('weight_ranges');
    }
};
