<?php

use App\Models\StoredFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// The API has no web pages. The stock Laravel welcome page advertised the
// framework and linked to routes that do not exist here.
Route::get('/', function () {
    return response()->json(['name' => 'AutoVet API']);
});

/*
 * The clinic app served by this backend, for the clinic computer that works
 * offline: http://localhost:8000/clinic/. Same origin as the API, so nothing
 * needs the internet.
 *
 * Built with `npm run build:clinic` (frontend/admin) into storage/clinic-app.
 * Deliberately not under public/: PHP's built-in server (`artisan serve`) sees
 * a real public/clinic folder with an index.html and hands Laravel "/login"
 * instead of "/clinic/login", so every deep link 404s. Served from here, a
 * request for a real file gets that file and anything else gets index.html for
 * the app's own router.
 */
Route::get('/clinic/{path?}', function (?string $path = null) {
    $root = storage_path('clinic-app');
    $index = $root.DIRECTORY_SEPARATOR.'index.html';
    abort_unless(is_file($index), 404, 'Clinic app not built. Run "npm run build:clinic" in frontend/admin.');

    $file = $path ? realpath($root.DIRECTORY_SEPARATOR.$path) : false;
    $insideRoot = $file && str_starts_with($file, realpath($root).DIRECTORY_SEPARATOR) && is_file($file);

    if (! $insideRoot) {
        return response()->file($index, ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-cache']);
    }

    // By extension: content sniffing reports scripts as text/plain, and
    // browsers refuse to run module scripts served that way.
    $types = [
        'js' => 'application/javascript', 'mjs' => 'application/javascript', 'css' => 'text/css',
        'html' => 'text/html; charset=UTF-8', 'json' => 'application/json', 'map' => 'application/json',
        'webmanifest' => 'application/manifest+json', 'svg' => 'image/svg+xml', 'png' => 'image/png',
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp',
        'ico' => 'image/x-icon', 'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'txt' => 'text/plain',
    ];
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    // Hashed build files never change; the service worker must always be re-checked.
    $cache = str_contains($file, DIRECTORY_SEPARATOR.'assets'.DIRECTORY_SEPARATOR) ? 'public, max-age=31536000, immutable' : 'no-cache';

    return response()->file($file, ['Content-Type' => $types[$ext] ?? 'application/octet-stream', 'Cache-Control' => $cache]);
})->where('path', '.*');

/*
 * Image/file serving from the database (TiDB).
 *
 * Files are stored as bytes in the stored_files table (see App\Models\StoredFile)
 * and served here. We use the /media prefix — NOT /storage — because
 * `php artisan serve` intercepts /storage/* for Laravel's storage symlink and
 * never passes those requests to the router.
 */
Route::get('/media/{path}', function (string $path) {
    $serve = function (StoredFile $file) {
        $contents = is_resource($file->contents) ? stream_get_contents($file->contents) : $file->contents;

        return response($contents, 200)
            ->header('Content-Type', $file->mime ?: 'application/octet-stream')
            ->header('Cache-Control', 'public, max-age=31536000, immutable');
    };

    $file = StoredFile::where('path', $path)->first();
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
        // % and _ in the requested name are matched literally; as wildcards
        // they let anyone list every stored image ("/media/%25").
        $file = StoredFile::where('path', $basename)
            ->orWhere('path', 'like', '%/'.addcslashes($basename, '%_\\'))
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
    $local = realpath(storage_path('app/public/'.$path));
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
    if (! Cache::get($downKey)) {
        try {
            $disk = Storage::disk('public');
            if ($disk->exists($path)) {
                return $disk->response($path);
            }
        } catch (Throwable $e) {
            Cache::put($downKey, true, now()->addMinutes(5));
            Log::warning('[media] public disk unreachable, skipping it for 5 minutes', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
        }
    }

    abort(404);
})->where('path', '.+');
