<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * SyncOutbox — The local change-tracking queue for offline-first sync.
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
        'queued_at',
        'retry_count',
        'error_message',
        'processed_at'
    ];

    protected $casts = [
        'payload' => 'array',
        'queued_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

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
