<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('admins', function (Blueprint $table) {
            $table->timestamp('last_seen_patients_at')->nullable()->after('ai_features_enabled');
            $table->timestamp('last_seen_appointments_at')->nullable()->after('last_seen_patients_at');
        });
    }

    public function down(): void
    {
        Schema::table('admins', function (Blueprint $table) {
            $table->dropColumn(['last_seen_patients_at', 'last_seen_appointments_at']);
        });
    }
};
