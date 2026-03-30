<?php

namespace App\Traits;

use App\Enums\SyncStatus;
use App\Models\SyncOutbox;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * HasSyncFields — Offline-First Sync Infrastructure Trait
 *
 * Attach this trait to any Eloquent model that participates
 * in local-to-cloud synchronization. It automatically:
 *
 *  - Generates a UUID on creation (used as the cloud sync identity)
 *  - Sets sync_status = 'local_only' on creation
 *  - Updates sync_status = 'pending_sync' on modification (if previously synced)
 *  - Stamps last_modified_locally_at on every create/update
 *  - Logs every create, update, and delete to the sync_outbox table
 *
 * Requires these columns on the model's table (added via migration):
 *   uuid                     VARCHAR(36) UNIQUE NULL
 *   sync_status              VARCHAR(30)  DEFAULT 'local_only'
 *   synced_at                TIMESTAMP NULL
 *   last_modified_locally_at TIMESTAMP NULL
 */
trait HasSyncFields
{
    public static function bootHasSyncFields(): void
    {
        // --- BEFORE SAVE ---

        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            $model->sync_status              = SyncStatus::LOCAL_ONLY->value;
            $model->last_modified_locally_at = now();
        });

        static::updating(function ($model) {
            $model->last_modified_locally_at = now();

            // Only escalate to pending_sync if the record was previously synced.
            // Records that are local_only or already pending stay as-is.
            if ($model->sync_status === SyncStatus::SYNCED->value) {
                $model->sync_status = SyncStatus::PENDING->value;
            } elseif (empty($model->sync_status)) {
                $model->sync_status = SyncStatus::LOCAL_ONLY->value;
            }
        });

        // --- AFTER SAVE ---

        static::created(function ($model) {
            self::logToOutbox($model, 'created');
        });

        static::updated(function ($model) {
            self::logToOutbox($model, 'updated');
        });

        static::deleted(function ($model) {
            self::logToOutbox($model, 'deleted');
        });
    }

    /**
     * Write a sync outbox entry for this model event.
     * Wrapped in try/catch so outbox failures never block the primary operation.
     */
    private static function logToOutbox($model, string $action): void
    {
        try {
            $payload = $action === 'deleted'
                ? ['id' => $model->getKey(), 'uuid' => $model->uuid]
                : $model->toArray();

            SyncOutbox::create([
                'entity_type'     => class_basename($model),
                'entity_uuid'     => $model->uuid,
                'entity_local_id' => $model->getKey(),
                'action_type'     => $action,
                'payload'         => $payload,
                'status'          => 'pending',
                'queued_at'       => now(),
            ]);
        } catch (\Throwable $e) {
            // Log a warning but NEVER block the main DB operation.
            Log::warning('[SyncOutbox] Failed to log outbox entry.', [
                'entity'  => class_basename($model),
                'id'      => $model->getKey(),
                'action'  => $action,
                'error'   => $e->getMessage(),
            ]);
        }
    }

    // -------------------------------------------------------------------------
    // Convenience accessors for sync state
    // -------------------------------------------------------------------------

    /**
     * Returns true if this record has never been synced to cloud.
     */
    public function isLocalOnly(): bool
    {
        return $this->sync_status === SyncStatus::LOCAL_ONLY->value;
    }

    /**
     * Returns true if this record is waiting to be uploaded.
     */
    public function isPendingSync(): bool
    {
        return $this->sync_status === SyncStatus::PENDING->value;
    }

    /**
     * Returns true if this record is up to date with the cloud.
     */
    public function isSynced(): bool
    {
        return $this->sync_status === SyncStatus::SYNCED->value;
    }

    /**
     * Mark the record as successfully synced. Call this from the sync engine.
     */
    public function markAsSynced(): void
    {
        $this->timestamps = false; // Don't update updated_at during a sync confirmation
        $this->update([
            'sync_status' => SyncStatus::SYNCED->value,
            'synced_at'   => now(),
        ]);
        $this->timestamps = true;
    }
}
