<?php

namespace App\Services;

use App\Models\SyncOutbox;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncService
{
    /**
     * Push pending outbox entries to the central portal.
     */
    public function pushToPortal(): void
    {
        if (!config('services.sync.is_clinic')) {
            return;
        }

        $pending = SyncOutbox::pending()->oldestFirst()->limit(50)->get();

        if ($pending->isEmpty()) {
            return;
        }

        foreach ($pending as $entry) {
            $this->syncEntry($entry);
        }
    }

    /**
     * Sync a single outbox entry.
     */
    private function syncEntry(SyncOutbox $entry): void
    {
        $entry->markProcessing();

        try {
            $url = config('services.sync.portal_url') . '/api/sync/receive';
            $secret = config('services.sync.secret');

            $payload = [
                'entity_type'     => $entry->entity_type,
                'entity_uuid'     => $entry->entity_uuid,
                'action_type'     => $entry->action_type,
                'data'            => $entry->payload,
                'timestamp'       => now()->timestamp,
            ];

            // Sign the payload
            $signature = hash_hmac('sha256', json_encode($payload), $secret);

            $response = Http::withHeaders([
                'X-AutoVet-Signature' => $signature,
            ])->post($url, $payload);

            if ($response->successful()) {
                $entry->markSynced();
                
                // Also update the source model's sync status
                $this->updateSourceModelStatus($entry);
            } else {
                $entry->markFailed('Portal returned status: ' . $response->status() . ' - ' . $response->body());
            }
        } catch (\Throwable $e) {
            $entry->markFailed($e->getMessage());
            Log::error('[SyncService] Sync failed for entry ' . $entry->id, [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Update the sync_status on the actual model being synced.
     */
    private function updateSourceModelStatus(SyncOutbox $entry): void
    {
        $modelClass = "App\\Models\\" . $entry->entity_type;
        if (class_exists($modelClass)) {
            $model = $modelClass::where('uuid', $entry->entity_uuid)->first();
            if ($model && method_exists($model, 'markAsSynced')) {
                $model->markAsSynced();
            }
        }
    }
}
