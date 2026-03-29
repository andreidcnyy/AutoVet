<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

use App\Models\Species;
use DB;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$species = Species::all(['id', 'name']);
echo "Current Species list:\n";
foreach ($species as $s) {
    echo "- {$s->name} (ID: {$s->id})\n";
}

$dogCount = DB::table('species')->where('name', 'Dog')->count();
$catCount = DB::table('species')->where('name', 'Cat')->count();

echo "\nCounts:\n";
echo "Dog: $dogCount\n";
echo "Cat: $catCount\n";

$petCounts = DB::table('pets')
    ->join('species', 'pets.species_id', '=', 'species.id')
    ->select('species.name', DB::raw('count(*) as count'))
    ->groupBy('species.name')
    ->get();

echo "\nPet counts per species:\n";
foreach ($petCounts as $pc) {
    echo "- {$pc->name}: {$pc->count}\n";
}
