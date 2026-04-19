<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portal_users', function (Blueprint $table) {
            if (!Schema::hasColumn('portal_users', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('portal_users', function (Blueprint $table) {
            if (Schema::hasColumn('portal_users', 'email_verified_at')) {
                $table->dropColumn('email_verified_at');
            }
        });
    }
};
