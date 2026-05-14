<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://autovet.test',
        'https://auto-vet-v1qy.vercel.app',
        'https://autovet-admin.vercel.app',
        'https://autovet-portal.vercel.app',
        'https://vibrant-abundance-production-4543.up.railway.app',
    ],
    'allowed_origins_patterns' => [
        '/^https:\/\/.*\.vercel\.app$/',
        '/^https:\/\/.*\.railway\.app$/',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => true,
];
