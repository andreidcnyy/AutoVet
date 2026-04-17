<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Inventory;

$dhppi = Inventory::where('item_name', 'like', '%DHPPi%')->first();
$rabies = Inventory::where('item_name', 'like', '%Rabies%')->first();

if ($dhppi) {
    echo "Current DHPPi Code: {$dhppi->code}\n";
    $dhppi->code = 'TEMP-001';
    $dhppi->save();
}

if ($rabies) {
    echo "Current Rabies Code: {$rabies->code}\n";
    $rabies->code = 'INV-001';
    $rabies->save();
    echo "Rabies updated to INV-001\n";
}

if ($dhppi) {
    $dhppi->code = 'INV-002';
    $dhppi->save();
    echo "DHPPi updated to INV-002\n";
}

echo "Swap complete.\n";
