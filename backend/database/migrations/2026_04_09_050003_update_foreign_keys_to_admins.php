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

        Schema::table('appointments', function (Blueprint $table) {
            $table->dropForeign(['vet_id']);
            $table->foreign('vet_id')->references('id')->on('admins')->onDelete('set null');
        });

        Schema::table('vet_schedules', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('admins')->onDelete('cascade');
        });

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }

    public function down(): void
    {
        // No easy rollback since users table is gone, but we can try to re-link to users if it existed
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropForeign(['vet_id']);
        });

        Schema::table('vet_schedules', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });
    }
};
