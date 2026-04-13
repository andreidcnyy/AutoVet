<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
echo 'App booted OK' . PHP_EOL;

try {
    $admin = App\Models\Admin::find(2);
    if (!$admin) {
        die('Admin ID 2 not found' . PHP_EOL);
    }
    echo 'Admin found: ' . $admin->email . PHP_EOL;

    $token = $admin->tokens()->latest()->first();
    if (!$token) {
        echo 'No tokens found for this admin' . PHP_EOL;
    } else {
        echo 'Token tokenable_type: ' . $token->tokenable_type . PHP_EOL;
        echo 'Token tokenable_id: ' . $token->tokenable_id . PHP_EOL;
    }
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . PHP_EOL;
}
