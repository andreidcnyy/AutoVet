<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portal_users', function (Blueprint $table) {
            $table->timestamp('deletion_requested_at')->nullable()->after('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::table('portal_users', function (Blueprint $table) {
            $table->dropColumn('deletion_requested_at');
        });
    }
};
