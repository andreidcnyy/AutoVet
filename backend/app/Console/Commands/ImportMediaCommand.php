<?php

namespace App\Console\Commands;

use App\Models\StoredFile;
use Illuminate\Console\Command;
use Symfony\Component\Finder\Finder;

/**
 * Backfills stored_files from the on-disk public directory.
 *
 * Images uploaded before the move to database-backed storage were written to
 * storage/app/public/<dir>/<file>, and pets.photo (and friends) still point at
 * those relative paths. Once FILESYSTEM_PUBLIC was switched to s3 the /media
 * route could no longer find them, so every one of those images broke. This
 * imports the bytes into stored_files so /media serves them again.
 */
class ImportMediaCommand extends Command
{
    protected $signature = 'media:import
                            {--path= : Only import below this sub-directory (e.g. pets)}
                            {--force : Re-import files that are already in stored_files}
                            {--dry-run : List what would be imported without writing}';

    protected $description = 'Import files from storage/app/public into the stored_files table';

    public function handle(): int
    {
        $root = storage_path('app/public');
        $scan = $this->option('path') ? $root . '/' . trim($this->option('path'), '/') : $root;

        if (!is_dir($scan)) {
            $this->error("Not a directory: {$scan}");
            return self::FAILURE;
        }

        $files = Finder::create()->files()->in($scan)->notName('.gitignore');

        $imported = $skipped = $failed = 0;

        foreach ($files as $file) {
            // Path as stored in pets.photo etc: relative to the public root,
            // forward slashes, no leading slash.
            $relative = str_replace('\\', '/', substr($file->getRealPath(), strlen($root) + 1));

            if (!$this->option('force') && StoredFile::where('path', $relative)->exists()) {
                $this->line("  <fg=gray>skip</> {$relative} (already imported)");
                $skipped++;
                continue;
            }

            if ($this->option('dry-run')) {
                $this->line("  <fg=yellow>would import</> {$relative} ({$file->getSize()} bytes)");
                $imported++;
                continue;
            }

            $bytes = @file_get_contents($file->getRealPath());
            if ($bytes === false) {
                $this->line("  <fg=red>fail</> {$relative} (unreadable)");
                $failed++;
                continue;
            }

            StoredFile::store($relative, $bytes, $this->guessMime($file->getRealPath(), $file->getExtension()));
            $this->line("  <fg=green>ok</> {$relative} ({$file->getSize()} bytes)");
            $imported++;
        }

        $this->newLine();
        $this->info(sprintf(
            '%s%d imported, %d skipped, %d failed.',
            $this->option('dry-run') ? '[dry run] ' : '',
            $imported,
            $skipped,
            $failed
        ));

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /** Prefer the mime read from the file's own bytes over its extension. */
    private function guessMime(string $absolute, string $extension): string
    {
        if (function_exists('finfo_open') && ($finfo = finfo_open(FILEINFO_MIME_TYPE))) {
            $mime = finfo_file($finfo, $absolute);
            finfo_close($finfo);
            if (is_string($mime) && $mime !== '' && $mime !== 'application/octet-stream') {
                return $mime;
            }
        }

        return match (strtolower($extension)) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png'         => 'image/png',
            'gif'         => 'image/gif',
            'webp'        => 'image/webp',
            'svg'         => 'image/svg+xml',
            default       => 'application/octet-stream',
        };
    }
}
