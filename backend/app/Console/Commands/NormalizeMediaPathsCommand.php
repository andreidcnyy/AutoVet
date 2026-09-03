<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Rewrites absolute Supabase storage URLs stored in the database down to the
 * bare object path.
 *
 * Before image bytes moved into stored_files, the uploader returned
 * Storage::disk('s3')->url($name), so rows written then hold a full
 * https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path> URL. That
 * project no longer exists, so the browser gets a dead host. The path at the
 * end of the URL is the same key the bytes now live under in stored_files, so
 * reducing the column to that path lets /media serve it.
 *
 * The frontend resolves these URLs defensively too; this makes the stored data
 * match what the app actually serves.
 */
class NormalizeMediaPathsCommand extends Command
{
    protected $signature = 'media:normalize-paths
                            {--dry-run : Show what would change without writing}';

    protected $description = 'Rewrite absolute Supabase storage URLs in the database to bare /media paths';

    /** Captures the object path after the bucket segment. */
    private const SUPABASE_URL = '#^https?://[^/]*supabase\.(?:co|in)/storage/v1/(?:object/(?:public|authenticated|sign)|s3)/[^/]+/(.+)$#i';

    /** table => column pairs holding an image reference. */
    private const TARGETS = [
        ['pets', 'photo'],
        ['settings', 'value'],
        ['admins', 'avatar'],
        ['portal_users', 'avatar'],
    ];

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $total = 0;

        foreach (self::TARGETS as [$table, $column]) {
            if (!DB::getSchemaBuilder()->hasTable($table)
                || !DB::getSchemaBuilder()->hasColumn($table, $column)) {
                $this->line("  <fg=gray>skip</> {$table}.{$column} (not present)");
                continue;
            }

            $rows = DB::table($table)
                ->select('id', $column)
                ->where($column, 'like', '%supabase.%')
                ->get();

            foreach ($rows as $row) {
                $value = $row->{$column};
                if (!is_string($value) || !preg_match(self::SUPABASE_URL, trim($value), $m)) {
                    continue;
                }

                $path = ltrim(explode('?', $m[1])[0], '/');
                if ($path === '') {
                    continue;
                }

                $exists = DB::table('stored_files')->where('path', $path)->exists();
                $mark = $exists ? '<fg=green>bytes present</>' : '<fg=yellow>NO BYTES</>';

                $this->line(sprintf(
                    '  %s %s#%d.%s -> %s (%s)',
                    $dry ? '<fg=yellow>would fix</>' : '<fg=green>fixed</>',
                    $table,
                    $row->id,
                    $column,
                    $path,
                    $mark
                ));

                if (!$dry) {
                    DB::table($table)->where('id', $row->id)->update([$column => $path]);
                }
                $total++;
            }
        }

        $this->newLine();
        $this->info(sprintf('%s%d row(s) %s.', $dry ? '[dry run] ' : '', $total, $dry ? 'would be rewritten' : 'rewritten'));
        $this->line('Rows marked NO BYTES have no matching stored_files entry — those images were only ever in the deleted bucket.');

        return self::SUCCESS;
    }
}
