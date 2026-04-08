<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Use raw SQL for definitive repair as Laravel Schema builder can be finicky on some DB versions
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        // 1. Manually drop legacy and duplicate constraints if they exist
        try {
            DB::statement('ALTER TABLE appointments DROP FOREIGN KEY appointments_patient_id_foreign');
        } catch (\Exception $e) {}

        try {
            DB::statement('ALTER TABLE appointments DROP FOREIGN KEY appointments_pet_id_foreign');
        } catch (\Exception $e) {}

        // 2. Drop legacy column if it still exists
        try {
            if (Schema::hasColumn('appointments', 'patient_id')) {
                DB::statement('ALTER TABLE appointments DROP COLUMN patient_id');
            }
        } catch (\Exception $e) {}

        // 3. Establish definitive pet_id foreign key constraint
        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'pet_id')) {
                try {
                    $table->foreign('pet_id')->references('id')->on('pets')->cascadeOnDelete();
                } catch (\Exception $e) {
                    // Log or handle unexpected issue if it still occurs
                }
            }
        });

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Schema repair - no meaningful rollback
    }
};
