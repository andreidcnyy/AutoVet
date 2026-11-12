<?php

namespace App\Support\Sync;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turns a database row into a record that means the same thing on the other
 * database (export), and writes such a record into this database (apply).
 *
 * Rows are read and written with the query builder, never through Eloquent:
 *  - no model events fire, so a received record is not queued to be sent back
 *    (no ping-pong), and finalizing a synced invoice does not deduct stock a
 *    second time; the stock level arrives as its own synced inventory record;
 *  - timestamps are copied as they are, so "latest edit wins" compares the
 *    times the edits were really made, not the time they were received.
 */
class SyncCodec
{
    /** Per-instance caches; one codec is used for one batch. */
    private array $columns = [];

    private array $lookupCache = [];

    /**
     * A row from this database as a portable record:
     *   ['data' => plain columns, 'refs' => [column => uuid], 'lookups' => [column => natural key]]
     */
    public function export(string $type, object $row): array
    {
        $schema = SyncSchema::ENTITIES[$type];
        $data = (array) $row;

        foreach (SyncSchema::LOCAL_COLUMNS as $col) {
            unset($data[$col]);
        }

        $refs = [];
        foreach ($schema['uuid_refs'] as $col => $table) {
            $id = $data[$col] ?? null;
            unset($data[$col]);
            $refs[$col] = $id === null ? null : $this->uuidOf($table, $id);
        }

        $lookups = [];
        foreach ($schema['natural_refs'] as $col => $kind) {
            if (! array_key_exists($col, $data)) {
                continue;
            }
            $id = $data[$col];
            unset($data[$col]);
            $lookups[$col] = $id === null ? null : $this->naturalKeyOf($kind, $id);
        }

        return ['data' => $data, 'refs' => $refs, 'lookups' => $lookups];
    }

    /**
     * Apply one incoming record to this database.
     *
     * $record null means the record was deleted on the other side.
     * Returns ['status' => applied|unchanged|kept_newer|deleted|renamed|error, ...].
     */
    public function apply(string $type, string $uuid, ?array $record, int $clinicId): array
    {
        if (! SyncSchema::has($type)) {
            return ['status' => 'error', 'error' => "Unknown record type {$type}."];
        }

        $table = SyncSchema::table($type);
        $existing = DB::table($table)->where('uuid', $uuid)->first();

        if ($record === null) {
            if ($existing) {
                DB::table($table)->where('id', $existing->id)->delete();
            }

            return ['status' => 'deleted'];
        }

        // Latest edit wins. A record that is older than what is already here is
        // a stale copy: keep ours. Same time means it is the same edit coming
        // back, so there is nothing to do.
        $incomingAt = $this->time($record['data']['updated_at'] ?? null);
        if ($existing) {
            $currentAt = $this->time($existing->updated_at ?? null);
            if ($currentAt !== null && $incomingAt !== null) {
                if ($currentAt > $incomingAt) {
                    return ['status' => 'kept_newer'];
                }
                if ($currentAt === $incomingAt) {
                    return ['status' => 'unchanged'];
                }
            }
        }

        $row = $record['data'] ?? [];
        $row['uuid'] = $uuid;

        foreach (SyncSchema::ENTITIES[$type]['uuid_refs'] as $col => $refTable) {
            $refUuid = $record['refs'][$col] ?? null;
            if ($refUuid === null) {
                $row[$col] = null;

                continue;
            }
            $id = DB::table($refTable)->where('uuid', $refUuid)->value('id');
            if ($id === null) {
                // The parent has not arrived yet. Fail so the sender retries;
                // writing a NULL here would silently detach the record.
                return ['status' => 'error', 'error' => "Linked {$refTable} record {$refUuid} for {$col} is not here yet."];
            }
            $row[$col] = $id;
        }

        foreach (SyncSchema::ENTITIES[$type]['natural_refs'] as $col => $kind) {
            if (! array_key_exists($col, $record['lookups'] ?? [])) {
                continue;
            }
            $key = $record['lookups'][$col];
            $row[$col] = $key === null ? null : $this->idByNaturalKey($kind, $key, $clinicId);
        }

        $row['clinic_id'] = $clinicId;
        $row['sync_status'] = 'synced';
        $row['synced_at'] = now()->format('Y-m-d H:i:s');

        // Only columns this database has, in case one side is a migration ahead.
        $row = array_intersect_key($row, array_flip($this->columnsOf($table)));

        $renamed = $this->resolveUniqueClashes($table, $row, $existing?->id);

        try {
            DB::transaction(function () use ($table, $row, $existing) {
                if ($existing) {
                    DB::table($table)->where('id', $existing->id)->update($row);
                } else {
                    DB::table($table)->insert($row);
                }
            });
        } catch (QueryException $e) {
            return ['status' => 'error', 'error' => 'Database rejected the record: '.$this->shortError($e)];
        }

        return $renamed
            ? ['status' => 'renamed', 'renamed' => $renamed]
            : ['status' => 'applied'];
    }

