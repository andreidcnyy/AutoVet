<?php

namespace App\Services;

use App\Models\SyncOutbox;
use App\Support\Sync\SyncCodec;
use App\Support\Sync\SyncSchema;
use App\Support\Sync\SyncSignature;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The clinic end of the clinic <-> cloud sync.
 *
 * The clinic computer keeps working with its own database whether or not the
 * internet is up. Every change it makes is queued in sync_outbox (by the
 * HasSyncFields trait). When the cloud can be reached:
 *
 *   push()  sends the queued changes to the cloud;
 *   pull()  brings down what changed in the cloud since last time.
 *
 * If the cloud cannot be reached, nothing is lost or marked failed: the queue
 * stays as it is and the next run picks it up. A conflict (the same record
 * edited on both sides) is settled by "latest edit wins" in SyncCodec.
 */
class SyncService
{
    /** A record that keeps failing for its own reasons stops after this many tries. */
    public const MAX_RETRIES = 10;

    private const PUSH_BATCH = 200;

    private const PULL_PAGES = 50;

    private const CURSOR_KEY = 'sync_pull_cursor';

    private const LAST_RUN_KEY = 'sync_last_run';

    public function enabled(): bool
    {
        return (bool) config('services.sync.is_clinic')
            && config('services.sync.portal_url')
            && config('services.sync.secret');
    }

    /** Push then pull. The summary is also saved for the status view. */
    public function run(): array
    {
        if (! $this->enabled()) {
            return ['status' => 'disabled', 'message' => 'Sync is off on this computer (set SYNC_IS_CLINIC, SYNC_PORTAL_URL and SYNC_SECRET).'];
        }

        $push = $this->push();
        $pull = $push['status'] === 'offline'
            ? ['status' => 'offline', 'received' => 0]
            : $this->pull();

        $summary = [
            'status' => ($push['status'] === 'offline' || $pull['status'] === 'offline') ? 'offline'
                : (($push['status'] === 'error' || $pull['status'] === 'error') ? 'error' : 'ok'),
            'at' => now()->toIso8601String(),
            'push' => $push,
            'pull' => $pull,
            'pending' => $this->pendingCount(),
        ];

        $this->setSetting(self::LAST_RUN_KEY, json_encode($summary));

        return $summary;
    }

    /** Kept for the scheduled command and the "sync now" endpoint. */
    public function pushToPortal(): array
    {
        return $this->run();
    }

    public function push(): array
    {
        $sent = 0;
        $counts = [];

        // Send in batches until the queue is empty or the cloud stops answering.
        for ($batch = 0; $batch < 50; $batch++) {
            $entries = SyncOutbox::query()
                ->whereIn('status', ['pending', 'failed'])
                ->where('retry_count', '<', self::MAX_RETRIES)
                ->orderBy('id')
                ->limit(self::PUSH_BATCH)
                ->get();

            if ($entries->isEmpty()) {
                break;
            }

            // Several edits to one record become one: its current state.
            $groups = $entries->groupBy(fn ($e) => $e->entity_type.'|'.$e->entity_uuid);
            $codec = new SyncCodec;
            $records = [];
            $entryIds = [];

            foreach ($groups as $key => $group) {
                [$type, $uuid] = explode('|', $key, 2);
                $ids = $group->pluck('id')->all();

                if (! SyncSchema::has($type) || $uuid === '') {
                    $this->finishEntries($ids, 'Not a synced record type.');

                    continue;
                }

                $row = DB::table(SyncSchema::table($type))->where('uuid', $uuid)->first();
                $records[] = $row
                    ? ['type' => $type, 'uuid' => $uuid, 'action' => 'upsert', 'record' => $codec->export($type, $row)]
                    : ['type' => $type, 'uuid' => $uuid, 'action' => 'delete'];
                $entryIds[$type.'|'.$uuid] = $ids;
            }

            if ($records === []) {
                continue;
            }

            usort($records, fn ($a, $b) => SyncSchema::order($a['type']) <=> SyncSchema::order($b['type']));

            try {
                $response = $this->send('POST', '/api/sync/push', ['records' => $records]);
            } catch (ConnectionException $e) {
                return ['status' => 'offline', 'sent' => $sent, 'counts' => $counts, 'message' => 'Cloud not reachable; changes stay queued.'];
            }

            if (! $response->successful()) {
                // The cloud answered but refused the whole batch (wrong secret,
                // sync not enabled there, server error). Not the records' fault,
                // so their retries are not used up.
                $message = 'Cloud answered '.$response->status().': '.mb_substr((string) ($response->json('message') ?? $response->body()), 0, 200);
                SyncOutbox::whereIn('id', collect($entryIds)->flatten())->update(['status' => 'pending', 'error_message' => $message]);
                Log::warning('[sync] push refused', ['status' => $response->status()]);

                return ['status' => 'error', 'sent' => $sent, 'counts' => $counts, 'message' => $message];
            }

            foreach ($response->json('results', []) as $result) {
                $key = $result['type'].'|'.$result['uuid'];
                $ids = $entryIds[$key] ?? [];
                $status = $result['status'] ?? 'error';
                $counts[$status] = ($counts[$status] ?? 0) + 1;

                if ($status === 'error') {
                    SyncOutbox::whereIn('id', $ids)->increment('retry_count', 1, [
                        'status' => 'failed',
                        'error_message' => mb_substr((string) ($result['error'] ?? 'Rejected by the cloud.'), 0, 500),
                    ]);

                    continue;
                }

                $this->finishEntries($ids, $status === 'renamed' ? 'Renamed in the cloud: '.json_encode($result['renamed'] ?? []) : null);
                if ($status !== 'deleted') {
                    $this->markRowSynced(SyncSchema::table($result['type']), $result['uuid']);
                }
                $sent++;
            }

            // A batch that made no progress (every record waiting on something)
            // would otherwise be sent again straight away.
            if (! collect($response->json('results', []))->contains(fn ($r) => ($r['status'] ?? '') !== 'error')) {
                break;
            }
        }

        return ['status' => 'ok', 'sent' => $sent, 'counts' => $counts];
    }

