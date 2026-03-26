<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "--- SPECIES ---\n";
foreach (App\Models\Species::all() as $s) {
    echo "ID: {$s->id}, Name: {$s->name}\n";
}

echo "--- BREEDS ---\n";
foreach (App\Models\Breed::all() as $b) {
    echo "ID: {$b->id}, Name: {$b->name}, Species ID: {$b->species_id}\n";
}
