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
        Schema::table('appointments', function (Blueprint $table) {
            // Check if patient_id exists before attempting to rename or drop
            if (Schema::hasColumn('appointments', 'patient_id')) {
                // Drop foreign key first
                $table->dropForeign(['patient_id']);
                
                // Rename column
                $table->renameColumn('patient_id', 'pet_id');
            }
        });

        Schema::table('appointments', function (Blueprint $table) {
            // Ensure pet_id exists (might already be there or just renamed)
            // And add new foreign key to pets table
            $table->foreign('pet_id')->references('id')->on('pets')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropForeign(['pet_id']);
            $table->renameColumn('pet_id', 'patient_id');
            $table->foreign('patient_id')->references('id')->on('patients')->onDelete('cascade');
        });
    }
};
