<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Species;

$species = Species::with('breeds')->get();
echo "--- SPECIES DATA ---\n";
echo json_encode($species, JSON_PRETTY_PRINT);
echo "\n--- END ---\n";
