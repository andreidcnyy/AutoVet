<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
);
try {
    $req = new \Illuminate\Http\Request();
    $controller = app(\App\Http\Controllers\DashboardController::class);
    $res = $controller->getServiceForecast($req);
    echo json_encode($res->getData());
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
