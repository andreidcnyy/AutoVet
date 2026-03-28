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
        Schema::table('breeds', function (Blueprint $table) {
            $table->foreignId('default_size_category_id')
                ->nullable()
                ->after('species_id')
                ->constrained('pet_size_categories')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('breeds', function (Blueprint $table) {
            $table->dropForeign(['default_size_category_id']);
            $table->dropColumn('default_size_category_id');
        });
    }
};
