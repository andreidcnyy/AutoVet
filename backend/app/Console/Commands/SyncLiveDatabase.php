<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Brings a local copy up to date with production, incrementally.
 *
 * db:pull-live takes a full snapshot, which is too slow to repeat often. This
 * compares keys instead: it reads (id, updated_at) from both sides, works out
 * what actually differs, and only transfers those rows. A run where nothing has
 * changed on live costs one lightweight query per table.
 *
 * Deliberately stateless. There is no watermark table and no last-run
 * timestamp, because a watermark based on updated_at would silently skip rows —
 * 84k appointments on live carry a NULL updated_at, having been bulk inserted
 * past Eloquent. Comparing keys cannot miss those, and unlike a watermark it
 * also notices deletions.
 *
 * Still strictly one-way: live is read, local is written.
 *
 *   php artisan db:sync-live --database=autovet_live
 */
class SyncLiveDatabase extends Command
{
    protected $signature = 'db:sync-live
        {--database= : Local database to bring up to date. Defaults to the configured one}
        {--chunk=1000 : Rows to transfer per batch}
        {--no-delete : Keep local rows that no longer exist on live}
        {--quiet-when-clean : Print nothing if nothing changed, for scheduled runs}';

    protected $description = 'Incrementally update a local copy from the live database (one-way)';

    /** Machine-local tables, same exclusions as db:pull-live. */
    private const SKIP_TABLES = [
        'migrations',
        'cache',
        'cache_locks',
        'sessions',
        'jobs',
        'job_batches',
        'failed_jobs',
        'password_reset_tokens',
        'personal_access_tokens',
    ];

    /**
     * Columns never overwritten on rows that already exist locally.
     *
     * Passwords in a pulled copy are deliberately reset to something usable, so
     * re-syncing must not put the production hashes back and lock you out again.
     */
    private const PRESERVE_ON_UPDATE = ['password'];

    /**
     * Identity columns that a NULL from live must not erase locally.
     *
     * Bulk inserts on live left uuid empty on ~109k rows, and
     * db:backfill-sync-uuids fills those in on the copy. Without this rule the
     * next time live touched such a row, its NULL would be copied straight over
     * the backfilled value and undo the repair. A real uuid arriving from live
     * still wins; only NULL is ignored.
     */
    private const NEVER_NULLED_BY_LIVE = ['uuid', 'last_modified_locally_at'];

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('Refusing to run against a production environment.');

