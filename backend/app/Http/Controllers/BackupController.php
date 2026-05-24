<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;

class BackupController extends Controller
{
    public function index()
    {
        $backupPath = storage_path('app/backups');

        if (!File::exists($backupPath)) {
            File::makeDirectory($backupPath, 0755, true);
        }

        $files = File::files($backupPath);
        $backups = [];

        foreach ($files as $file) {
            if (!preg_match('/^backup_[\d_]+\.tar\.gz$/', $file->getFilename())) continue;
            $backups[] = [
                'filename'   => $file->getFilename(),
                'size'       => $file->getSize(),
                'created_at' => date('Y-m-d H:i:s', $file->getMTime()),
            ];
        }

        usort($backups, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));

        return response()->json(['data' => $backups]);
    }

    public function create()
    {
        try {
            $exitCode = Artisan::call('db:backup');

            if ($exitCode === 0) {
                // Return the newly created file's metadata so the frontend
                // can prepend it to the list without a second GET request.
                $backupPath = storage_path('app/backups');
                $files = File::files($backupPath);
                usort($files, fn($a, $b) => $b->getMTime() - $a->getMTime());
                $newest = collect($files)->first(
                    fn($f) => preg_match('/^backup_[\d_]+\.tar\.gz$/', $f->getFilename())
                );

                return response()->json([
                    'message' => 'CSV backup created successfully.',
                    'backup'  => $newest ? [
                        'filename'   => $newest->getFilename(),
                        'size'       => $newest->getSize(),
                        'created_at' => date('Y-m-d H:i:s', $newest->getMTime()),
                    ] : null,
                ]);
            }

            $output = trim(Artisan::output());
            $detail = $output ?: 'The backup command exited with an error.';
            return response()->json(['message' => $detail], 500);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    public function destroy($filename)
    {
        $filename = basename($filename);
        if (!preg_match('/^backup_[\d_]+\.tar\.gz$/', $filename)) {
            return response()->json(['message' => 'Invalid backup filename.'], 422);
        }
        $backupPath = storage_path('app/backups/' . $filename);

        if (File::exists($backupPath)) {
            File::delete($backupPath);
            return response()->json(['message' => 'Backup deleted successfully.']);
        }

        return response()->json(['message' => 'Backup file not found.'], 404);
    }

    public function download($filename)
    {
        $filename = basename($filename);
        if (!preg_match('/^backup_[\d_]+\.tar\.gz$/', $filename)) {
            return response()->json(['message' => 'Invalid backup filename.'], 422);
        }
        $backupPath = storage_path('app/backups/' . $filename);

        if (File::exists($backupPath)) {
            return Response::download($backupPath);
        }

        return response()->json(['message' => 'Backup file not found.'], 404);
    }
}
