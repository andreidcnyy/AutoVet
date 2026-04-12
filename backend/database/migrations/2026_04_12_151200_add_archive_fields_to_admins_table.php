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
            if (!Schema::hasColumn('admins', 'deleted_by')) {
                $table->foreignId('deleted_by')->nullable()->constrained('admins')->nullOnDelete();
            }
            if (!Schema::hasColumn('admins', 'restore_until')) {
                $table->timestamp('restore_until')->nullable();
            }
        });

        Schema::table('portal_users', function (Blueprint $table) {
            if (!Schema::hasColumn('portal_users', 'deleted_by')) {
                $table->foreignId('deleted_by')->nullable()->constrained('admins')->nullOnDelete();
            }
            if (!Schema::hasColumn('portal_users', 'restore_until')) {
                $table->timestamp('restore_until')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('admins', function (Blueprint $table) {
            $table->dropForeign(['deleted_by']);
            $table->dropColumn(['deleted_by', 'restore_until']);
        });

        Schema::table('portal_users', function (Blueprint $table) {
            $table->dropForeign(['deleted_by']);
            $table->dropColumn(['deleted_by', 'restore_until']);
        });
    }
};
