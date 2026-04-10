<?php

namespace App\Traits;

use App\Enums\SyncStatus;
use App\Models\SyncOutbox;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * HasSyncFields — Offline-First Sync Infrastructure Trait
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
            // Log warning removed to prevent potential logger-related crashes
            // \Log::warning('[SyncOutbox] Failed to log outbox entry.', ...);
        }
    }

    // -------------------------------------------------------------------------
    // Convenience accessors for sync state
    // -------------------------------------------------------------------------

    public function isLocalOnly(): bool
    {
        return $this->sync_status === SyncStatus::LOCAL_ONLY->value;
    }

    public function isPendingSync(): bool
    {
        return $this->sync_status === SyncStatus::PENDING->value;
    }

    public function isSynced(): bool
    {
        return $this->sync_status === SyncStatus::SYNCED->value;
    }

    public function markAsSynced(): void
    {
        $this->timestamps = false;
        $this->update([
            'sync_status' => SyncStatus::SYNCED->value,
            'synced_at'   => now(),
        ]);
        $this->timestamps = true;
    }
}
