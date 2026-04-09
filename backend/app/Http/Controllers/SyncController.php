<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SyncController extends Controller
{
    /**
     * Receive and process sync data from a clinic.
     */
    public function receive(Request $request)
    {
        $signature = $request->header('X-AutoVet-Signature');
        $payload = $request->all();
        $secret = config('services.sync.secret');

        // Verify signature
        $expectedSignature = hash_hmac('sha256', json_encode($payload), $secret);

        if (!hash_equals($expectedSignature, $signature)) {
            return response()->json(['message' => 'Invalid signature.'], 403);
        }

        // Prevent replay attacks (check timestamp if needed, e.g., within 5 mins)
        if (abs(now()->timestamp - $payload['timestamp']) > 300) {
            return response()->json(['message' => 'Request expired.'], 403);
        }

        $entityType = $payload['entity_type'];
        $entityUuid = $payload['entity_uuid'];
        $actionType = $payload['action_type'];
        $data       = $payload['data'];

        try {
            $this->processSync($entityType, $entityUuid, $actionType, $data);
            return response()->json(['status' => 'success']);
        } catch (\Throwable $e) {
            Log::error('[SyncController] Processing failed', [
                'entity' => $entityType,
                'uuid'   => $entityUuid,
                'error'  => $e->getMessage()
            ]);
            return response()->json(['message' => 'Internal error.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Idempotent processing of sync data.
     */
    private function processSync($entityType, $uuid, $action, $data)
    {
        $modelClass = "App\\Models\\" . $entityType;
        if (!class_exists($modelClass)) {
            throw new \Exception("Model class {$modelClass} not found.");
        }

        if ($action === 'deleted') {
            $modelClass::where('uuid', $uuid)->delete();
            return;
        }

        // Clean up data for insertion/update
        // We remove 'id' to let the local DB handle auto-incrementing if it's different
        $id = $data['id'] ?? null;
        unset($data['id']);
        
        // Ensure sync metadata is updated
        $data['sync_status'] = \App\Enums\SyncStatus::SYNCED->value;
        $data['synced_at']   = now();

        $modelClass::updateOrCreate(['uuid' => $uuid], $data);
    }
}
