<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pet = App\Models\Pet::find(3);
if ($pet) {
    echo "ID: " . $pet->id . "\n";
    echo "Name: " . $pet->name . "\n";
    echo "Species ID: " . ($pet->species_id ?? 'NULL') . "\n";
    echo "Breed ID: " . ($pet->breed_id ?? 'NULL') . "\n";
    echo "Species Name: " . ($pet->species->name ?? 'NULL') . "\n";
    echo "Breed Name: " . ($pet->breed->name ?? 'NULL') . "\n";
} else {
    echo "Pet not found.\n";
}
