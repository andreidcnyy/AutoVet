<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = ['pet_size_categories', 'weight_ranges', 'units_of_measure'];
        $clinic = DB::table('clinics')->first();

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('clinic_id')->nullable()->after('id')->constrained('clinics')->onDelete('cascade');
            });

            if ($clinic) {
                DB::table($tableName)->update(['clinic_id' => $clinic->id]);
            }

            Schema::table($tableName, function (Blueprint $table) {
                $table->dropForeign(['clinic_id']);
            });

            Schema::table($tableName, function (Blueprint $table) {
                $table->unsignedBigInteger('clinic_id')->nullable(false)->change();
            });

            Schema::table($tableName, function (Blueprint $table) {
                $table->foreign('clinic_id')->references('id')->on('clinics')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        $tables = ['pet_size_categories', 'weight_ranges', 'units_of_measure'];
        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropForeign(['clinic_id']);
                $table->dropColumn('clinic_id');
            });
        }
    }
};
