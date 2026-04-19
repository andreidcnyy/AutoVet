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
        Schema::table('owners', function (Blueprint $table) {
            $table->index('name');
            $table->index('phone');
            $table->index('email');
        });

        Schema::table('pets', function (Blueprint $table) {
            $table->index('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            $table->dropIndex(['name']);
            $table->dropIndex(['phone']);
            $table->dropIndex(['email']);
        });

        Schema::table('pets', function (Blueprint $table) {
            $table->dropIndex(['name']);
        });
    }
};
