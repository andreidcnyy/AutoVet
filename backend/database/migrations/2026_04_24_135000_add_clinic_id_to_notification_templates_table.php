<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_templates', function (Blueprint $table) {
            $table->foreignId('clinic_id')->nullable()->after('id')->constrained('clinics')->onDelete('cascade');
        });

        // Assign to first clinic
        $clinic = \Illuminate\Support\Facades\DB::table('clinics')->first();
        if ($clinic) {
            \Illuminate\Support\Facades\DB::table('notification_templates')->update(['clinic_id' => $clinic->id]);
        }

        Schema::table('notification_templates', function (Blueprint $table) {
            $table->unsignedBigInteger('clinic_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('notification_templates', function (Blueprint $table) {
            $table->dropForeign(['clinic_id']);
            $table->dropColumn('clinic_id');
        });
    }
};
