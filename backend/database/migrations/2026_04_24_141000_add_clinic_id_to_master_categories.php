<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = ['mdm_inventory_categories', 'mdm_service_categories'];
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
        $tables = ['mdm_inventory_categories', 'mdm_service_categories'];
        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropForeign(['clinic_id']);
                $table->dropColumn('clinic_id');
            });
        }
    }
};
