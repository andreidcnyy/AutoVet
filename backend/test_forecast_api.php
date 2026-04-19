<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$controller = app(App\Http\Controllers\ForecastController::class);
$response = $controller->services(new Illuminate\Http\Request());

echo json_encode($response->getData(), JSON_PRETTY_PRINT);
