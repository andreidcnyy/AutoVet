<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (Schema::hasColumn('invoices', 'patient_id')) {
                $table->renameColumn('patient_id', 'pet_id');
            } else {
                $table->foreignId('pet_id')->nullable()->constrained('pets')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (Schema::hasColumn('invoices', 'pet_id')) {
                $table->renameColumn('pet_id', 'patient_id');
            }
        });
    }
};
