<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$admin = App\Models\Admin::first();
if (!$admin) {
    die("NO_ADMIN_FOUND\n");
}
$token = $admin->createToken('test')->plainTextToken;
echo $token . PHP_EOL;
