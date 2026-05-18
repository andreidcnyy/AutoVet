<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portal_users', function (Blueprint $table) {
            $table->string('google_id')->nullable()->unique()->after('avatar');
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('portal_users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropColumn('google_id');
        });
    }
};
