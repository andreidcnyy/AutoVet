<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pet = App\Models\Pet::with(['owner', 'species', 'breed'])->find(3);
header('Content-Type: application/json');
echo json_encode($pet, JSON_PRETTY_PRINT);
