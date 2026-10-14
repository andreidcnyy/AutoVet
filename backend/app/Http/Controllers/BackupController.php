<?php

namespace App\Http\Controllers;

use App\Console\Commands\BackupDatabaseCommand;
use App\Enums\Roles;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Response;

/**
 * CSV backups.
 *
 * A super admin works with platform-wide backups; everyone else only ever
 * sees, creates and downloads backups of their own clinic. The command used
 * to export every clinic's rows, and any clinic's staff could download them.
 */
class BackupController extends Controller
{
    private const FILENAME_PATTERN = '/^backup_[\d_]+\.tar\.gz$/';

    /** The clinic whose backups the caller works with, or null for the platform. */
    private function clinicScope(Request $request): ?int
    {
        $user = $request->user();
        return $user->role === Roles::SUPER_ADMIN->value ? null : (int) $user->clinic_id;
    }

    private function backupDirectory(Request $request): string
    {
        $dir = BackupDatabaseCommand::directoryFor($this->clinicScope($request));
        if (!File::exists($dir)) {
            File::makeDirectory($dir, 0755, true);
        }
        return $dir;
    }

    private function describe(\SplFileInfo $file): array
    {
        return [
            'filename'   => $file->getFilename(),
            'size'       => $file->getSize(),
            'created_at' => date('Y-m-d H:i:s', $file->getMTime()),
        ];
    }

    public function index(Request $request)
    {
        $backups = collect(File::files($this->backupDirectory($request)))
            ->filter(fn ($f) => preg_match(self::FILENAME_PATTERN, $f->getFilename()))
            ->sortByDesc(fn ($f) => $f->getMTime())
            ->map(fn ($f) => $this->describe($f))
            ->values();

        return response()->json(['data' => $backups]);
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
            Log::error('Backup threw: ' . $e->getMessage(), ['exception' => get_class($e)]);
            return response()->json(['message' => 'The backup could not be created. Please try again.'], 500);
        }

        $elapsed = round(microtime(true) - $startedAt, 1);

        if ($exitCode !== 0) {
            Log::error("Backup command failed after {$elapsed}s (exit {$exitCode}): " . trim(Artisan::output()));
            return response()->json(['message' => 'The backup could not be created. Please try again.'], 500);
        }

        Log::info("Backup created in {$elapsed}s", ['clinic_id' => $clinicId]);

        // Return the newly created file's metadata so the frontend can prepend
        // it to the list without a second GET request.
        $newest = collect(File::files($this->backupDirectory($request)))
            ->filter(fn ($f) => preg_match(self::FILENAME_PATTERN, $f->getFilename()))
            ->sortByDesc(fn ($f) => $f->getMTime())
            ->first();

        return response()->json([
            'message' => 'CSV backup created successfully.',
            'backup'  => $newest ? $this->describe($newest) : null,
        ], 201);
    }

    public function destroy(Request $request, $filename)
    {
        $path = $this->resolve($request, $filename);
        if (!$path) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        File::delete($path);
        return response()->json(['message' => 'Backup deleted successfully.']);
    }

    public function download(Request $request, $filename)
    {
        $path = $this->resolve($request, $filename);
        if (!$path) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        return Response::download($path);
    }

    /** Full path of a backup the caller may touch, or null. */
    private function resolve(Request $request, $filename): ?string
    {
        $filename = basename((string) $filename);
        if (!preg_match(self::FILENAME_PATTERN, $filename)) {
            return null;
        }

        $path = $this->backupDirectory($request) . DIRECTORY_SEPARATOR . $filename;
        return File::exists($path) ? $path : null;
    }
}
