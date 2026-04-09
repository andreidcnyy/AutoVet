<?php
require __DIR__ . '/vendor/autoload.php';
echo "Autoload included...\n";
$app = require_once __DIR__ . '/bootstrap/app.php';
echo "App booted...\n";

use Illuminate\Http\Request;

try {
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    echo "Kernel created...\n";

    echo "Hitting /api/status...\n";
    $request = Request::create('/api/status', 'GET');
    $request->headers->set('Accept', 'application/json');

    $response = $kernel->handle($request);
    echo "Kernel handled request...\n";
    
    echo "Status Code: " . $response->getStatusCode() . "\n";
    echo "Content: " . $response->getContent() . "\n";

    $kernel->terminate($request, $response);
    echo "Kernel terminated...\n";
} catch (\Throwable $e) {
    echo "FATAL ERROR:\n" . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " Line: " . $e->getLine() . "\n";
}
