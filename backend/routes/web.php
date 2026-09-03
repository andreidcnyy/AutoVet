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
    $serve = function (\App\Models\StoredFile $file) {
        $contents = is_resource($file->contents) ? stream_get_contents($file->contents) : $file->contents;

        return response($contents, 200)
            ->header('Content-Type', $file->mime ?: 'application/octet-stream')
            ->header('Cache-Control', 'public, max-age=31536000, immutable');
    };

    $file = \App\Models\StoredFile::where('path', $path)->first();
    if ($file) {
        return $serve($file);
    }

    // The prefix on a stored reference has drifted over the life of this app
    // (bucket URLs, storage/, media/, bare paths), but the filename generated
    // at upload has always been unique. So if the exact key misses, match on
    // the filename before giving up — that resolves a row whose prefix no
    // longer matches how the bytes were keyed.
    $basename = basename(parse_url($path, PHP_URL_PATH) ?: $path);
    if ($basename !== '') {
        $file = \App\Models\StoredFile::where('path', $basename)
            ->orWhere('path', 'like', '%/' . $basename)
            ->first();
        if ($file) {
            return $serve($file);
        }
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
    //
    // Once it has failed, stop probing it for a while. A retired bucket costs
    // the full SDK timeout on every miss, and a page referencing a dozen such
    // images would otherwise hold that many PHP workers at once — enough to
    // stall the whole app on a small instance.
    $downKey = 'media:public-disk-down';
    if (!\Illuminate\Support\Facades\Cache::get($downKey)) {
        try {
            $disk = \Illuminate\Support\Facades\Storage::disk('public');
            if ($disk->exists($path)) {
                return $disk->response($path);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Cache::put($downKey, true, now()->addMinutes(5));
            \Illuminate\Support\Facades\Log::warning('[media] public disk unreachable, skipping it for 5 minutes', [
                'path'  => $path,
                'error' => $e->getMessage(),
            ]);
        }
    }

    abort(404);
})->where('path', '.+');
