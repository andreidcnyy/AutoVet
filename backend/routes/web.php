<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
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
    $disk = \Illuminate\Support\Facades\Storage::disk('public');
    $driver = config('filesystems.disks.public.driver');

    if ($driver === 's3') {
        return redirect()->away($disk->url($path));
    }

    if ($disk->exists($path)) {
        return $disk->response($path);
    }
    abort(404);
})->where('path', '.+');