            return self::FAILURE;
        }

        if (!$this->loadLiveEnv()) {
            $this->error('No live connection configured. See backend/.env.live.example.');

            return self::FAILURE;
        }

        if (!$this->selectTarget()) {
            return self::FAILURE;
        }

        try {
            DB::connection('live')->getPdo();
        } catch (Throwable $e) {
            $this->error('Could not reach the live database: ' . $e->getMessage());

            return self::FAILURE;
        }

        $started = microtime(true);
        $stats = ['inserted' => 0, 'updated' => 0, 'deleted' => 0, 'tables' => 0];

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            foreach ($this->tables() as $table) {
                $changed = $this->syncTable($table);

                if (array_sum($changed) > 0) {
                    $stats['tables']++;
                    $stats['inserted'] += $changed['inserted'];
                    $stats['updated'] += $changed['updated'];
                    $stats['deleted'] += $changed['deleted'];

                    $this->line(sprintf(
                        '  %-28s +%d ~%d -%d',
                        $table,
                        $changed['inserted'],
                        $changed['updated'],
                        $changed['deleted']
                    ));
                }
            }
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        $elapsed = round(microtime(true) - $started, 1);
        $touched = $stats['inserted'] + $stats['updated'] + $stats['deleted'];

        if ($touched === 0) {
            if (!$this->option('quiet-when-clean')) {
                $this->info("  Already up to date with live ({$elapsed}s).");
            }

            return self::SUCCESS;
        }

        $summary = sprintf(
            '%d row(s) across %d table(s): %d new, %d changed, %d removed (%ss)',
            $touched,
            $stats['tables'],
            $stats['inserted'],
            $stats['updated'],
            $stats['deleted'],
            $elapsed
        );

        $this->newLine();
        $this->info('  Synced ' . $summary);
        Log::info('db:sync-live ' . $summary);

        return self::SUCCESS;
    }

    /**
     * Works out what differs for one table and moves only that.
     *
     * @return array{inserted:int,updated:int,deleted:int}
     */
    private function syncTable(string $table): array
    {
        $none = ['inserted' => 0, 'updated' => 0, 'deleted' => 0];

        $columns = array_values(array_intersect(
            Schema::connection('live')->getColumnListing($table),
            Schema::getColumnListing($table)
        ));

        if (!in_array('id', $columns, true)) {
            // Without a key there is nothing to diff against; a full copy is
            // db:pull-live's job, not this command's.
            return $none;
        }

        $stamp = in_array('updated_at', $columns, true) ? 'updated_at' : null;
        $select = $stamp ? ['id', $stamp] : ['id'];

        $live = $this->keyMap(DB::connection('live')->table($table)->select($select)->get(), $stamp);
        $local = $this->keyMap(DB::table($table)->select($select)->get(), $stamp);

        $toInsert = array_keys(array_diff_key($live, $local));
        $toDelete = array_keys(array_diff_key($local, $live));

        $toUpdate = [];
        foreach (array_intersect_key($live, $local) as $id => $liveStamp) {
            // A NULL stamp on either side means the row was written past
            // Eloquent, so its timestamp says nothing about whether it changed.
            // Treat any difference, including NULL against a value, as changed.
            if ($liveStamp !== $local[$id]) {
                $toUpdate[] = $id;
            }
        }

        $result = $none;

        foreach (array_chunk($toInsert, (int) $this->option('chunk')) as $slice) {
            $rows = $this->fetchRows($table, $columns, $slice);
            if ($rows !== []) {
                DB::table($table)->insert($rows);
                $result['inserted'] += count($rows);
            }
        }

        $guarded = array_values(array_intersect(self::NEVER_NULLED_BY_LIVE, $columns));

        foreach (array_chunk($toUpdate, (int) $this->option('chunk')) as $slice) {
            // What the copy currently holds for the guarded columns, so a NULL
            // coming from live cannot wipe a value that was filled in here.
            $existing = $guarded === []
                ? []
                : DB::table($table)->whereIn('id', $slice)
                    ->get(array_merge(['id'], $guarded))
                    ->keyBy('id');

            foreach ($this->fetchRows($table, $columns, $slice) as $row) {
                $id = $row['id'];

                foreach (self::PRESERVE_ON_UPDATE as $keep) {
                    unset($row[$keep]);
                }

                foreach ($guarded as $col) {
                    if ($row[$col] === null && ($existing[$id]->{$col} ?? null) !== null) {
                        unset($row[$col]);
                    }
                }

                unset($row['id']);

                if ($row !== []) {
                    DB::table($table)->where('id', $id)->update($row);
                    $result['updated']++;
                }
            }
        }

        if (!$this->option('no-delete') && $toDelete !== []) {
            foreach (array_chunk($toDelete, (int) $this->option('chunk')) as $slice) {
                $result['deleted'] += DB::table($table)->whereIn('id', $slice)->delete();
            }
        }

        return $result;
    }

    /** @return array<int|string,mixed> id => comparison stamp */
    private function keyMap($rows, ?string $stamp): array
    {
        $out = [];
        foreach ($rows as $row) {
            $out[$row->id] = $stamp ? ($row->{$stamp} ?? null) : null;
        }

        return $out;
    }

    /** @return array<int,array<string,mixed>> */
    private function fetchRows(string $table, array $columns, array $ids): array
    {
        return array_map(
            fn($row) => (array) $row,
            DB::connection('live')->table($table)->select($columns)->whereIn('id', $ids)->get()->all()
        );
    }

    /** @return array<int,string> */
    private function tables(): array
    {
        $liveTables = array_map(
            fn($row) => array_values((array) $row)[0],
            DB::connection('live')->select('SHOW TABLES')
        );

        return array_values(array_filter(
            $liveTables,
            fn($t) => !in_array($t, self::SKIP_TABLES, true) && Schema::hasTable($t)
        ));
    }

    private function selectTarget(): bool
    {
        $target = $this->option('database');
        if (!$target) {
            return true;
        }

        if (!preg_match('/^[A-Za-z0-9_]+$/', $target)) {
            $this->error("Refusing to use '{$target}' as a database name.");

            return false;
        }

        Config::set('database.connections.mysql.database', $target);
        DB::purge('mysql');
        DB::setDefaultConnection('mysql');

        if (!Schema::hasTable('migrations')) {
            $this->error("'{$target}' has no schema. Run db:pull-live first to create it.");

            return false;
        }

        return true;
    }

    /** Same .env.live loader as db:pull-live; see the note there. */
    private function loadLiveEnv(): bool
    {
        $path = base_path('.env.live');
        if (!is_file($path)) {
            return (bool) config('database.connections.live.host');
        }

        $o = [];
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k);
            if (str_starts_with($k, 'LIVE_DB_')) {
                $o[$k] = trim(trim($v), "\"'");
            }
        }

        if ($o === []) {
            return (bool) config('database.connections.live.host');
        }

        Config::set('database.connections.live', array_merge(
            config('database.connections.live'),
            array_filter([
                'host' => $o['LIVE_DB_HOST'] ?? null,
                'port' => $o['LIVE_DB_PORT'] ?? null,
                'database' => $o['LIVE_DB_DATABASE'] ?? null,
                'username' => $o['LIVE_DB_USERNAME'] ?? null,
                'password' => $o['LIVE_DB_PASSWORD'] ?? null,
            ], fn($v) => $v !== null),
            ['options' => extension_loaded('pdo_mysql') ? array_filter([
                \PDO::MYSQL_ATTR_SSL_CA => $o['LIVE_DB_SSL_CA'] ?? null,
                \PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT
                    => filter_var($o['LIVE_DB_SSL_VERIFY'] ?? 'true', FILTER_VALIDATE_BOOLEAN),
            ], fn($v) => $v !== null && $v !== '') : []]
        ));

        DB::purge('live');

        return (bool) config('database.connections.live.host');
    }
}
