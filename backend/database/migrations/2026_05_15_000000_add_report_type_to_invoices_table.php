<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('report_type')->nullable()->default('transaction')->after('status');
            $table->unsignedBigInteger('pet_id')->nullable()->change();
            $table->unsignedBigInteger('appointment_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('report_type');
        });
    }
};
