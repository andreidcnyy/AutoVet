<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drops sync_ai_dataset_command.
 *
 * It was created by 2026_04_17_095703_create_sync_ai_dataset_command, which
 * looks like `make:migration` typed where `make:command` was meant: the table
 * holds nothing but an id and timestamps, and the artisan command it is named
 * after (SyncAiDatasetForecasts) never touches it.
 *
 * Verified before removing it: empty on both live and local, no model, and the
 * only mentions of the name anywhere in the repository — backend, frontend,
 * migrations and all — are the create and the dropIfExists in that one
 * migration. A full endpoint sweep with the table already dropped returned no
 * server errors across 123 GET and 89 write routes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('sync_ai_dataset_command');
    }

    public function down(): void
    {
        // Recreated exactly as the original migration had it, so rolling back
        // leaves the schema where it was.
        Schema::create('sync_ai_dataset_command', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
        });
    }
};
