<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            $table->string('lot_number')->nullable()->after('expiration_date');
            $table->string('batch_number')->nullable()->after('lot_number');
        });
    }

    public function down(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            $table->dropColumn(['lot_number', 'batch_number']);
        });
    }
};