    public function pull(): array
    {
        $cursor = json_decode((string) $this->getSetting(self::CURSOR_KEY), true) ?: [];
        $clinicId = (int) config('services.sync.clinic_id');
        $received = 0;
        $counts = [];
        $errors = [];

        for ($page = 0; $page < self::PULL_PAGES; $page++) {
            try {
                $response = $this->send('GET', '/api/sync/pull', ['cursor' => json_encode($cursor, JSON_UNESCAPED_SLASHES)]);
            } catch (ConnectionException $e) {
                return ['status' => 'offline', 'received' => $received, 'counts' => $counts];
            }

            if (! $response->successful()) {
                return ['status' => 'error', 'received' => $received, 'counts' => $counts,
                    'message' => 'Cloud answered '.$response->status().': '.mb_substr((string) ($response->json('message') ?? $response->body()), 0, 200)];
            }

            $codec = new SyncCodec;
            foreach ($response->json('records', []) as $r) {
                $result = $codec->apply($r['type'], $r['uuid'], $r['record'], $clinicId);
                $counts[$result['status']] = ($counts[$result['status']] ?? 0) + 1;
                if ($result['status'] === 'error') {
                    $errors[] = $r['type'].' '.$r['uuid'].': '.$result['error'];
                }
                $received++;
            }

            $cursor = $response->json('cursor', $cursor);
            $this->setSetting(self::CURSOR_KEY, json_encode($cursor, JSON_UNESCAPED_SLASHES));

            if (! $response->json('more')) {
                break;
            }
        }

        if ($errors) {
            Log::warning('[sync] pull could not apply some records', ['errors' => array_slice($errors, 0, 20)]);
        }

        return ['status' => 'ok', 'received' => $received, 'counts' => $counts, 'errors' => array_slice($errors, 0, 5)];
    }

    /**
     * Start pulling from now on, for a clinic database that is already a copy
     * of the cloud (so the first pull does not re-download everything).
     */
    public function startPullFromNow(): void
    {
        $now = now()->format('Y-m-d H:i:s');
        $cursor = [];
        foreach (SyncSchema::ENTITIES as $schema) {
            $cursor[$schema['table']] = [$now, 0];
        }
        $this->setSetting(self::CURSOR_KEY, json_encode($cursor));
    }

    /** Mark everything queued so far as handled, so only new changes are sent. */
    public function skipQueued(): int
    {
        return SyncOutbox::whereIn('status', ['pending', 'failed', 'processing'])
            ->update(['status' => 'synced', 'processed_at' => now(), 'error_message' => 'Skipped when sync was set up.']);
    }

    public function status(): array
    {
        return [
            'enabled' => $this->enabled(),
            'cloud' => config('services.sync.portal_url'),
            'pending' => $this->pendingCount(),
            'failed' => SyncOutbox::where('status', 'failed')->count(),
            'gave_up' => SyncOutbox::where('status', 'failed')->where('retry_count', '>=', self::MAX_RETRIES)->count(),
            'last_run' => json_decode((string) $this->getSetting(self::LAST_RUN_KEY), true),
        ];
    }

    public function pendingCount(): int
    {
        return SyncOutbox::whereIn('status', ['pending', 'failed'])->where('retry_count', '<', self::MAX_RETRIES)->count();
    }

    private function send(string $method, string $path, array $data): Response
    {
        $secret = (string) config('services.sync.secret');
        $url = rtrim((string) config('services.sync.portal_url'), '/').$path;
        $timestamp = time();

        if ($method === 'GET') {
            $content = SyncSignature::canonicalQuery($data);
            $request = Http::timeout(60)->connectTimeout(10)->acceptJson()->withHeaders([
                SyncSignature::HEADER_TIMESTAMP => $timestamp,
                SyncSignature::HEADER_SIGNATURE => SyncSignature::sign($secret, $timestamp, 'GET', $path, $content),
            ]);

            return $request->get($url.'?'.$content);
        }

        $body = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return Http::timeout(120)->connectTimeout(10)->acceptJson()->withHeaders([
            SyncSignature::HEADER_TIMESTAMP => $timestamp,
            SyncSignature::HEADER_SIGNATURE => SyncSignature::sign($secret, $timestamp, 'POST', $path, $body),
        ])->withBody($body, 'application/json')->post($url);
    }

    private function finishEntries(array $ids, ?string $note): void
    {
        SyncOutbox::whereIn('id', $ids)->update(['status' => 'synced', 'processed_at' => now(), 'error_message' => $note]);
    }

    /** Quietly: going through the model would queue the record to be sent again. */
    private function markRowSynced(string $table, string $uuid): void
    {
        DB::table($table)->where('uuid', $uuid)->update(['sync_status' => 'synced', 'synced_at' => now()]);
    }

    private function getSetting(string $key): ?string
    {
        return DB::table('settings')->where('key', $key)->value('value');
    }

    private function setSetting(string $key, string $value): void
    {
        $exists = DB::table('settings')->where('key', $key)->exists();
        $now = now();

        if ($exists) {
            DB::table('settings')->where('key', $key)->update(['value' => $value, 'updated_at' => $now]);
        } else {
            DB::table('settings')->insert([
                'clinic_id' => (int) config('services.sync.clinic_id'),
                'key' => $key,
                'value' => $value,
                'sync_scope' => 'local',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
