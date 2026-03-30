<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds sync_scope classification to the settings table.
 *
 * This allows the sync engine to know which settings keys should be
 * pushed to the cloud (clinic public info) vs. kept strictly local
 * (infrastructure config, debug flags, DB credentials, etc.).
 *
 * Scope values:
 *   cloud_syncable  — Safe to push to cloud (clinic name, address, contact)
 *   local_only      — Never sync (default; DB config, local paths, secrets)
 *   system_internal — Framework internals; never sync
 */
return new class extends Migration
{
    /**
     * Settings keys that describe the clinic's public identity
     * and should be pushed to the web portal via cloud sync.
     */
    private const CLOUD_SYNCABLE_KEYS = [
        'clinic_name',
        'clinic_address',
        'clinic_phone',
        'clinic_email',
        'clinic_logo',
        'clinic_tagline',
        'clinic_description',
        'clinic_website',
        'clinic_facebook',
        'clinic_instagram',
        'opening_hours',
        'clinic_map_link',
    ];

    /**
     * Framework / infrastructure keys that must never leave the local server.
     */
    private const SYSTEM_INTERNAL_KEYS = [
        'app_key',
        'db_host',
        'db_password',
        'debug_mode',
    ];

    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->string('sync_scope', 30)->default('local_only')->after('value');
        });

        // Classify known cloud-syncable keys
        if (!empty(self::CLOUD_SYNCABLE_KEYS)) {
            DB::table('settings')
                ->whereIn('key', self::CLOUD_SYNCABLE_KEYS)
                ->update(['sync_scope' => 'cloud_syncable']);
        }

        // Classify system-internal keys
        if (!empty(self::SYSTEM_INTERNAL_KEYS)) {
            DB::table('settings')
                ->whereIn('key', self::SYSTEM_INTERNAL_KEYS)
                ->update(['sync_scope' => 'system_internal']);
        }
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropColumn('sync_scope');
        });
    }
};
