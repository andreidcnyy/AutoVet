<?php
define('LARAVEL_START', microtime(true));
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

echo "\n--- STEP 2: Pet & Owner Counts ---\n";
try {
    echo json_encode(['pets' => \App\Models\Pet::count(), 'owners' => \App\Models\Owner::count()]) . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\n--- STEP 3: Invoice Count ---\n";
try {
    echo \App\Models\Invoice::count() . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\n--- STEP 4: Appointment Count ---\n";
try {
    echo \App\Models\Appointment::count() . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\n--- STEP 5: Inventory Count ---\n";
try {
    echo \App\Models\Inventory::count() . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\n--- STEP 6: Table List ---\n";
try {
    $tables = array_map(fn($t) => array_values((array)$t)[0], \DB::select('SHOW TABLES'));
    echo implode(', ', $tables) . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\n--- STEP 7: PHP Error Log ---\n";
$errorLog = ini_get('error_log');
echo "error_log location: " . ($errorLog ?: 'no value') . "\n";
if ($errorLog && file_exists($errorLog)) {
    $lines = array_slice(file($errorLog), -20);
    echo implode("", $lines);
}

echo "\n--- STEP 1: /api/dashboard/stats ---\n";
try {
    $request = Illuminate\Http\Request::create('/api/dashboard/stats', 'GET');
    $request->headers->set('Accept', 'application/json');
    $response = $kernel->handle($request);
    echo "Status: " . $response->getStatusCode() . "\n";
    echo "Content: " . $response->getContent() . "\n";
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
