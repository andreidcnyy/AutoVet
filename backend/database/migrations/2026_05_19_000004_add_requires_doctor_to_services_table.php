<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->boolean('requires_doctor')->default(false)->after('category');
        });

        // Seed existing services: Consultation, Laboratory, Surgery, Imaging require a doctor
        \DB::table('services')->whereIn('category', ['Consultation', 'Laboratory', 'Surgery', 'Imaging'])->update(['requires_doctor' => true]);
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn('requires_doctor');
        });
    }
};
