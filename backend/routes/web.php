<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

/*
 * Image/file serving from the database (TiDB).
 *
 * Files are stored as bytes in the stored_files table (see App\Models\StoredFile)
 * and served here. We use the /media prefix — NOT /storage — because
 * `php artisan serve` intercepts /storage/* for Laravel's storage symlink and
 * never passes those requests to the router.
 */
Route::get('/media/{path}', function (string $path) {
    $file = \App\Models\StoredFile::where('path', $path)->first();
    if ($file) {
        $contents = is_resource($file->contents) ? stream_get_contents($file->contents) : $file->contents;
        return response($contents, 200)
            ->header('Content-Type', $file->mime ?: 'application/octet-stream')
            ->header('Cache-Control', 'public, max-age=31536000, immutable');
    }

    // Fallback 1: the on-disk public directory. Checked directly rather than
    // through Storage::disk('public') because that disk is env-switched to S3
    // (FILESYSTEM_PUBLIC=s3) — legacy files written before the move to
    // stored_files still live here, and the S3 disk cannot see them.
    $root = realpath(storage_path('app/public'));
    $local = realpath(storage_path('app/public/' . $path));
    // realpath() resolves "..", so this rejects any traversal outside the root.
    if ($root && $local && str_starts_with($local, $root) && is_file($local)) {
        return response()->file($local, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    // Fallback 2: the configured public disk (S3 in production). Wrapped
    // because an unreachable bucket makes Flysystem throw, and a storage
    // outage must degrade to a missing image, not a 500 on every request.
    try {
        $disk = \Illuminate\Support\Facades\Storage::disk('public');
        if ($disk->exists($path)) {
            return $disk->response($path);
        }
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::warning('[media] public disk unreachable', [
            'path'  => $path,
            'error' => $e->getMessage(),
        ]);
    }

    abort(404);
})->where('path', '.+');
