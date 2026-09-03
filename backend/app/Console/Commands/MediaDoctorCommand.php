<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Reports why a stored image reference does or does not resolve to a servable
 * URL, for every row that holds one.
 *
 * Run this on whichever environment is actually showing broken images -- the
 * shape of these columns differs between local and deployed databases, and
 * that difference is the whole problem.
 */
class MediaDoctorCommand extends Command
{
    protected $signature = 'media:doctor {--limit=200 : Maximum rows to inspect per column}';

    protected $description = 'Diagnose why stored image references fail to resolve';

    private const SUPABASE_URL = '#^https?://[^/]*supabase\.(?:co|in)/storage/v1/(?:object/(?:public|authenticated|sign)|s3)/[^/]+/(.+)$#i';

    private const TARGETS = [
        ['pets', 'photo'],
        ['settings', 'value'],
        ['admins', 'avatar'],
        ['portal_users', 'avatar'],
    ];

    public function handle(): int
    {
        $this->line('DB: ' . DB::connection()->getDatabaseName()
            . '   env: ' . app()->environment()
            . '   FILESYSTEM_PUBLIC: ' . var_export(env('FILESYSTEM_PUBLIC'), true));

        $hasStore = DB::getSchemaBuilder()->hasTable('stored_files');
        $this->line('stored_files rows: ' . ($hasStore ? DB::table('stored_files')->count() : 'TABLE MISSING'));
        $this->newLine();

        $tally = [];

        foreach (self::TARGETS as [$table, $column]) {
            if (!DB::getSchemaBuilder()->hasTable($table) || !DB::getSchemaBuilder()->hasColumn($table, $column)) {
                continue;
            }

            $rows = DB::table($table)
                ->select('id', $column)
                ->whereNotNull($column)
                ->where($column, '!=', '')
                ->limit((int) $this->option('limit'))
                ->get();

            $rows = $rows->filter(fn($r) => $this->looksLikeImage((string) $r->{$column}));

            if ($rows->isEmpty()) {
                continue;
            }

            $this->line("<fg=cyan>== {$table}.{$column} ({$rows->count()} image refs) ==</>");

            foreach ($rows as $row) {
                $raw = (string) $row->{$column};
                [$kind, $path] = $this->classify($raw);

                // Only a value that reduces to an object path needs bytes.
                $bytes = '-';
                if ($path !== null && $hasStore) {
                    $bytes = DB::table('stored_files')->where('path', $path)->exists()
                        ? '<fg=green>bytes OK</>'
                        : '<fg=red>NO BYTES</>';
                }

                $key = $kind . ($path !== null && $hasStore ? ' / ' . strip_tags($bytes) : '');
                $tally[$key] = ($tally[$key] ?? 0) + 1;

                $this->line(sprintf(
                    '  #%-6s %-22s %-12s %s',
                    $row->id,
                    $kind,
                    strip_tags($bytes),
                    $this->preview($raw)
                ));
            }
            $this->newLine();
        }

        $this->line('<fg=cyan>== summary ==</>');
        foreach ($tally as $k => $n) {
            $this->line(sprintf('  %-34s %d', $k, $n));
        }

        $this->reportInlineAvatarWeight();

        $this->newLine();
        $this->line('data-uri / external-url  : rendered directly, needs no /media lookup.');
        $this->line('supabase-url / bare-path : served from /media/<path>, so needs "bytes OK".');
        $this->line('NO BYTES                 : stored_files has no such key -- that image is missing.');

        return self::SUCCESS;
    }

    /**
     * Avatars are validated up to 2.8 MB of base64 and stored inline in the
     * row, and the admin and portal-user list endpoints return whole models.
     * Every such byte is re-sent on each list load, so this reports how heavy
     * those responses actually are.
     */
    private function reportInlineAvatarWeight(): void
    {
        $this->newLine();
        $this->line('<fg=cyan>== inline base64 avatar weight (list payload cost) ==</>');

        foreach ([['admins', 'avatar'], ['portal_users', 'avatar']] as [$table, $column]) {
            if (!DB::getSchemaBuilder()->hasTable($table) || !DB::getSchemaBuilder()->hasColumn($table, $column)) {
                continue;
            }

            $stat = DB::table($table)
                ->selectRaw("COUNT(*) AS rows_total")
                ->selectRaw("SUM(CASE WHEN {$column} LIKE 'data:%' THEN 1 ELSE 0 END) AS inline_rows")
                ->selectRaw("COALESCE(SUM(CASE WHEN {$column} LIKE 'data:%' THEN CHAR_LENGTH({$column}) ELSE 0 END), 0) AS inline_bytes")
                ->selectRaw("COALESCE(MAX(CASE WHEN {$column} LIKE 'data:%' THEN CHAR_LENGTH({$column}) ELSE 0 END), 0) AS worst_bytes")
                ->first();

            $this->line(sprintf(
                '  %-14s rows=%-4d inline=%-4d  largest=%-9s  whole-list payload=%s',
                $table,
                $stat->rows_total,
                $stat->inline_rows,
                $this->bytes((int) $stat->worst_bytes),
                $this->bytes((int) $stat->inline_bytes)
            ));
        }

        $this->line('  Anything above a few hundred KB here is re-downloaded on every list load.');
    }

    private function bytes(int $n): string
    {
        if ($n >= 1048576) {
            return number_format($n / 1048576, 2) . ' MB';
        }

        return $n >= 1024 ? number_format($n / 1024, 1) . ' KB' : $n . ' B';
    }

    /** Filters out rows that are plainly not image references (free-text settings). */
    private function looksLikeImage(string $raw): bool
    {
        $v = trim($raw);

        return $v !== ''
            && (str_starts_with($v, 'data:image')
                || (bool) preg_match('/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i', $v));
    }

    /** @return array{0:string,1:?string} kind, and the /media path it reduces to */
    private function classify(string $raw): array
    {
        $v = trim($raw);

        if ($v === '') {
            return ['empty', null];
        }
        if (str_starts_with($v, 'data:image')) {
            return ['data-uri', null];
        }
        if (preg_match(self::SUPABASE_URL, $v, $m)) {
            return ['supabase-url', ltrim(explode('?', $m[1])[0], '/')];
        }
        if (preg_match('#^https?://#i', $v)) {
            return ['external-url', null];
        }
        // Anything else is treated as a path, matching resolveMediaUrl.
        $path = preg_replace('#^(?:storage|media)/+#i', '', ltrim($v, '/'));

        return ['bare-path', $path !== '' ? $path : null];
    }

    private function preview(string $raw): string
    {
        $v = trim(preg_replace('/\s+/', ' ', $raw));

        return strlen($v) > 78 ? substr($v, 0, 75) . '...' : $v;
    }
}
