<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// TEMP diagnostic — remove after verifying image storage.
Route::get('/__debug/storage', function () {
    return response()->json([
        'db'    => \Illuminate\Support\Facades\DB::connection()->getDatabaseName(),
        'count' => \App\Models\StoredFile::count(),
        'paths' => \App\Models\StoredFile::orderBy('id')->pluck('path'),
    ]);
});


/*
 * Public storage proxy.
 *
 * In dev (Laragon), the public/storage symlink serves files directly via the
 * web server, so this route is rarely hit. In production on Railway with
 * Cloudflare R2 (FILESYSTEM_PUBLIC=s3), the local symlink has nothing in it
 * and any /storage/... request lands here — we redirect to the actual R2
 * public URL so the frontend's existing <img src="/storage/..." /> just works
 * without any frontend changes.
 */
Route::get('/storage/{path}', function (string $path) {
    // Primary store: files saved as bytes in the database (TiDB).
    $file = \App\Models\StoredFile::where('path', $path)->first();
    if ($file) {
        return response($file->contents, 200)
            ->header('Content-Type', $file->mime ?: 'application/octet-stream')
            ->header('Cache-Control', 'public, max-age=31536000, immutable');
    }

    // Fallback: local public disk (dev, or files baked into the image).
    $disk = \Illuminate\Support\Facades\Storage::disk('public');
    if ($disk->exists($path)) {
        return $disk->response($path);
    }
    abort(404);
})->where('path', '.+');


