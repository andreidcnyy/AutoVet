<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        // The "public" disk is env-switchable so we can keep local-disk
        // storage in development (Laragon) while using S3-compatible object
        // storage (Cloudflare R2 / AWS S3) in production where Railway's
        // filesystem is ephemeral and there is no persistent volume on the
        // free tier. Set FILESYSTEM_PUBLIC=s3 to flip the switch.
        'public' => env('FILESYSTEM_PUBLIC') === 's3' ? [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION', 'auto'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', true),
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
            // A retired or unreachable bucket must fail fast. Without these the
            // SDK waits out its default timeouts on every miss, holding a PHP
            // worker open for tens of seconds per missing image.
            'http' => ['connect_timeout' => 2, 'timeout' => 5],
        ] : [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // Database backups. On Render the local disk is wiped on every
        // redeploy, so set BACKUP_DISK=s3 and point BACKUP_AWS_BUCKET at a
        // PRIVATE bucket to keep them. Never reuse the public uploads bucket:
        // backup names are dates, so anyone could guess and download them.
        // The access keys default to the uploads ones (same Supabase project).
        'backups' => env('BACKUP_DISK') === 's3' ? [
            'driver' => 's3',
            'key' => env('BACKUP_AWS_ACCESS_KEY_ID', env('AWS_ACCESS_KEY_ID')),
            'secret' => env('BACKUP_AWS_SECRET_ACCESS_KEY', env('AWS_SECRET_ACCESS_KEY')),
            'region' => env('BACKUP_AWS_DEFAULT_REGION', env('AWS_DEFAULT_REGION')),
            'bucket' => env('BACKUP_AWS_BUCKET'),
            'endpoint' => env('BACKUP_AWS_ENDPOINT', env('AWS_ENDPOINT')),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', true),
            'root' => 'backups',
            'visibility' => 'private',
            'throw' => true,
            'report' => false,
            // Backups are larger than images; allow time to upload one.
            'http' => ['connect_timeout' => 5, 'timeout' => 120],
        ] : [
            'driver' => 'local',
            'root' => storage_path('app/backups'),
            'throw' => true,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', true),
            'throw' => true,
            'report' => false,
            'http' => ['connect_timeout' => 2, 'timeout' => 5],
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
