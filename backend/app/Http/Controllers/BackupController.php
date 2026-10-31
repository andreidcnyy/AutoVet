<?php

namespace App\Http\Controllers;

use App\Console\Commands\BackupDatabaseCommand;
use App\Enums\Roles;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * CSV backups.
 *
 * A super admin works with platform-wide backups; everyone else only ever
 * sees, creates and downloads backups of their own clinic. Files live on the
 * "backups" disk: a local folder by default, or a private bucket when
 * BACKUP_DISK=s3 (Render wipes its local disk on every redeploy).
 */
class BackupController extends Controller
{
    private const FILENAME_PATTERN = '/^backup_[\d_]+\.tar\.gz$/';

    private function disk()
    {
        return Storage::disk('backups');
    }

    /** The clinic whose backups the caller works with, or null for the platform. */
    private function clinicScope(Request $request): ?int
    {
        $user = $request->user();

        return $user->role === Roles::SUPER_ADMIN->value ? null : (int) $user->clinic_id;
    }

    private function folder(Request $request): string
    {
        return BackupDatabaseCommand::directoryFor($this->clinicScope($request));
    }

    /** Backups in the caller's folder, newest first. */
    private function listBackups(Request $request)
    {
        $disk = $this->disk();

        return collect($disk->files($this->folder($request)))
            ->filter(fn ($path) => preg_match(self::FILENAME_PATTERN, basename($path)))
            ->map(fn ($path) => [
                'filename' => basename($path),
                'size' => $disk->size($path),
                'created_at' => date('Y-m-d H:i:s', $disk->lastModified($path)),
            ])
            ->sortByDesc('created_at')
            ->values();
    }

    public function index(Request $request)
    {
        try {
            return response()->json(['data' => $this->listBackups($request)]);
        } catch (\Throwable $e) {
            Log::error('Listing backups failed: '.$e->getMessage(), ['exception' => get_class($e)]);

            return response()->json(['message' => 'Backups could not be listed right now.'], 500);
        }
    }

    public function create(Request $request)
    {
        // Reading every table from a remote database takes far longer than a
        // normal request; without this PHP can be killed mid-run and the
        // client receives an empty body instead of JSON.
        @set_time_limit(0);

        $clinicId = $this->clinicScope($request);
        $startedAt = microtime(true);

        try {
            $exitCode = Artisan::call('db:backup', $clinicId ? ['--clinic' => $clinicId] : []);
        } catch (\Throwable $e) {
            Log::error('Backup threw: '.$e->getMessage(), ['exception' => get_class($e)]);

            return response()->json(['message' => 'The backup could not be created. Please try again.'], 500);
        }

        $elapsed = round(microtime(true) - $startedAt, 1);

        if ($exitCode !== 0) {
            Log::error("Backup command failed after {$elapsed}s (exit {$exitCode}): ".trim(Artisan::output()));

            return response()->json(['message' => 'The backup could not be created. Please try again.'], 500);
        }

        Log::info("Backup created in {$elapsed}s", ['clinic_id' => $clinicId]);

        // Return the newly created file's metadata so the frontend can prepend
        // it to the list without a second GET request.
        return response()->json([
            'message' => 'CSV backup created successfully.',
            'backup' => $this->listBackups($request)->first(),
        ], 201);
    }

    public function destroy(Request $request, $filename)
    {
        $path = $this->resolve($request, $filename);
        if (! $path) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        $this->disk()->delete($path);

        return response()->json(['message' => 'Backup deleted successfully.']);
    }

    public function download(Request $request, $filename)
    {
        $path = $this->resolve($request, $filename);
        if (! $path) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        return $this->disk()->download($path, basename($path));
    }

    /** Path on the backups disk of a backup the caller may touch, or null. */
    private function resolve(Request $request, $filename): ?string
    {
        $filename = basename((string) $filename);
        if (! preg_match(self::FILENAME_PATTERN, $filename)) {
            return null;
        }

        $path = ltrim($this->folder($request).'/'.$filename, '/');

        return $this->disk()->exists($path) ? $path : null;
    }
}
