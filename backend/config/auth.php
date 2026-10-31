<?php

use App\Models\Admin;
use App\Models\PortalUser;

return [

    'defaults' => [
        'guard' => 'web',
        'passwords' => 'users',
    ],

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
        'api' => [
            'driver' => 'sanctum',
            'provider' => 'users',
        ],
        'admin_api' => [
            'driver' => 'sanctum',
            'provider' => 'admins',
        ],
        'portal_api' => [
            'driver' => 'sanctum',
            'provider' => 'portal_users',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => Admin::class,
        ],
        'admins' => [
            'driver' => 'eloquent',
            'model' => Admin::class,
        ],
        'portal_users' => [
            'driver' => 'eloquent',
            'model' => PortalUser::class,
        ],
    ],

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => 'password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    'password_timeout' => env('AUTH_PASSWORD_TIMEOUT', 10800),

];
