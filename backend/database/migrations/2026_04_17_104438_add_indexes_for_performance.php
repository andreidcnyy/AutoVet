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
        Schema::table('appointments', function (Blueprint $table) {
            $table->index('date');
            $table->index('status');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->index('status');
            $table->index('created_at');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->index('created_at');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->index('read_at');
            $table->index('created_at');
        });

        Schema::table('medical_records', function (Blueprint $table) {
            $table->index('follow_up_date');
        });

        Schema::table('pets', function (Blueprint $table) {
            $table->index('created_at');
        });

        Schema::table('owners', function (Blueprint $table) {
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex(['date']);
            $table->dropIndex(['status']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['read_at']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropIndex(['follow_up_date']);
        });

        Schema::table('pets', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });

        Schema::table('owners', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });
    }
};
