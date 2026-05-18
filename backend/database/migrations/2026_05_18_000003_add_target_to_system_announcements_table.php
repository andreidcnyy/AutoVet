<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('system_announcements', function (Blueprint $table) {
            $table->enum('target', ['admin', 'portal', 'all'])->default('admin')->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('system_announcements', function (Blueprint $table) {
            $table->dropColumn('target');
        });
    }
};
