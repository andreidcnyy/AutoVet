<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fills in the sync identity columns that bulk inserts left empty.
 *
 * HasSyncFields sets uuid and last_modified_locally_at from Eloquent's creating
 * event, so anything written with DB::table()->insert() — the AI-training bulk
 * loads, and seeders that insert in batches — skips them entirely. On live that
 * left 84,161 of 84,197 appointments with a NULL uuid.
 *
 * Why uuid matters: it is the identity the clinic/portal sync matches rows on.
 * SyncController deletes with where('uuid', $uuid) and SyncService looks rows up
 * the same way, so a row without one can never be matched, updated or removed by
 * a sync. Nothing is broken today because that sync has never run, but every
 * affected row is invisible to it the moment it is switched on.
 *
 * Deliberately NOT a migration. A migration would run on the next deploy and
 * write to production without anyone choosing that; this has to be invoked.
 *
 * synced_at is left alone on purpose — see the note in handle().
 */
class BackfillSyncUuids extends Command
{
    protected $signature = 'db:backfill-sync-uuids
        {--database= : Database to work on. Defaults to the configured one}
        {--dry-run : Report what would change and write nothing}';

    protected $description = 'Give bulk-inserted rows the uuid and local-modified stamp that Eloquent would have set';

    public function handle(): int
    {
        if ($target = $this->option('database')) {
            if (!preg_match('/^[A-Za-z0-9_]+$/', $target)) {
                $this->error("Refusing to use '{$target}' as a database name.");

                return self::FAILURE;
            }

            Config::set('database.connections.mysql.database', $target);
            DB::purge('mysql');
            DB::setDefaultConnection('mysql');
        }

        $dry = $this->option('dry-run');

        $this->line('  database: <fg=yellow>' . DB::connection()->getDatabaseName() . '</>'
            . ($dry ? '  <fg=cyan>(dry run)</>' : ''));
        $this->newLine();

        $tables = $this->tablesWithSyncColumns();
        if ($tables === []) {
            $this->info('  No tables carry sync columns.');

            return self::SUCCESS;
        }

        $uuids = 0;
        $stamps = 0;

        printf("  %-28s %12s %12s\n", 'table', 'uuid', 'last_mod');

        foreach ($tables as $table => $columns) {
            $u = 0;
            $s = 0;

            if (in_array('uuid', $columns, true)) {
                $pending = DB::table($table)->whereNull('uuid')->count();

                if ($pending > 0) {
                    // One statement for the whole table: MySQL and TiDB both
                    // evaluate UUID() per row, so this cannot collide with the
                    // unique index the way a single reused value would.
                    if (!$dry) {
                        DB::statement("UPDATE `{$table}` SET `uuid` = UUID() WHERE `uuid` IS NULL");
                    }
                    $u = $pending;
                    $uuids += $pending;
                }
            }

            if (in_array('last_modified_locally_at', $columns, true)) {
                $pending = DB::table($table)->whereNull('last_modified_locally_at')->count();

                if ($pending > 0) {
                    // Use the row's own timestamps rather than now(), so the
                    // column keeps meaning "when this last changed locally"
                    // instead of "when this backfill ran".
                    $expr = in_array('created_at', $columns, true)
                        ? 'COALESCE(`updated_at`, `created_at`, NOW())'
                        : 'COALESCE(`updated_at`, NOW())';

                    if (!$dry) {
                        DB::statement(
                            "UPDATE `{$table}` SET `last_modified_locally_at` = {$expr}
                             WHERE `last_modified_locally_at` IS NULL"
                        );
                    }
                    $s = $pending;
                    $stamps += $pending;
                }
            }

            if ($u > 0 || $s > 0) {
                printf("  %-28s %12s %12s\n", $table, number_format($u), number_format($s));
            }
        }

        $this->newLine();
        $this->info(sprintf(
            '  %s %s uuid(s) and %s local-modified stamp(s).',
            $dry ? 'Would set' : 'Set',
            number_format($uuids),
            number_format($stamps)
        ));

        // synced_at records when a row was last pushed to the other instance.
        // Every row is still sync_status = local_only, meaning that push has
        // never happened, so NULL is the truthful value. Filling it would claim
        // a sync that did not occur and would stop those rows from being picked
        // up when the feature is finally switched on.
        $this->newLine();
        $this->line('  <fg=gray>synced_at left NULL on purpose: no row has ever been synced,</>');
        $this->line('  <fg=gray>so a timestamp there would record something that never happened.</>');

        return self::SUCCESS;
    }

    /** @return array<string,array<int,string>> table => its sync columns */
    private function tablesWithSyncColumns(): array
    {
        $rows = DB::select(
            "SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ?
               AND COLUMN_NAME IN ('uuid','last_modified_locally_at','created_at','updated_at')",
            [DB::connection()->getDatabaseName()]
        );

        $out = [];
        foreach ($rows as $r) {
            $out[$r->t][] = $r->c;
        }

        // Only tables that actually have something to fill.
        return array_filter(
            $out,
            fn($cols, $t) => Schema::hasTable($t)
                && (in_array('uuid', $cols, true) || in_array('last_modified_locally_at', $cols, true)),
            ARRAY_FILTER_USE_BOTH
        );
    }
}
