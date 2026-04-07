<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;

class BackupController extends Controller
{
    /**
     * List all database backup files.
     */
    public function index()
    {
        $backupPath = storage_path('app/backups');
        
        if (!File::exists($backupPath)) {
            File::makeDirectory($backupPath, 0755, true);
        }

        $files = File::files($backupPath);
        $backups = [];

        foreach ($files as $file) {
            if ($file->getExtension() === 'sql') {
                $backups[] = [
                    'filename' => $file->getFilename(),
                    'size' => $file->getSize(),
                    'created_at' => date('Y-m-d H:i:s', $file->getMTime()),
                ];
            }
        }

        // Sort by created_at descending
        usort($backups, function ($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        return response()->json(['data' => $backups]);
    }

    /**
     * Trigger a new database backup.
     */
    public function create()
    {
        try {
            $exitCode = Artisan::call('db:backup');
            
            if ($exitCode === 0) {
                return response()->json(['message' => 'Backup created successfully.']);
            }
            
            return response()->json(['message' => 'Failed to create backup.'], 500);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Restore the database from a backup file.
     */
    public function restore(Request $request)
    {
        $request->validate([
            'filename' => 'required|string',
        ]);

        $filename = $request->input('filename');
        $backupPath = storage_path('app/backups/' . $filename);

        if (!File::exists($backupPath)) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        try {
            // Restore command needs the filename as a positional argument
            $exitCode = Artisan::call('db:restore', ['file' => $filename]);

            if ($exitCode === 0) {
                return response()->json(['message' => 'Database restored successfully!']);
            }

            return response()->json(['message' => 'Failed to restore database.'], 500);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error restoring database: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Delete a backup file.
     */
    public function destroy($filename)
    {
        $backupPath = storage_path('app/backups/' . $filename);

        if (File::exists($backupPath)) {
            File::delete($backupPath);
            return response()->json(['message' => 'Backup deleted successfully.']);
        }

        return response()->json(['message' => 'Backup file not found.'], 404);
    }

    /**
     * Download a backup file.
     */
    public function download($filename)
    {
        $backupPath = storage_path('app/backups/' . $filename);

        if (File::exists($backupPath)) {
            return Response::download($backupPath);
        }

        return response()->json(['message' => 'Backup file not found.'], 404);
    }
}
