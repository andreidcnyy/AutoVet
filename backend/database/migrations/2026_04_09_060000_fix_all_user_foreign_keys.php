<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        // Fix Owners table
        Schema::table('owners', function (Blueprint $table) {
            $table->dropForeign(['deleted_by']);
            $table->foreign('deleted_by')->references('id')->on('admins')->onDelete('set null');
        });

        // Fix Pets table
        Schema::table('pets', function (Blueprint $table) {
            $table->dropForeign(['deleted_by']);
            $table->foreign('deleted_by')->references('id')->on('admins')->onDelete('set null');
        });

        // Fix Appointments table
        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'deleted_by')) {
                $table->dropForeign(['deleted_by']);
                $table->foreign('deleted_by')->references('id')->on('admins')->onDelete('set null');
            }
        });

        // Fix Medical Records
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropForeign(['deleted_by']);
            $table->foreign('deleted_by')->references('id')->on('admins')->onDelete('set null');
        });

        // Fix Invoices (if has deleted_by)
        if (Schema::hasTable('invoices')) {
            Schema::table('invoices', function (Blueprint $table) {
                if (Schema::hasColumn('invoices', 'deleted_by')) {
                    $table->dropForeign(['deleted_by']);
                    $table->foreign('deleted_by')->references('id')->on('admins')->onDelete('set null');
                }
            });
        }

        // Fix Inventory
        Schema::table('inventories', function (Blueprint $table) {
            $table->dropForeign(['deleted_by']);
            $table->foreign('deleted_by')->references('id')->on('admins')->onDelete('set null');
        });

        // Fix Inventory Transactions
        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->foreign('created_by')->references('id')->on('admins')->onDelete('set null');
        });

        // Fix Services
        Schema::table('services', function (Blueprint $table) {
            $table->dropForeign(['deleted_by']);
            $table->foreign('deleted_by')->references('id')->on('admins')->onDelete('set null');
        });

        // Fix Audit Logs
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('admins')->onDelete('cascade');
        });

        // Fix Notifications
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('admins')->onDelete('cascade');
        });

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }

    public function down(): void
    {
        // Rollback is complex due to users table being deleted
    }
};
