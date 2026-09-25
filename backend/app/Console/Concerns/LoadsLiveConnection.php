<?php

namespace App\Console\Concerns;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

/**
 * Configures the `live` database connection from backend/.env.live.
 *
 * Laravel only reads .env, so the production credentials live in their own
 * gitignored file and are loaded on demand by the handful of commands that
 * legitimately talk to production. Nothing else in the app can reach it, and
 * deleting that one file revokes this machine's access.
 */
trait LoadsLiveConnection
{
    protected function loadLiveEnv(): bool
    {
        $path = base_path('.env.live');

        if (!is_file($path)) {
            return (bool) config('database.connections.live.host');
        }

        $values = [];

        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);

            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);

            if (str_starts_with($key, 'LIVE_DB_')) {
                $values[$key] = trim(trim($value), "\"'");
            }
        }

        if ($values === []) {
            return (bool) config('database.connections.live.host');
        }

        Config::set('database.connections.live', array_merge(
            config('database.connections.live'),
            array_filter([
                'host' => $values['LIVE_DB_HOST'] ?? null,
                'port' => $values['LIVE_DB_PORT'] ?? null,
                'database' => $values['LIVE_DB_DATABASE'] ?? null,
                'username' => $values['LIVE_DB_USERNAME'] ?? null,
                'password' => $values['LIVE_DB_PASSWORD'] ?? null,
            ], fn($v) => $v !== null),
            ['options' => extension_loaded('pdo_mysql') ? array_filter([
                \PDO::MYSQL_ATTR_SSL_CA => $values['LIVE_DB_SSL_CA'] ?? null,
                \PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT
                    => filter_var($values['LIVE_DB_SSL_VERIFY'] ?? 'true', FILTER_VALIDATE_BOOLEAN),
            ], fn($v) => $v !== null && $v !== '') : []]
        ));

        DB::purge('live');

        return (bool) config('database.connections.live.host');
    }

    /** The message shown when .env.live is missing or empty. */
    protected function explainMissingLiveConfig(): void
    {
        $this->error('No live connection configured.');
        $this->newLine();
        $this->line('Copy backend/.env.live.example to backend/.env.live and fill in the values');
        $this->line('from Render -> your web service -> Environment.');
    }
}
