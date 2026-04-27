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
        'https://autovet-admin.vercel.app', // Adding common possible variations
        'https://autovet-portal.vercel.app',
        '*' // Keep * for non-credentialed if needed, but origins above take precedence
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
