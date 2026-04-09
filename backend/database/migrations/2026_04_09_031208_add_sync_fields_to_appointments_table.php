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
            if (!Schema::hasColumn('appointments', 'uuid')) {
                $table->uuid('uuid')->nullable()->unique()->after('id');
            }
            if (!Schema::hasColumn('appointments', 'sync_status')) {
                $table->string('sync_status', 30)->default('local_only')->after('uuid');
            }
            if (!Schema::hasColumn('appointments', 'synced_at')) {
                $table->timestamp('synced_at')->nullable()->after('sync_status');
            }
            if (!Schema::hasColumn('appointments', 'last_modified_locally_at')) {
                $table->timestamp('last_modified_locally_at')->nullable()->after('synced_at');
            }
            
            // Also checking for missing relationship fields that might cause 500s in the controller
            if (!Schema::hasColumn('appointments', 'pet_id')) {
                $table->foreignId('pet_id')->nullable()->constrained('pets')->onDelete('cascade');
            }
            if (!Schema::hasColumn('appointments', 'service_id')) {
                $table->foreignId('service_id')->nullable()->constrained('services')->onDelete('set null');
            }
            if (!Schema::hasColumn('appointments', 'vet_id')) {
                $table->foreignId('vet_id')->nullable()->constrained('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('appointments', 'status')) {
                $table->string('status')->default('pending')->after('time');
            }
            if (!Schema::hasColumn('appointments', 'category')) {
                $table->string('category')->nullable()->after('status');
            }
            if (!Schema::hasColumn('appointments', 'notes')) {
                $table->text('notes')->nullable()->after('category');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['uuid', 'sync_status', 'synced_at', 'last_modified_locally_at', 'status', 'category', 'notes']);
            // Note: Not dropping foreign keys here to avoid issues if they existed before, 
            // but in a real surgical migration you might want to.
        });
    }
};
