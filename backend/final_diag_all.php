<?php
define('LARAVEL_START', microtime(true));
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

echo "\nStep 2 — Pet & Owner Counts\n";
try {
    echo json_encode(['pets' => \App\Models\Pet::count(), 'owners' => \App\Models\Owner::count()]) . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\nStep 3 — Invoice Count\n";
try {
    echo \App\Models\Invoice::count() . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\nStep 4 — Appointment Count\n";
try {
    echo \App\Models\Appointment::count() . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\nStep 5 — Inventory Count\n";
try {
    echo \App\Models\Inventory::count() . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\nStep 6 — Table List\n";
try {
    $tables = array_map(fn($t) => array_values((array)$t)[0], \DB::select('SHOW TABLES'));
    echo implode(', ', $tables) . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\nStep 7 — PHP Error Log / Environment\n";
echo "PHP Version: " . phpversion() . "\n";
echo "error_log Location: " . ini_get('error_log') . "\n";
$errorLog = ini_get('error_log');
if ($errorLog && file_exists($errorLog)) {
    echo "Last 20 lines of log:\n";
    $lines = array_slice(file($errorLog), -20);
    echo implode("", $lines);
} else {
    echo "Error log file does not exist or is not accessible.\n";
}

echo "\nStep 1 — Direct Kernel Handle (/api/dashboard/stats)\n";
try {
    $request = Illuminate\Http\Request::create('/api/dashboard/stats', 'GET');
    $request->headers->set('Accept', 'application/json');
    $response = $kernel->handle($request);
    echo "Status: " . $response->getStatusCode() . "\n";
    echo "Content: " . $response->getContent() . "\n";
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " Line: " . $e->getLine() . "\n";
}
