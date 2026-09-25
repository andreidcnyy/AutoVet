<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Copies the production database down into the local one, so a developer can
 * inspect real data locally.
 *
 * Strictly one-way. The live connection is opened read-only and never written
 * to; every write in here targets the local default connection. That asymmetry
 * is the whole point: it gives you production data to look at without putting
 * production one `migrate:fresh` away from being destroyed.
 *
 * Run it with:  php artisan db:pull-live
 */
class PullLiveDatabase extends Command
{
    protected $signature = 'db:pull-live
        {--force : Skip the confirmation prompt}
        {--chunk=500 : Rows to insert per batch}
        {--only= : Comma-separated list of tables to copy instead of all}
        {--password= : After copying, set every admin and portal password to this, so you can log in locally}';

    protected $description = 'Replace the local database with a copy of the live one (one-way, read-only on live)';

    /**
     * Tables that hold no business data and are meaningless outside the machine
     * that wrote them. Copying sessions or cache rows down just imports noise,
     * and personal_access_tokens would carry live users' API tokens onto a
     * developer laptop.
     */
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

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('Refusing to run: this would overwrite a production database.');

            return self::FAILURE;
        }

        $this->loadLiveEnv();

        if (!config('database.connections.live.host')) {
            $this->error('No live connection configured.');
            $this->newLine();
            $this->line('Copy backend/.env.live.example to backend/.env.live and fill in the values from');
            $this->line('Render -> your web service -> Environment:');
            $this->newLine();
            $this->line('  LIVE_DB_HOST=gateway01.<region>.prod.aws.tidbcloud.com');
            $this->line('  LIVE_DB_PORT=4000');
            $this->line('  LIVE_DB_DATABASE=autovet');
            $this->line('  LIVE_DB_USERNAME=<the TiDB user>');
            $this->line('  LIVE_DB_PASSWORD=<the TiDB password>');
            $this->line('  LIVE_DB_SSL_CA=C:/xampp/apache/bin/curl-ca-bundle.crt');

            return self::FAILURE;
        }

        $localName = DB::connection()->getDatabaseName();
        $liveHost = config('database.connections.live.host');

        $this->newLine();
        $this->line("  from  <fg=yellow>{$liveHost}</> (read-only)");
        $this->line("  into  <fg=yellow>{$localName}</> on " . config('database.connections.mysql.host'));
        $this->newLine();

        if (!$this->option('force') && !$this->confirm("Every row in the local '{$localName}' database will be replaced. Continue?")) {
            $this->line('Aborted.');

            return self::SUCCESS;
        }

        try {
            DB::connection('live')->getPdo();
        } catch (Throwable $e) {
            $this->error('Could not reach the live database: ' . $e->getMessage());

            return self::FAILURE;
        }

        if (!$this->schemaMatches()) {
            return self::FAILURE;
        }

        $tables = $this->tablesToCopy();
        if ($tables === []) {
            $this->error('No matching tables to copy.');

            return self::FAILURE;
        }

        $copied = $this->copy($tables);

        if ($password = $this->option('password')) {
            $this->resetPasswords($password);
        }

        $this->report($copied);

        return self::SUCCESS;
    }

    /**
     * Laravel only reads .env, so the live credentials are loaded here instead.
     * Keeping them in their own gitignored file means they are never in the
     * environment during an ordinary artisan run, and deleting one file is
     * enough to revoke this machine's access to production.
     */
    private function loadLiveEnv(): void
    {
        $path = base_path('.env.live');
        if (!is_file($path)) {
            return;
        }

        $overrides = [];

        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            if (!str_starts_with($key, 'LIVE_DB_')) {
                continue;
            }

            $overrides[$key] = trim(trim($value), "\"'");
        }

        if ($overrides === []) {
            return;
        }

        Config::set('database.connections.live', array_merge(
            config('database.connections.live'),
            array_filter([
                'host' => $overrides['LIVE_DB_HOST'] ?? null,
                'port' => $overrides['LIVE_DB_PORT'] ?? null,
                'database' => $overrides['LIVE_DB_DATABASE'] ?? null,
                'username' => $overrides['LIVE_DB_USERNAME'] ?? null,
                'password' => $overrides['LIVE_DB_PASSWORD'] ?? null,
            ], fn($v) => $v !== null),
            ['options' => extension_loaded('pdo_mysql') ? array_filter([
                \PDO::MYSQL_ATTR_SSL_CA => $overrides['LIVE_DB_SSL_CA'] ?? null,
                \PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT
                    => filter_var($overrides['LIVE_DB_SSL_VERIFY'] ?? 'true', FILTER_VALIDATE_BOOLEAN),
            ], fn($v) => $v !== null && $v !== '') : []]
        ));

        DB::purge('live');
    }

    /**
     * A row copy only makes sense onto an identical schema. If local is behind
     * or ahead of live, inserts fail halfway through on a missing column and
     * leave the local database in a torn state — better to stop up front.
     */
    private function schemaMatches(): bool
    {
        $liveCount = DB::connection('live')->table('migrations')->count();
        $localCount = DB::table('migrations')->count();

        if ($liveCount === $localCount) {
            return true;
        }

        $this->newLine();
        $this->error("Schema mismatch: live has {$liveCount} migrations, local has {$localCount}.");

        $live = DB::connection('live')->table('migrations')->pluck('migration')->all();
        $local = DB::table('migrations')->pluck('migration')->all();

        foreach (array_diff($live, $local) as $m) {
            $this->line("  <fg=red>only on live</>  {$m}");
        }
        foreach (array_diff($local, $live) as $m) {
            $this->line("  <fg=yellow>only on local</> {$m}");
        }

        $this->newLine();
        $this->line('Run `php artisan migrate` on whichever side is behind, then try again.');

        return false;
    }

    /** Tables present on both sides, in the order live reports them. */
    private function tablesToCopy(): array
    {
        $only = $this->option('only')
            ? array_map('trim', explode(',', $this->option('only')))
            : null;

        $liveTables = array_map(
            fn($row) => array_values((array) $row)[0],
            DB::connection('live')->select('SHOW TABLES')
        );

        $out = [];
        foreach ($liveTables as $table) {
            if (in_array($table, self::SKIP_TABLES, true)) {
                continue;
            }
            if ($only !== null && !in_array($table, $only, true)) {
                continue;
            }
            if (!Schema::hasTable($table)) {
                $this->warn("  skipping {$table} — not present locally");
                continue;
            }
            $out[] = $table;
        }

        return $out;
    }

    /**
     * @param  array<int,string>  $tables
     * @return array<string,array{live:int,local:int}>
     */
    private function copy(array $tables): array
    {
        $chunk = max(1, (int) $this->option('chunk'));
        $result = [];

        // Rows arrive in whatever order the tables are listed, which will not
        // respect parent-before-child, so constraints go off for the duration
        // and integrity is verified afterwards instead.
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            foreach ($tables as $table) {
                // Copy only the columns both sides share, so a column that
                // exists on one side alone cannot abort the whole run.
                $columns = array_values(array_intersect(
                    Schema::connection('live')->getColumnListing($table),
                    Schema::getColumnListing($table)
                ));

                if ($columns === []) {
                    $this->warn("  skipping {$table} — no columns in common");
                    continue;
                }

                DB::table($table)->truncate();

                $liveTotal = DB::connection('live')->table($table)->count();
                $written = 0;

                if ($liveTotal > 0) {
                    $bar = $this->output->createProgressBar($liveTotal);
                    $bar->setFormat("  %message:-26s% %current%/%max% [%bar%]");
                    $bar->setMessage($table);
                    $bar->start();

                    DB::connection('live')
                        ->table($table)
                        ->select($columns)
                        ->orderBy($this->orderColumn($table, $columns))
                        ->chunk($chunk, function ($rows) use ($table, &$written, $bar) {
                            $batch = array_map(fn($row) => (array) $row, $rows->all());
                            DB::table($table)->insert($batch);
                            $written += count($batch);
                            $bar->advance(count($batch));
                        });

                    $bar->finish();
                    $this->newLine();
                } else {
                    $this->line("  <fg=gray>{$table}</> — empty on live");
                }

                $result[$table] = ['live' => $liveTotal, 'local' => $written];
            }
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        return $result;
    }

    /** chunk() needs a deterministic order; most tables have an id. */
    private function orderColumn(string $table, array $columns): string
    {
        return in_array('id', $columns, true) ? 'id' : $columns[0];
    }

    /**
     * Live password hashes belong to real accounts whose passwords nobody here
     * knows, so a pulled copy is unusable until they are overwritten locally.
     * This only ever touches the local copy.
     */
    private function resetPasswords(string $password): void
    {
        $hash = bcrypt($password);
        $this->newLine();

        foreach (['admins', 'portal_users'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            $n = DB::table($table)->update(['password' => $hash]);
            $this->line("  reset {$n} {$table} password(s) to the one you supplied");
        }
    }

    /** @param array<string,array{live:int,local:int}> $copied */
    private function report(array $copied): void
    {
        $mismatched = array_filter($copied, fn($c) => $c['live'] !== $c['local']);

        $this->newLine();
        $this->line('  <fg=green>Copied ' . count($copied) . ' tables, '
            . number_format(array_sum(array_column($copied, 'local'))) . ' rows.</>');

        if ($mismatched !== []) {
            $this->newLine();
            $this->error('  Row counts differ on:');
            foreach ($mismatched as $table => $c) {
                $this->line("    {$table}: live {$c['live']}, local {$c['local']}");
            }
        }

        $orphans = $this->orphanCount();
        $this->line($orphans === 0
            ? '  <fg=green>Foreign keys: no orphans.</>'
            : "  <fg=red>Foreign keys: {$orphans} orphaned reference(s).</>");
    }

    /** Constraints were off during the copy, so confirm they still hold. */
    private function orphanCount(): int
    {
        $db = DB::connection()->getDatabaseName();

        $keys = DB::select(
            'SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL',
            [$db]
        );

        $total = 0;
        foreach ($keys as $k) {
            $total += DB::table($k->TABLE_NAME)
                ->whereNotNull($k->COLUMN_NAME)
                ->whereNotExists(function ($q) use ($k) {
                    $q->select(DB::raw(1))
                        ->from($k->REFERENCED_TABLE_NAME)
                        ->whereColumn(
                            "{$k->REFERENCED_TABLE_NAME}.{$k->REFERENCED_COLUMN_NAME}",
                            "{$k->TABLE_NAME}.{$k->COLUMN_NAME}"
                        );
                })
                ->count();
        }

        return $total;
    }
}
