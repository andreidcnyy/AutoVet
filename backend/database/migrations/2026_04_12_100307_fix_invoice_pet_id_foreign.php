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
        Schema::table('invoices', function (Blueprint $table) {
            // Drop the old constraint that points to the non-existent or wrong 'patients' table
            // Based on investigation, the constraint name is 'invoices_patient_id_foreign'
            try {
                $table->dropForeign('invoices_patient_id_foreign');
            } catch (\Exception $e) {
                // If it fails, try to drop by array syntax
                try {
                    $table->dropForeign(['pet_id']);
                } catch (\Exception $e2) {
                    // Ignore if it doesn't exist
                }
            }

            // Add the correct constraint pointing to 'pets' table
            $table->foreign('pet_id')->references('id')->on('pets')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['pet_id']);
            // We won't restore the broken one
        });
    }
};
