<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            // Drop old foreign key to 'users' table
            $table->dropForeign(['user_id']);
            // Drop old index
            $table->dropIndex('owners_user_id_foreign');
            // Re-add as real foreign key to portal_users
            $table->foreign('user_id')->references('id')->on('portal_users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->index('user_id', 'owners_user_id_foreign');
        });
    }
};
