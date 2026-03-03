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
        Schema::table('patients', function (Blueprint $table) {
            $table->string('owner_city')->nullable()->after('owner_address');
            $table->string('owner_province')->nullable()->after('owner_city');
            $table->string('owner_zip')->nullable()->after('owner_province');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn(['owner_city', 'owner_province', 'owner_zip']);
        });
    }
};
