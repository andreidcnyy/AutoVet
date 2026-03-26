<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pet = App\Models\Pet::with(['owner', 'species', 'breed'])->find(3);
file_put_contents('api_output.json', json_encode($pet, JSON_PRETTY_PRINT));
echo "JSON written to api_output.json\n";
