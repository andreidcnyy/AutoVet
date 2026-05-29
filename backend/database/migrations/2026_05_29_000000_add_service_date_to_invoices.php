<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // The booked appointment (service) date, captured at invoice creation.
            // Independent of created_at and free of clinic/soft-delete scoping issues.
            $table->date('service_date')->nullable()->after('appointment_id');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('service_date');
        });
    }
};
