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
            if ($file->getExtension() === 'zip') {
                $backups[] = [
                    'filename' => $file->getFilename(),
                    'size'     => $file->getSize(),
                    'created_at' => date('Y-m-d H:i:s', $file->getMTime()),
                ];
            }
        }

        usort($backups, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));

        return response()->json(['data' => $backups]);
    }

    public function create()
    {
        try {
            $exitCode = Artisan::call('db:backup');

            if ($exitCode === 0) {
                return response()->json(['message' => 'CSV backup created successfully.']);
            }

            return response()->json(['message' => 'Failed to create backup.'], 500);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    public function destroy($filename)
    {
        $filename = basename($filename);
        if (!preg_match('/^backup_[\d_]+\.zip$/', $filename)) {
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
        if (!preg_match('/^backup_[\d_]+\.zip$/', $filename)) {
            return response()->json(['message' => 'Invalid backup filename.'], 422);
        }
        $backupPath = storage_path('app/backups/' . $filename);

        if (File::exists($backupPath)) {
            return Response::download($backupPath);
        }

        return response()->json(['message' => 'Backup file not found.'], 404);
    }
}
