<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->foreignId('vet_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            // Try renaming if the column exists
            if (Schema::hasColumn('appointments', 'patient_id')) {
                $table->renameColumn('patient_id', 'pet_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropForeign(['service_id']);
            $table->dropColumn('service_id');
            $table->dropForeign(['vet_id']);
            $table->dropColumn('vet_id');
            $table->dropColumn('notes');
            if (Schema::hasColumn('appointments', 'pet_id')) {
                $table->renameColumn('pet_id', 'patient_id');
            }
        });
    }
};
