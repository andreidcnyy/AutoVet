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
        Schema::table('services', function (Blueprint $table) {
            $table->string('pricing_type')->default('fixed')->after('price'); // fixed, size_based, weight_based
            $table->string('measurement_basis')->default('none')->after('pricing_type'); // none, size, weight
            $table->decimal('base_price', 10, 2)->nullable()->after('measurement_basis');
        });

        Schema::table('pets', function (Blueprint $table) {
            $table->decimal('weight', 8, 2)->nullable()->after('gender');
            $table->foreignId('size_category_id')->nullable()->after('weight')->constrained('pet_size_categories')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('size_category_id');
            $table->dropColumn('weight');
        });

        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn(['pricing_type', 'measurement_basis', 'base_price']);
        });
    }
};
