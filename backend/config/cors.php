<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    // Set CORS_ALLOWED_ORIGINS (comma-separated) to override. Local dev
    // origins are only trusted outside production, and the retired Railway
    // host is gone: these origins may send credentialed requests.
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'CORS_ALLOWED_ORIGINS',
        implode(',', array_merge(
            [
                'https://autovet-admin.vercel.app',
                'https://autovet-portal.vercel.app',
                'https://auto-vet-v1qy.vercel.app',
            ],
            env('APP_ENV') === 'production' ? [] : [
                'http://localhost:5173',
                'http://localhost:5174',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:5174',
                'http://autovet.test',
            ]
        ))
    ))))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => true,
];