    /**
     * Give a colliding unique value (invoice number, SKU) a suffix taken from
     * the record's uuid. Returns what was renamed, if anything.
     */
    private function resolveUniqueClashes(string $table, array &$row, ?int $ownId): array
    {
        $renamed = [];
        foreach (SyncSchema::UNIQUE_COLUMNS[$table] ?? [] as $col) {
            $value = $row[$col] ?? null;
            if ($value === null || $value === '') {
                continue;
            }
            $clash = DB::table($table)->where($col, $value)
                ->when($ownId, fn ($q) => $q->where('id', '!=', $ownId))
                ->exists();
            if ($clash) {
                $row[$col] = $value.'-'.strtoupper(substr($row['uuid'], 0, 4));
                $renamed[$col] = [$value, $row[$col]];
            }
        }

        return $renamed;
    }

    private function uuidOf(string $table, $id): ?string
    {
        return $this->lookupCache["uuid:{$table}:{$id}"]
            ??= DB::table($table)->where('id', $id)->value('uuid');
    }

    /** The natural key of a reference row (e-mail, name), for export. */
    private function naturalKeyOf(string $kind, $id): ?array
    {
        $cacheKey = "nk:{$kind}:{$id}";
        if (array_key_exists($cacheKey, $this->lookupCache)) {
            return $this->lookupCache[$cacheKey];
        }

        $lookup = SyncSchema::LOOKUPS[$kind];
        $row = DB::table($lookup['table'])->where('id', $id)->first();
        $key = null;
        if ($row) {
            $key = [$lookup['key'] => $row->{$lookup['key']}];
            if ($kind === 'breed') {
                $key['species'] = DB::table('species')->where('id', $row->species_id)->value('name');
            }
        }

        return $this->lookupCache[$cacheKey] = $key;
    }

    /**
     * This database's id for a natural key, preferring rows of the receiving
     * clinic. Unknown keys become NULL (e.g. a staff account that exists on
     * only one side); a column that cannot be NULL is then rejected by the
     * database and reported as an error.
     */
    private function idByNaturalKey(string $kind, array $key, int $clinicId): ?int
    {
        $cacheKey = 'id:'.$kind.':'.$clinicId.':'.json_encode($key);
        if (array_key_exists($cacheKey, $this->lookupCache)) {
            return $this->lookupCache[$cacheKey];
        }

        $lookup = SyncSchema::LOOKUPS[$kind];
        $col = $lookup['key'];
        $query = DB::table($lookup['table'].' as t')->where("t.{$col}", $key[$col] ?? null);

        if ($kind === 'breed') {
            $query->join('species as s', 's.id', '=', 't.species_id')
                ->where('s.name', $key['species'] ?? null);
        }

        if (in_array('clinic_id', $this->columnsOf($lookup['table']), true)) {
            $query->orderByRaw('t.clinic_id = ? desc', [$clinicId]);
        }

        $id = $query->value('t.id');

        return $this->lookupCache[$cacheKey] = $id === null ? null : (int) $id;
    }

    private function columnsOf(string $table): array
    {
        return $this->columns[$table] ??= Schema::getColumnListing($table);
    }

    private function time($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $t = strtotime((string) $value);

        return $t === false ? null : $t;
    }

    private function shortError(QueryException $e): string
    {
        // The driver message without the SQL and bound values.
        $message = $e->getPrevious()?->getMessage() ?? $e->getMessage();

        return mb_substr(preg_replace('/\s*\(Connection:.*$/s', '', $message), 0, 300);
    }
}
