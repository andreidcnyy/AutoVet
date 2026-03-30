<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * SyncOutbox — The local change-tracking queue for offline-first sync.
 *
 * Every create, update, and delete on sync-eligible entities writes a row here.
 * When internet is available, the sync engine reads pending rows and uploads
 * them to the cloud server, then marks them as 'synced'.
 *
 * This table is the single source of truth for "what changed while offline."
 */
class SyncOutbox extends Model
{
    protected $table = 'sync_outbox';

    protected $fillable = [
        'entity_type',
        'entity_uuid',
        'entity_local_id',
        'action_type',
        'payload',
        'status',
        'retry_count',
        'error_message',
        'queued_at',
        'processed_at',
    ];

    protected $casts = [
        'payload'      => 'array',
        'queued_at'    => 'datetime',
        'processed_at' => 'datetime',
    ];

    // -------------------------------------------------------------------------
    // Query Scopes
    // -------------------------------------------------------------------------

    /** All entries waiting to be sent to cloud. */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /** All entries that failed and may need manual review. */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    /** Entries for a specific entity type (e.g., 'Pet', 'Appointment'). */
    public function scopeForEntity($query, string $entityType)
    {
        return $query->where('entity_type', $entityType);
    }

    /** Entries ordered by queue time (oldest first, for FIFO processing). */
    public function scopeOldestFirst($query)
    {
        return $query->orderBy('queued_at', 'asc');
    }

    // -------------------------------------------------------------------------
    // Status helpers
    // -------------------------------------------------------------------------

    public function markProcessing(): void
    {
        $this->update(['status' => 'processing']);
    }

    public function markSynced(): void
    {
        $this->update([
            'status'       => 'synced',
            'processed_at' => now(),
        ]);
    }

    public function markFailed(string $errorMessage): void
    {
        $this->update([
            'status'        => 'failed',
            'error_message' => $errorMessage,
            'retry_count'   => $this->retry_count + 1,
        ]);
    }
}
