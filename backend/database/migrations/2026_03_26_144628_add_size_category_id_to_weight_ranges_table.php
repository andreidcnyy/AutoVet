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
        Schema::table('weight_ranges', function (Blueprint $table) {
            $table->foreignId('size_category_id')->nullable()->after('label')->constrained('pet_size_categories')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('weight_ranges', function (Blueprint $table) {
            $table->dropConstrainedForeignId('size_category_id');
        });
    }
};
