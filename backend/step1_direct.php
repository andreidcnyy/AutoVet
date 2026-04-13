<?php
define('LARAVEL_START', microtime(true));
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Illuminate\Http\Request::create('/api/dashboard/stats', 'GET');
$request->headers->set('Accept', 'application/json');
$response = $kernel->handle($request);
echo $response->getContent();
