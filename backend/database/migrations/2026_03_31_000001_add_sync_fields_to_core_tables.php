<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Adds sync infrastructure columns to all core sync-eligible tables.
 *
 * Strategy: Staged UUID / Dual-Key approach.
 *   - Integer `id` remains the local primary key (zero FK rewriting required).
 *   - A new `uuid` column serves as the cloud sync identity.
 *   - All existing rows are backfilled with UUIDs in this migration.
 *
 * New columns per table:
 *   uuid                     VARCHAR(36) UNIQUE NULL
 *   sync_status              VARCHAR(30) DEFAULT 'local_only'
 *   synced_at                TIMESTAMP   NULL
 *   last_modified_locally_at TIMESTAMP   NULL
 */
return new class extends Migration
{
    /**
     * Tables that participate in cloud synchronization.
     * Order matters: parents before children for cleaner backfill logs.
     */
    private const SYNC_TABLES = [
        'owners',
        'pets',
        'appointments',
        'medical_records',
        'invoices',
        'invoice_items',
        'inventories',
        'inventory_transactions',
        'services',
    ];

    public function up(): void
    {
        // Step 1: Add the four sync columns to each table
        foreach (self::SYNC_TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->uuid('uuid')->nullable()->unique()->after('id');
                $t->string('sync_status', 30)->default('local_only')->after('uuid');
                $t->timestamp('synced_at')->nullable()->after('sync_status');
                $t->timestamp('last_modified_locally_at')->nullable()->after('synced_at');
            });
        }

        // Step 2: Backfill UUIDs for all existing rows
        // Done per-row (not a single UPDATE) to guarantee unique UUID per record.
        foreach (self::SYNC_TABLES as $table) {
            $rows = DB::table($table)->select('id')->get();
            foreach ($rows as $row) {
                DB::table($table)
                    ->where('id', $row->id)
                    ->update([
                        'uuid'                     => (string) Str::uuid(),
                        'last_modified_locally_at' => now(),
                    ]);
            }
        }
    }

    public function down(): void
    {
        foreach (self::SYNC_TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn(['uuid', 'sync_status', 'synced_at', 'last_modified_locally_at']);
            });
        }
    }
};
