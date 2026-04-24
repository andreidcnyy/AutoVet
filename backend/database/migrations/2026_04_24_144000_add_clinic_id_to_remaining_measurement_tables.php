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

        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->foreignId('clinic_id')->nullable()->after('id')->constrained('clinics')->onDelete('cascade');
            });

            if ($clinic) {
                DB::table($table)->update(['clinic_id' => $clinic->id]);
            }

            Schema::table($table, function (Blueprint $table) {
                $table->unsignedBigInteger('clinic_id')->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        $tables = ['pet_size_categories', 'weight_ranges', 'units_of_measure'];
        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropForeign(['clinic_id']);
                $table->dropColumn('clinic_id');
            });
        }
    }
};
