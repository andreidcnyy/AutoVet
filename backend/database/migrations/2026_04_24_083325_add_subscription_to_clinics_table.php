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
        Schema::table('clinics', function (Blueprint $table) {
            $table->string('subscription_tier')->default('Free Trial')->after('status');
            $table->dateTime('subscription_expires_at')->nullable()->after('subscription_tier');
        });
    }

    public function down(): void
    {
        Schema::table('clinics', function (Blueprint $table) {
            $table->dropColumn(['subscription_tier', 'subscription_expires_at']);
        });
    }
};
