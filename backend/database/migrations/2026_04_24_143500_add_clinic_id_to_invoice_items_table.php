<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreignId('clinic_id')->nullable()->after('id')->constrained('clinics')->onDelete('cascade');
        });

        // Assign to first clinic
        $clinic = DB::table('clinics')->first();
        if ($clinic) {
            DB::table('invoice_items')->update(['clinic_id' => $clinic->id]);
        }

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->unsignedBigInteger('clinic_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropForeign(['clinic_id']);
            $table->dropColumn('clinic_id');
        });
    }
};
