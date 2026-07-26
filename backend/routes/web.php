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
