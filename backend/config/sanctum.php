<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;

return [
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,127.0.0.1,autovet-admin.vercel.app,autovet-portal.vercel.app,auto-vet-v1qy.vercel.app')),
    'guard' => ['web'],
    // Minutes a token stays valid. Tokens live in the browser's localStorage,
    // where any XSS can read them, so a stolen one should not last a month.
    // Seven days by default; SANCTUM_EXPIRATION overrides.
    'expiration' => (int) env('SANCTUM_EXPIRATION', 10080),
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),
    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],
];
