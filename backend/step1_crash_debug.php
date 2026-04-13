<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$request = Illuminate\Http\Request::create('/api/dashboard/stats', 'GET', [], [], [], [
    'HTTP_ACCEPT' => 'application/json',
    'HTTP_AUTHORIZATION' => 'Bearer 49|qJHRJzqNSu4iaalJqdRhSrHjSz0US4IWt9h9HCQwc5c5bbf0'
]);

try {
    $response = $kernel->handle($request);
    echo "Status Code: " . $response->getStatusCode() . PHP_EOL;
    echo "Content: " . $response->getContent() . PHP_EOL;
} catch (\Throwable $e) {
    echo "CAUGHT ERROR: " . $e->getMessage() . PHP_EOL;
    echo "File: " . $e->getFile() . " Line: " . $e->getLine() . PHP_EOL;
    echo "Trace: " . $e->getTraceAsString() . PHP_EOL;
}
