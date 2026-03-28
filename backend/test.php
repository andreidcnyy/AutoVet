<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$user = \App\Models\User::first();
auth()->login($user);

$request = Illuminate\Http\Request::create('/api/inventory-categories', 'GET');
$request->headers->set('Accept', 'application/json');

$response = $kernel->handle($request);
echo "\n--- STATUS CODE ---\n";
echo $response->getStatusCode() . "\n";
echo "\n--- RESPONSE CONTENT ---\n";
echo $response->getContent() . "\n";
