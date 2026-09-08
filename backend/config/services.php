<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'sync' => [
        'is_clinic' => env('SYNC_IS_CLINIC', false),
        'portal_url' => env('SYNC_PORTAL_URL', 'http://localhost:8001'),
        'secret' => env('SYNC_SECRET'),
    ],

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY', ''),
    ],

    'ai' => [
        // Inventory forecasting Python service. Read via config() so it survives
        // config:cache (env() would return null once config is cached).
        'url' => env('AI_API_URL'),

        // Interpreter used to run ai/forecast.py and ai/batch_forecast.py. On
        // Render this is /opt/venv/bin/python, the only one with numpy, pandas
        // and scikit-learn installed — the system python3 has none of them, so
        // resolving this to null silently breaks forecasting rather than
        // failing loudly. Here for the same reason as 'url' above.
        'python_bin' => env('PYTHON_BIN_PATH'),
    ],

    'cron' => [
        // Shared secret for the Vercel cron endpoints, which sit outside the
        // auth middleware and compare it against a bearer token. Must be read
        // through config(): under config:cache an env() call here would return
        // null, and the route would then reject every legitimate cron request.
        'secret' => env('CRON_SECRET'),
    ],

    'google' => [
        'client_id'     => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect'      => 'https://petwellness-web.vercel.app',
    ],

];
