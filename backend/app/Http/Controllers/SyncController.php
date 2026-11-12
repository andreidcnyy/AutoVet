<?php

namespace App\Http\Controllers;

use App\Support\Sync\SyncCodec;
use App\Support\Sync\SyncSchema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * The cloud end of the clinic <-> cloud sync. Reached only through
 * VerifySyncSignature, so every request here comes from the clinic computer
 * holding SYNC_SECRET.
 *
 *  POST /api/sync/push  the clinic sends what changed while it worked locally
 *  GET  /api/sync/pull  the clinic asks what changed in the cloud (for example
 *                       appointments booked online through the portal)
 */
class SyncController extends Controller
{
    private const MAX_PUSH = 500;

    private const DEFAULT_PULL = 300;

    private const MAX_PULL = 1000;

    public function push(Request $request)
    {
        $validated = $request->validate([
            'records' => 'required|array|max:'.self::MAX_PUSH,
            'records.*.type' => 'required|string',
            'records.*.uuid' => 'required|uuid',
            'records.*.action' => 'required|in:upsert,delete',
            'records.*.record' => 'nullable|array',
        ]);

        $clinicId = (int) config('services.sync.clinic_id');
        $codec = new SyncCodec;

        // Parents first, whatever order they arrived in.
        $records = collect($validated['records'])
            ->sortBy(fn ($r, $i) => [SyncSchema::order($r['type']), $i])
            ->values();

        $results = [];
        foreach ($records as $r) {
            $record = $r['action'] === 'delete' ? null : ($r['record'] ?? null);
            if ($r['action'] === 'upsert' && $record === null) {
                $result = ['status' => 'error', 'error' => 'Record data missing.'];
            } else {
                $result = $codec->apply($r['type'], $r['uuid'], $record, $clinicId);
            }
            $results[] = ['type' => $r['type'], 'uuid' => $r['uuid']] + $result;
        }

        $counts = collect($results)->countBy('status')->all();
        Log::info('[sync] push received', $counts);

        return response()->json(['results' => $results, 'counts' => $counts]);
    }

    public function pull(Request $request)
    {
        $limit = min(max((int) $request->query('limit', self::DEFAULT_PULL), 1), self::MAX_PULL);
        $cursor = json_decode((string) $request->query('cursor', '{}'), true) ?: [];
        $clinicId = (int) config('services.sync.clinic_id');
        $codec = new SyncCodec;

        $records = [];
        $more = false;
        $budget = $limit;

        foreach (SyncSchema::ENTITIES as $type => $schema) {
            if ($budget <= 0) {
                $more = true;
                break;
            }

            $table = $schema['table'];
            [$sinceAt, $sinceId] = $cursor[$table] ?? [null, 0];

            // Rows changed after the cursor. (updated_at, id) is a strict order,
            // so rows sharing a timestamp are never skipped or repeated.
            $rows = DB::table($table)
                ->where('clinic_id', $clinicId)
                ->whereNotNull('updated_at')
                ->when($sinceAt, fn ($q) => $q->where(function ($q) use ($sinceAt, $sinceId) {
                    $q->where('updated_at', '>', $sinceAt)
                        ->orWhere(fn ($q) => $q->where('updated_at', $sinceAt)->where('id', '>', $sinceId));
                }))
                ->orderBy('updated_at')->orderBy('id')
                ->limit($budget)
                ->get();

            foreach ($rows as $row) {
                $cursor[$table] = [(string) $row->updated_at, (int) $row->id];
                if (empty($row->uuid)) {
                    continue; // cannot be matched on the other side
                }
                $records[] = ['type' => $type, 'uuid' => $row->uuid, 'record' => $codec->export($type, $row)];
            }

            $budget -= $rows->count();
            if ($rows->count() > 0 && $budget <= 0) {
                $more = true;
            }
        }

        return response()->json([
            'records' => $records,
            'cursor' => $cursor,
            'more' => $more,
        ]);
    }
}
