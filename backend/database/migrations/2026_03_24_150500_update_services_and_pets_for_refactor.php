<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->enum('pricing_mode', ['fixed', 'size_based', 'quantity_based', 'manual'])->default('fixed')->after('price');
        });

        Schema::create('service_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->string('size_class'); // Small, Medium, Large, Giant
            $table->decimal('price', 10, 2);
            $table->timestamps();
            
            $table->unique(['service_id', 'size_class']);
        });

        Schema::table('pets', function (Blueprint $table) {
            $table->unsignedBigInteger('legacy_patient_id')->nullable()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            $table->dropColumn('legacy_patient_id');
        });

        Schema::dropIfExists('service_prices');

        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn('pricing_mode');
        });
    }
};
