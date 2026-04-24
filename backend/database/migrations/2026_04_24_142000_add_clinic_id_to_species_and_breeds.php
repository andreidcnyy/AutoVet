<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = ['species', 'breeds'];
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
        $tables = ['species', 'breeds'];
        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropForeign(['clinic_id']);
                $table->dropColumn('clinic_id');
            });
        }
    }
};
