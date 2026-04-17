<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            // Check if the old foreign key exists before dropping
            $fks = DB::select("
                SELECT CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_NAME = 'medical_records' 
                AND TABLE_SCHEMA = '" . config('database.connections.mysql.database') . "' 
                AND CONSTRAINT_NAME = 'medical_records_vet_id_foreign'
            ");

            if (!empty($fks)) {
                $table->dropForeign(['vet_id']);
            }
            
            // Re-link to admins table
            $table->foreign('vet_id')->references('id')->on('admins')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropForeign(['vet_id']);
            // We don't restore to 'users' because it's deleted
        });
    }
};
