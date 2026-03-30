<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the sync_outbox table — the local change-tracking queue.
 *
 * Every create, update, and delete on sync-eligible entities writes a row
 * here (via the HasSyncFields trait). When the clinic system regains internet
 * connectivity, the sync engine reads pending rows oldest-first and transmits
 * them to the cloud server.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_outbox', function (Blueprint $table) {
            $table->id();

            // What was affected
            $table->string('entity_type', 100);       // e.g. 'Pet', 'Appointment'
            $table->uuid('entity_uuid')->nullable();   // UUID of the entity
            $table->unsignedBigInteger('entity_local_id')->nullable(); // Integer PK for local lookups

            // What happened
            $table->enum('action_type', ['created', 'updated', 'deleted']);
            $table->json('payload')->nullable();       // Full snapshot at time of change

            // Queue state
            $table->enum('status', ['pending', 'processing', 'synced', 'failed'])
                  ->default('pending');
            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->text('error_message')->nullable();

            // Timing
            $table->timestamp('queued_at')->useCurrent();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            // Indexes for efficient sync engine queries
            $table->index(['status', 'queued_at'], 'outbox_status_queue_idx');
            $table->index(['entity_type', 'entity_uuid'], 'outbox_entity_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_outbox');
    }
};
