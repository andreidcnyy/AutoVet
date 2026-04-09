<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\Admin;
use App\Models\PortalUser;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "--- DATABASE CHECK ---\n";
try {
    \DB::connection()->getPdo();
    echo "Database: CONNECTED (" . \DB::connection()->getDatabaseName() . ")\n";
} catch (\Exception $e) {
    echo "Database: FAILED (" . $e->getMessage() . ")\n";
}

echo "\n--- USER VERIFICATION ---\n";
$admin = Admin::where('email', 'test-admin@autovet.com')->first();
echo "Admin 'test-admin@autovet.com': " . ($admin ? "FOUND" : "NOT FOUND") . "\n";

$portal = PortalUser::where('email', 'test-portal@autovet.com')->first();
echo "Portal User 'test-portal@autovet.com': " . ($portal ? "FOUND" : "NOT FOUND") . "\n";

echo "\n--- API ROUTE CHECK ---\n";
$request = Request::create('/api/status', 'GET');
$response = $kernel->handle($request);
echo "GET /api/status Code: " . $response->getStatusCode() . "\n";
echo "GET /api/status Body: " . $response->getContent() . "\n";

echo "\n--- LOGIN SIMULATION ---\n";
$request = Request::create('/api/login', 'POST', [
    'email' => 'test-admin@autovet.com',
    'password' => 'password123'
]);
$response = $kernel->handle($request);
echo "POST /api/login Code: " . $response->getStatusCode() . "\n";
echo "POST /api/login Body: " . $response->getContent() . "\n";
